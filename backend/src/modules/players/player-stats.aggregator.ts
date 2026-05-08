import { OL_365SCORES_ID } from '../../config/constants';
import { parseStatValue } from '../live-match/live-match.aggregator';
import type {
  Scores365Competitor,
  Scores365Event,
  Scores365GameDetailed,
  Scores365LineupMember,
} from '../../config/scores365-game.schema';
import type { PlayerByMatch, PlayerSeasonStats } from './player-stats.types';

/**
 * Minimal context the aggregator needs about each match — supplied by the
 * service from `season-matches-cache` so we don't re-derive opponent / OL
 * side here.
 */
export interface MatchContext {
  gameId: number;
  date: string;
  opponent: string;
  isHome: boolean;
  olScore: number | null;
  opponentScore: number | null;
  competitionCode: PlayerByMatch['competitionCode'];
}

interface TopLevelMember {
  id: number;
  athleteId?: number;
  name?: string;
  shortName?: string;
  jerseyNumber?: number;
  imageVersion?: number;
}

interface MutableSeasonStats {
  athleteId: number;
  memberId: number;
  name: string;
  shortName: string;
  jerseyNumber: number | null;
  position: string;
  positionShort: string;
  imageVersion: number | null;
  matchesPlayed: number;
  matchesStarted: number;
  minutesPlayed: number;
  goals: number;
  assists: number;
  shots: number;
  shotsOnTarget: number;
  yellowCards: number;
  redCards: number;
  ratingsSum: number;
  ratingsCount: number;
  byMatch: PlayerByMatch[];
}

const POSITION_SHORT_MAP: Record<string, string> = {
  'Gardien de But': 'GK',
  Goalkeeper: 'GK',
  Défenseur: 'DEF',
  Defender: 'DEF',
  'Milieu de Terrain': 'MID',
  Midfielder: 'MID',
  Attaquant: 'ATK',
  Attacker: 'ATK',
  Forward: 'FW',
  Striker: 'ST',
};

function shortPos(longName: string, fallback: string): string {
  if (POSITION_SHORT_MAP[longName]) return POSITION_SHORT_MAP[longName];
  if (fallback) return fallback;
  return longName.slice(0, 3).toUpperCase();
}

function olSide(g: Scores365GameDetailed): Scores365Competitor | undefined {
  if (g.homeCompetitor?.id === OL_365SCORES_ID) return g.homeCompetitor;
  if (g.awayCompetitor?.id === OL_365SCORES_ID) return g.awayCompetitor;
  return undefined;
}

function deriveResult(
  olScore: number | null,
  opponentScore: number | null,
): PlayerByMatch['result'] {
  if (olScore == null || opponentScore == null) return null;
  if (olScore > opponentScore) return 'W';
  if (olScore < opponentScore) return 'L';
  return 'D';
}

function statValue(member: Scores365LineupMember, name: string): number {
  const stat = member.stats?.find((s) => s.name === name);
  return stat ? parseStatValue(stat.value) : 0;
}

function countCardsForPlayer(
  events: Scores365Event[] | undefined,
  memberId: number,
): { yellow: number; red: number } {
  let yellow = 0;
  let red = 0;
  for (const e of events ?? []) {
    if (e.competitorId !== OL_365SCORES_ID) continue;
    if (e.eventType?.id !== 2) continue;
    if (e.playerId !== memberId) continue;
    const subId = e.eventType?.subTypeId;
    const subName = String(e.eventType?.subTypeName ?? '').toLowerCase();
    const isRed = subId === 2 || subName.includes('rouge');
    const isSecondYellow =
      subId === 3 || subName.includes('2e') || subName.includes('second');
    if (isRed || isSecondYellow) {
      red += 1;
      if (isSecondYellow) yellow += 1;
    } else {
      yellow += 1;
    }
  }
  return { yellow, red };
}

/**
 * Single-match contribution for one OL lineup member. Returns null when
 * the member played 0 minutes (didn't enter the pitch) so we don't
 * inflate `matchesPlayed`.
 */
function buildMatchEntry(
  member: Scores365LineupMember,
  meta: TopLevelMember,
  events: Scores365Event[] | undefined,
  ctx: MatchContext,
): { entry: PlayerByMatch; ranking: number | null } | null {
  const minutes = statValue(member, 'Minutes');
  if (minutes <= 0) return null;

  const cards = countCardsForPlayer(events, member.id);
  const ranking =
    typeof member.ranking === 'number' && member.ranking > 0
      ? member.ranking
      : null;

  const entry: PlayerByMatch = {
    gameId: ctx.gameId,
    date: ctx.date,
    opponent: ctx.opponent,
    isHome: ctx.isHome,
    olScore: ctx.olScore,
    opponentScore: ctx.opponentScore,
    result: deriveResult(ctx.olScore, ctx.opponentScore),
    competitionCode: ctx.competitionCode,
    minutes,
    goals: statValue(member, 'Buts'),
    assists:
      statValue(member, 'Pass. Décisiv.') ||
      statValue(member, 'Passes décisives'),
    shots: statValue(member, 'Tirs au total'),
    shotsOnTarget: statValue(member, 'Tirs cadrés'),
    yellowCards: cards.yellow,
    redCards: cards.red,
    rating: ranking,
    isStarter: member.status === 1,
  };
  return { entry, ranking };
}

