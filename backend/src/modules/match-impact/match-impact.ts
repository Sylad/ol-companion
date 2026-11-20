import { rankedTableUpTo, type LeagueGame, type RankedRow } from '../standings/season-rankings';

/**
 * L265 — « Ce que ça change » : ce qu'un match de Ligue 1 de l'OL change à son
 * classement, calculé avec les seuls matchs de football-data.org (aucune
 * donnée de 365scores, dont les conditions interdisent le service à des
 * tiers : docs/etudes/365scores-conditions.md).
 *
 * Le classement « avant » et « après » est celui du tracker de l'accueil (L241) :
 * même départage LFP (`rankedTableUpTo` → `compareLfp`), même découpage par
 * journée (un match joué en retard compte dans sa journée d'origine). « Avant »
 * = à l'issue de la journée précédente, « après » = à l'issue de la journée du
 * match. Une journée est complète quand les 9 matchs de chaque journée jusqu'à
 * elle sont terminés ; sinon la place est provisoire (`remaining` > 0).
 */

/** Un match de Ligue 1 tel que football-data le donne, réduit à ce que le calcul lit. */
export interface FdLeagueMatch {
  id: number;
  utcDate: string;
  status: string;
  matchday: number | null;
  homeTeam: { id: number; name: string };
  awayTeam: { id: number; name: string };
  score: { home: number | null; away: number | null };
}

/** Matchs d'une journée de Ligue 1 à 18 clubs. */
export const MATCHES_PER_ROUND = 9;

/**
 * Places clés du classement de Ligue 1 2026-27 (mêmes zones que la légende de
 * `/standings`, `standings-table.tsx`) : dernière place de chaque zone. 1 = la
 * tête, 3 = Ligue des champions, 5 = Ligue Europa, 6 = Ligue Conférence,
 * 15 = dernière place hors barrage de relégation.
 */
export const KEY_PLACES = [1, 3, 5, 6, 15] as const;

/** Écart maximal entre l'instant demandé et le coup d'envoi lu chez football-data. */
const MATCH_WINDOW_MS = 12 * 3600_000;

const FINISHED_STATUSES = new Set(['FINISHED', 'AWARDED']);

export interface Standing { position: number; points: number; }

export interface MatchImpact {
  matchday: number;
  /** Le match de l'OL est terminé selon football-data ; sinon rien n'est calculé. */
  finished: boolean;
  homeTeam: string;
  awayTeam: string;
  score: { home: number | null; away: number | null };
  /** Place à l'issue de la journée précédente ; `null` à la première journée. */
  before: Standing | null;
  /** Place à l'issue de la journée du match ; `null` si le match n'est pas terminé. */
  after: Standing | null;
  /** Matchs des journées 1 à `matchday` pas encore terminés : > 0 = classement provisoire. */
  remaining: number;
  /** Dont ceux de la journée du match elle-même. */
  remainingInMatchday: number;
  /** Place clé juste au-dessus de l'OL, et ses points d'avance sur l'OL (0 = égalité de points). */
  above: { place: number; gap: number } | null;
  /** Place clé que l'OL tient, et son avance en points sur le club suivant (place + 1). */
  below: { place: number; margin: number } | null;
}

const isFinished = (m: FdLeagueMatch): boolean =>
  FINISHED_STATUSES.has(m.status) && m.score.home !== null && m.score.away !== null && m.matchday !== null;

/** Matchs de football-data → matchs lus par le calcul du tracker (`statusGroup` 4 = terminé). */
export function toLeagueGames(matches: FdLeagueMatch[]): LeagueGame[] {
  return matches.filter(isFinished).map((m) => ({
    roundNum: m.matchday as number,
    statusGroup: 4,
    home: { id: m.homeTeam.id, score: m.score.home as number },
    away: { id: m.awayTeam.id, score: m.score.away as number },
  }));
}

/** Le match de Ligue 1 de `olId` le plus proche de `at`, à 12 h près ; `null` sinon. */
export function findOlMatch(matches: FdLeagueMatch[], olId: number, at: Date): FdLeagueMatch | null {
  let best: FdLeagueMatch | null = null;
  let bestGap = Infinity;
  for (const m of matches) {
    if (m.homeTeam.id !== olId && m.awayTeam.id !== olId) continue;
    const gap = Math.abs(new Date(m.utcDate).getTime() - at.getTime());
    if (gap <= MATCH_WINDOW_MS && gap < bestGap) {
      best = m;
      bestGap = gap;
    }
  }
  return best;
}

function standingOf(table: RankedRow[], olId: number): Standing | null {
  const row = table.find((r) => r.id === olId);
  return row ? { position: row.position, points: row.points } : null;
}

/** Écarts avec les places clés, lus dans l'ordre du classement (le k-ième club pour la place k). */
export function keyPlaceGaps(table: RankedRow[], ol: Standing): Pick<MatchImpact, 'above' | 'below'> {
  const at = (place: number): RankedRow | undefined => table[place - 1];
  const abovePlace = [...KEY_PLACES].reverse().find((p) => p < ol.position && at(p));
  const belowPlace = KEY_PLACES.find((p) => p >= ol.position && at(p + 1));
  return {
    above: abovePlace ? { place: abovePlace, gap: (at(abovePlace) as RankedRow).points - ol.points } : null,
    below: belowPlace ? { place: belowPlace, margin: ol.points - (at(belowPlace + 1) as RankedRow).points } : null,
  };
}

/**
 * Ce que le match de l'OL joué vers `at` change à son classement. `null` si
 * football-data n'a pas de match de Ligue 1 de l'OL à cet instant (ou sans journée).
 */
export function computeMatchImpact(matches: FdLeagueMatch[], olId: number, at: Date): MatchImpact | null {
  const match = findOlMatch(matches, olId, at);
  if (!match || match.matchday === null) return null;
  const matchday = match.matchday;
  const base = {
    matchday,
    homeTeam: match.homeTeam.name,
    awayTeam: match.awayTeam.name,
    score: match.score,
  };
  const finishedUpTo = (round: number) => matches.filter((m) => isFinished(m) && (m.matchday as number) <= round).length;
  const remaining = MATCHES_PER_ROUND * matchday - finishedUpTo(matchday);
  const remainingInMatchday = Math.max(
    0,
    MATCHES_PER_ROUND - matches.filter((m) => isFinished(m) && m.matchday === matchday).length,
  );
  if (!isFinished(match)) {
    return { ...base, finished: false, before: null, after: null, remaining, remainingInMatchday, above: null, below: null };
  }
  const games = toLeagueGames(matches);
  const table = rankedTableUpTo(games, matchday);
  const after = standingOf(table, olId) as Standing; // le match de l'OL est terminé
  const before = matchday > 1 ? standingOf(rankedTableUpTo(games, matchday - 1), olId) : null;
  return { ...base, finished: true, before, after, remaining, remainingInMatchday, ...keyPlaceGaps(table, after) };
}
