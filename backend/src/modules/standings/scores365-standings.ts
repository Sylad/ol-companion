import { parseExternal } from '../../common/zod-validation.pipe';
import {
  Scores365StandingsResponseSchema,
  type Scores365StandingsCompetitor,
  type Scores365StandingsResponse,
  type Scores365StandingsRow,
} from './standings.schema';

/**
 * Single reading of a 365scores `/web/standings/` response, shared by
 * `StandingsService` (the full table) and the live mini-standings.
 *
 * Why it exists (measured on 2026-10-03, 11 requests against the API):
 *  - the origin intermittently serves DEGRADED renders with HTTP 200 — 18 rows
 *    of which 1 to 3 carry no `competitor` object (stats intact), or a
 *    121-byte envelope with no `standings` key at all — and once a 504 ;
 *  - which rows are hit changes from one render to the next (3+16, 8, 3+7+17,
 *    or none), whatever the headers and parameters; their CDN then freezes
 *    each render for 30 min per cache key. No request variant avoids it;
 *  - the club of a row is written elsewhere in the same row: it is the one
 *    competitor present in EVERY game the row lists (`detailedRecentForm` +
 *    `nextMatch`). Checked on 152 complete rows of 9 real payloads: always
 *    exactly one such competitor, always the row's own, same id and name.
 *
 * So a row without `competitor` gets its club from its own games — a fact of
 * the payload, not a guess — and when that is not possible the WHOLE table is
 * refused with the reason: an incomplete or renumbered table is never
 * returned.
 */

/** Clubs in the Ligue 1 table (the only competition read here): a table with fewer rows lost some. */
const LIGUE1_CLUB_COUNT = 18;

/** A standings row whose club is known (given by 365scores or restored). */
export type ResolvedStandingsRow = Omit<Scores365StandingsRow, 'competitor'> & {
  competitor: Scores365StandingsCompetitor;
};

/** A club 365scores left out of its row, restored from the row's games. */
export interface ClubResolvedFromGames {
  position: number;
  id: number;
  name: string;
}

export type Scores365StandingsReading =
  | {
      ok: true;
      /** The validated response (seasons, …). Read the rows from `rows`. */
      data: Scores365StandingsResponse;
      /** Season number of the stage the rows come from. */
      seasonNum: number | undefined;
      /** Every row of the current stage, in the order received, club always set. */
      rows: ResolvedStandingsRow[];
      /** Rows that arrived without `competitor` — worth a log line. */
      resolvedFromGames: ClubResolvedFromGames[];
    }
  | {
      ok: false;
      /** Why there is no usable table — callers log it. */
      reason: string;
    };

/**
 * Validates `json` and returns the rows of the current stage with their club.
 *
 * Throws (as `parseExternal` does) when the response does not have the known
 * shape; returns `{ ok: false, reason }` when the shape is known but there is
 * no complete table to give.
 */
export function readScores365Standings(
  json: unknown,
  source: string,
): Scores365StandingsReading {
  const data = parseExternal(Scores365StandingsResponseSchema, json, source);
  const stage =
    data.standings?.find((s) => s.isCurrentStage) ?? data.standings?.[0];
  if (!stage?.rows?.length) {
    return {
      ok: false,
      reason: `no standings in the response (keys: ${topLevelKeys(json)})`,
    };
  }

  const rows: ResolvedStandingsRow[] = [];
  const resolvedFromGames: ClubResolvedFromGames[] = [];
  const unresolved: number[] = [];
  for (const row of stage.rows) {
    if (row.competitor) {
      rows.push({ ...row, competitor: row.competitor });
      continue;
    }
    const club = clubFromRowGames(row);
    if (!club) {
      unresolved.push(row.position);
      continue;
    }
    rows.push({ ...row, competitor: club });
    resolvedFromGames.push({
      position: row.position,
      id: club.id,
      name: club.name,
    });
  }

  if (unresolved.length > 0) {
    return {
      ok: false,
      reason:
        `${unresolved.length} of ${stage.rows.length} rows have no competitor and their games do not single out a club ` +
        `(position ${unresolved.join(', ')}) — table refused rather than served incomplete`,
    };
  }

  const positions = rows.map((r) => r.position).sort((a, b) => a - b);
  const gap = positions.findIndex((p, i) => p !== i + 1);
  if (gap !== -1 || positions.length !== LIGUE1_CLUB_COUNT) {
    const detail =
      gap !== -1
        ? `expected ${gap + 1}, found ${positions[gap]}`
        : `${positions.length} rows received, expected ${LIGUE1_CLUB_COUNT}`;
    return {
      ok: false,
      reason:
        `positions are not 1..${LIGUE1_CLUB_COUNT} (${detail}; ` +
        `received ${positions.join(', ')}) — rows are missing or numbered twice, table refused`,
    };
  }

  const duplicate = firstClubOnSeveralRows(rows);
  if (duplicate) {
    return {
      ok: false,
      reason:
        `competitor ${duplicate.id} ends up on several rows (positions ${duplicate.positions.join(', ')}) ` +
        `after restoring ${describeClubsResolvedFromGames(resolvedFromGames) || 'nothing'} — table refused`,
    };
  }

  return {
    ok: true,
    data,
    seasonNum: stage.seasonNum,
    rows,
    resolvedFromGames,
  };
}

/** `3 → Paris FC (#6075), 16 → Troyes (#488)` — for the callers' log line. */
export function describeClubsResolvedFromGames(
  clubs: ClubResolvedFromGames[],
): string {
  return clubs.map((c) => `${c.position} → ${c.name} (#${c.id})`).join(', ');
}

const MIN_GAMES_TO_RESOLVE_CLUB = 2;

/**
 * The club of a row = the only competitor present in every game the row lists.
 * One game names two clubs, so at least two games carrying both clubs (against
 * different opponents) are needed; anything else than exactly one named club
 * → undefined.
 */
function clubFromRowGames(
  row: Scores365StandingsRow,
): (Scores365StandingsCompetitor & { name: string }) | undefined {
  // Only games carrying BOTH clubs count: a game with a single side named may
  // name the opponent, and would then designate the wrong club.
  const games = [
    ...(row.detailedRecentForm ?? []),
    ...(row.nextMatch ? [row.nextMatch] : []),
  ].filter((game) => game.homeCompetitor && game.awayCompetitor);
  if (games.length < MIN_GAMES_TO_RESOLVE_CLUB) return undefined;
  let inEveryGame: Map<number, Scores365StandingsCompetitor> | undefined;
  for (const game of games) {
    const sides = new Map<number, Scores365StandingsCompetitor>();
    for (const side of [game.homeCompetitor, game.awayCompetitor]) {
      if (side && (!inEveryGame || inEveryGame.has(side.id))) {
        sides.set(side.id, inEveryGame?.get(side.id) ?? side);
      }
    }
    inEveryGame = sides;
  }
  if (inEveryGame?.size !== 1) return undefined;
  const [club] = inEveryGame.values();
  return club.name ? { ...club, name: club.name } : undefined;
}

function firstClubOnSeveralRows(
  rows: ResolvedStandingsRow[],
): { id: number; positions: number[] } | undefined {
  const positionsById = new Map<number, number[]>();
  for (const row of rows) {
    const positions = positionsById.get(row.competitor.id) ?? [];
    positions.push(row.position);
    positionsById.set(row.competitor.id, positions);
  }
  for (const [id, positions] of positionsById) {
    if (positions.length > 1) return { id, positions };
  }
  return undefined;
}

function topLevelKeys(json: unknown): string {
  return json !== null && typeof json === 'object'
    ? Object.keys(json).join(', ') || 'none'
    : typeof json;
}
