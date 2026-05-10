import type {
  LiveMatchStats,
  LiveMatchSummary,
  LiveMatchTeamStats,
  LiveMatchTimelineEvent,
  LiveMatchTopPerformer,
  LiveMatchShot,
  LiveMatchSide,
  LiveMatchStatus,
} from './live-match.types';
import { OL_365SCORES_ID as OL_365_ID } from '../../config/constants';
import type {
  Scores365Competitor,
  Scores365Event,
  Scores365GameDetailed,
  Scores365GameDetailResponse,
  Scores365TopPerformerCategory,
} from '../../config/scores365-game.schema';

/**
 * Parses a 365scores stat value like "5", "12'", "4/8", "70%" into a number.
 * Returns 0 for unknown formats.
 */
export function parseStatValue(v: unknown): number {
  if (typeof v === 'number') return v;
  if (typeof v !== 'string') return 0;
  const s = v.trim();
  if (!s) return 0;
  if (s.includes('/')) {
    const [a] = s.split('/');
    const n = parseFloat(a);
    return Number.isFinite(n) ? n : 0;
  }
  if (s.endsWith('%')) {
    const n = parseFloat(s.slice(0, -1));
    return Number.isFinite(n) ? n : 0;
  }
  if (s.endsWith("'")) {
    const n = parseFloat(s.slice(0, -1));
    return Number.isFinite(n) ? n : 0;
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

function aggregateTeamStats(competitor: Scores365Competitor | undefined): LiveMatchTeamStats {
  const totals: LiveMatchTeamStats = {};
  const members = competitor?.lineups?.members ?? [];
  for (const m of members) {
    if (m.status !== 1) continue; // starters only (status 1 = Starting)
    for (const s of m.stats ?? []) {
      const name = s.name;
      if (!name) continue;
      totals[name] = (totals[name] ?? 0) + parseStatValue(s.value);
    }
  }
  return totals;
}

function deriveStatus(statusGroup: number): LiveMatchStatus {
  if (statusGroup === 3) return 'live';
  if (statusGroup === 4) return 'ended';
  return 'upcoming';
}

function toSide(c: Scores365Competitor | undefined): LiveMatchSide {
  return {
    id: c?.id ?? 0,
    name: c?.name ?? '',
    symbolicName: c?.symbolicName ?? '',
    imageVersion: c?.imageVersion ?? 0,
    score: typeof c?.score === 'number' ? c.score : null,
  };
}

function describeEvent(e: Scores365Event): string {
  const eventType = e.eventType ?? {};
  const type = eventType.name ?? '';
  const subType = eventType.subTypeName ?? '';
  return [type, subType].filter(Boolean).join(' — ') || 'Événement';
}

function eventTypeKey(e: Scores365Event): string {
  const id = e.eventType?.id ?? 0;
  const subId = e.eventType?.subTypeId ?? 0;
  const name = String(e.eventType?.name ?? '').toLowerCase();
  const subName = String(e.eventType?.subTypeName ?? '').toLowerCase();
  const combined = `${name} ${subName}`;
  // map a couple of common 365scores ids to friendly keys; fallback to label heuristics.
  if (id === 1) {
    if (combined.includes('penalti') || subId === 3 || subId === 8) return 'penalty_goal';
    if (combined.includes('csc') || combined.includes('contre son camp') || subId === 4) return 'own_goal';
    return 'goal';
  }
  if (id === 2) {
    if (combined.includes('rouge')) return 'red_card';
    if (combined.includes('2e') || combined.includes('second')) return 'second_yellow_red';
    if (combined.includes('jaune')) return 'yellow_card';
    if (subId === 1) return 'yellow_card';
    if (subId === 2) return 'red_card';
    if (subId === 3) return 'second_yellow_red';
    return 'card';
  }
  if (id === 3) return 'substitution';
  if (id === 4) return 'var';
  if (id === 16) return 'penalty_missed';
  return `event_${id}_${subId}`;
}

function toTimelineEvents(g: Scores365GameDetailed): LiveMatchTimelineEvent[] {
  const events = g.events ?? [];
  const mapped: LiveMatchTimelineEvent[] = events
    .map((e) => ({
      competitorId: e.competitorId ?? 0,
      gameTime: typeof e.gameTime === 'number' ? e.gameTime : 0,
      gameTimeDisplay: e.gameTimeDisplay ?? '',
      type: eventTypeKey(e),
      isMajor: !!e.isMajor,
      playerId: typeof e.playerId === 'number' ? e.playerId : null,
      extraPlayerId:
        Array.isArray(e.extraPlayers) && e.extraPlayers.length > 0 ? e.extraPlayers[0] : null,
      description: describeEvent(e),
    }))
    .sort((a, b) => a.gameTime - b.gameTime);
  return deriveSecondYellowReds(mapped);
}

/**
 * FIFA rule: a player who collects two yellow cards in the same match is sent off
 * (red card). 365scores sometimes emits a dedicated `second_yellow_red` event,
 * sometimes only two `yellow_card` events. To present a uniform UX, we walk the
 * timeline once and synthesize a `second_yellow_red` event on the 2nd yellow
 * when 365scores didn't already do it.
 *
 * Idempotent: if a real `second_yellow_red` or `red_card` already exists at the
 * same minute for the same player, no synthetic event is added.
 */
export function deriveSecondYellowReds(
  events: LiveMatchTimelineEvent[],
): LiveMatchTimelineEvent[] {
  const yellowsByPlayer = new Map<number, number>();
  const synthesized: LiveMatchTimelineEvent[] = [];
  for (const e of events) {
    if (e.playerId == null) continue;
    if (e.type === 'yellow_card') {
      const next = (yellowsByPlayer.get(e.playerId) ?? 0) + 1;
      yellowsByPlayer.set(e.playerId, next);
      if (next === 2) {
        // Skip if 365scores already exposes a sending-off for this player at
        // (or after) this minute — avoids duplicate.
        const alreadySentOff = events.some(
          (other) =>
            other.playerId === e.playerId &&
            (other.type === 'second_yellow_red' || other.type === 'red_card') &&
            other.gameTime >= e.gameTime,
        );
        if (!alreadySentOff) {
          synthesized.push({
            competitorId: e.competitorId,
            gameTime: e.gameTime,
            gameTimeDisplay: e.gameTimeDisplay,
            type: 'second_yellow_red',
            isMajor: true,
            playerId: e.playerId,
            extraPlayerId: null,
            description: '2e carton jaune — Expulsion',
            derived: true,
          });
        }
      }
    } else if (e.type === 'second_yellow_red') {
      // Treat as 2 yellows accumulated, even if only one yellow event is in the feed.
      const next = Math.max(2, (yellowsByPlayer.get(e.playerId) ?? 0) + 1);
      yellowsByPlayer.set(e.playerId, next);
    }
  }
  if (synthesized.length === 0) return events;
  return [...events, ...synthesized].sort((a, b) => {
    if (a.gameTime !== b.gameTime) return a.gameTime - b.gameTime;
    // Synthetic 2nd-yellow-red appears immediately after its triggering yellow.
    if (a.derived && !b.derived) return 1;
    if (!a.derived && b.derived) return -1;
    return 0;
  });
}

function shotOutcome(o: { name?: string } | undefined): string {
  return o?.name ?? '';
}

function toShots(g: Scores365GameDetailed): LiveMatchShot[] {
  const events = g.chartEvents?.events ?? [];
  return events
    .filter((e) => typeof e.competitorNum === 'number')
    .map((e) => {
      const competitorId =
        e.competitorNum === 1 ? g.homeCompetitor?.id : g.awayCompetitor?.id;
      return {
        competitorId: competitorId ?? 0,
        playerId: e.playerId ?? 0,
        time: e.time ?? '',
        xg: parseStatValue(e.xg),
        xgot: parseStatValue(e.xgot),
        bodyPart: e.bodyPart ?? '',
        outcome: shotOutcome(e.outcome),
        line: typeof e.line === 'number' ? e.line : 0,
        side: typeof e.side === 'number' ? e.side : 0,
      };
    });
}

function toTopPerformers(g: Scores365GameDetailed): LiveMatchTopPerformer[] {
  const cats: Scores365TopPerformerCategory[] = g.topPerformers?.categories ?? [];
  return cats.map((c) => {
    const homeP = c.homePlayer;
    const awayP = c.awayPlayer;
    const firstStat = (
      p: Scores365TopPerformerCategory['homePlayer'] | Scores365TopPerformerCategory['awayPlayer'],
    ): { name?: string; value?: string | number } => p?.stats?.[0] ?? {};
    return {
      role: c.name ?? '',
      homePlayer: homeP
        ? {
            id: homeP.athleteId ?? homeP.id ?? 0,
            name: homeP.name ?? '',
            statName: firstStat(homeP).name ?? '',
            statValue: String(firstStat(homeP).value ?? ''),
          }
        : null,
      awayPlayer: awayP
        ? {
            id: awayP.athleteId ?? awayP.id ?? 0,
            name: awayP.name ?? '',
            statName: firstStat(awayP).name ?? '',
            statValue: String(firstStat(awayP).value ?? ''),
          }
        : null,
    };
  });
}

export function summarize(rawGame: Scores365GameDetailed): LiveMatchSummary {
  const home = rawGame.homeCompetitor;
  const away = rawGame.awayCompetitor;
  return {
    gameId: rawGame.id,
    matchupId: `${home?.id ?? 0}-${away?.id ?? 0}-${rawGame.id}`,
    competitionId: rawGame.competitionId ?? 0,
    competitionName: rawGame.competitionDisplayName ?? '',
    status: deriveStatus(rawGame.statusGroup ?? 0),
    statusGroup: rawGame.statusGroup ?? 0,
    statusText: rawGame.statusText ?? '',
    gameTime: typeof rawGame.gameTime === 'number' ? rawGame.gameTime : 0,
    gameTimeDisplay: rawGame.gameTimeDisplay ?? '',
    startTime: rawGame.startTime,
    home: toSide(home),
    away: toSide(away),
  };
}

export function aggregate(raw365Response: Scores365GameDetailResponse): LiveMatchStats {
  const game = raw365Response?.game;
  if (!game) throw new Error('Missing game in 365scores response');
  const summary = summarize(game);
  return {
    ...summary,
    teamStats: {
      home: aggregateTeamStats(game.homeCompetitor),
      away: aggregateTeamStats(game.awayCompetitor),
    },
    events: toTimelineEvents(game),
    topPerformers: toTopPerformers(game),
    shots: toShots(game),
    updatedAt: new Date().toISOString(),
  };
}

export const LIVE_MATCH_OL_ID = OL_365_ID;