function ensureBucket(
  acc: Map<number, MutableSeasonStats>,
  member: Scores365LineupMember,
  meta: TopLevelMember,
): MutableSeasonStats | null {
  const athleteId = meta.athleteId ?? member.athleteId ?? 0;
  if (!athleteId) return null;
  const existing = acc.get(athleteId);
  if (existing) return existing;
  const positionLong = member.position?.name ?? '';
  const positionShort = shortPos(
    positionLong,
    member.formation?.shortName ?? '',
  );
  const bucket: MutableSeasonStats = {
    athleteId,
    memberId: member.id,
    name: meta.name ?? `Joueur #${member.id}`,
    shortName: meta.shortName ?? meta.name ?? `Joueur #${member.id}`,
    jerseyNumber:
      typeof meta.jerseyNumber === 'number' ? meta.jerseyNumber : null,
    position: positionLong,
    positionShort,
    imageVersion:
      typeof meta.imageVersion === 'number' ? meta.imageVersion : null,
    matchesPlayed: 0,
    matchesStarted: 0,
    minutesPlayed: 0,
    goals: 0,
    assists: 0,
    shots: 0,
    shotsOnTarget: 0,
    yellowCards: 0,
    redCards: 0,
    ratingsSum: 0,
    ratingsCount: 0,
    byMatch: [],
  };
  acc.set(athleteId, bucket);
  return bucket;
}

/**
 * Folds one detailed game into the running per-athlete accumulator.
 *
 * Only OL-side lineup members are considered. Members with 0 minutes are
 * skipped. Stat names are the French 365scores labels.
 */
export function accumulateGame(
  acc: Map<number, MutableSeasonStats>,
  game: Scores365GameDetailed,
  ctx: MatchContext,
): void {
  const ol = olSide(game);
  const members = ol?.lineups?.members;
  if (!members?.length) return;

  const metaById = new Map<number, TopLevelMember>();
  for (const m of game.members ?? []) metaById.set(m.id, m);

  for (const m of members) {
    const meta = metaById.get(m.id) ?? { id: m.id };
    const built = buildMatchEntry(m, meta, game.events, ctx);
    if (!built) continue;
    const bucket = ensureBucket(acc, m, meta);
    if (!bucket) continue;

    bucket.matchesPlayed += 1;
    if (built.entry.isStarter) bucket.matchesStarted += 1;
    bucket.minutesPlayed += built.entry.minutes;
    bucket.goals += built.entry.goals;
    bucket.assists += built.entry.assists;
    bucket.shots += built.entry.shots;
    bucket.shotsOnTarget += built.entry.shotsOnTarget;
    bucket.yellowCards += built.entry.yellowCards;
    bucket.redCards += built.entry.redCards;
    if (built.ranking !== null) {
      bucket.ratingsSum += built.ranking;
      bucket.ratingsCount += 1;
    }
    // Refresh display fields with the most recent appearance so the page
    // shows the player's current jersey / image / position even after
    // a transfer or position swap.
    if (meta.name) bucket.name = meta.name;
    if (meta.shortName) bucket.shortName = meta.shortName;
    if (typeof meta.jerseyNumber === 'number')
      bucket.jerseyNumber = meta.jerseyNumber;
    if (typeof meta.imageVersion === 'number')
      bucket.imageVersion = meta.imageVersion;
    if (m.position?.name) {
      bucket.position = m.position.name;
      bucket.positionShort = shortPos(
        m.position.name,
        m.formation?.shortName ?? '',
      );
    }

    bucket.byMatch.push(built.entry);
  }
}

export function finalize(
  acc: Map<number, MutableSeasonStats>,
): PlayerSeasonStats[] {
  const out: PlayerSeasonStats[] = [];
  for (const s of acc.values()) {
    s.byMatch.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );
    const shotAccuracy =
      s.shots > 0 ? Math.round((s.shotsOnTarget / s.shots) * 1000) / 10 : 0;
    const averageRating =
      s.ratingsCount > 0
        ? Math.round((s.ratingsSum / s.ratingsCount) * 10) / 10
        : null;
    out.push({
      athleteId: s.athleteId,
      memberId: s.memberId,
      name: s.name,
      shortName: s.shortName,
      jerseyNumber: s.jerseyNumber,
      position: s.position,
      positionShort: s.positionShort,
      imageVersion: s.imageVersion,
      matchesPlayed: s.matchesPlayed,
      matchesStarted: s.matchesStarted,
      minutesPlayed: s.minutesPlayed,
      goals: s.goals,
      assists: s.assists,
      goalContributions: s.goals + s.assists,
      shots: s.shots,
      shotsOnTarget: s.shotsOnTarget,
      shotAccuracy,
      yellowCards: s.yellowCards,
      redCards: s.redCards,
      averageRating,
      byMatch: s.byMatch,
    });
  }
  return out.sort((a, b) => {
    if (b.goalContributions !== a.goalContributions)
      return b.goalContributions - a.goalContributions;
    if (b.minutesPlayed !== a.minutesPlayed)
      return b.minutesPlayed - a.minutesPlayed;
    return a.name.localeCompare(b.name, 'fr');
  });
}

/** Convenience: aggregate a list of games + contexts in one call. */
export function aggregateAll(
  games: Array<{ game: Scores365GameDetailed; ctx: MatchContext }>,
): PlayerSeasonStats[] {
  const acc = new Map<number, MutableSeasonStats>();
  for (const { game, ctx } of games) accumulateGame(acc, game, ctx);
  return finalize(acc);
}
