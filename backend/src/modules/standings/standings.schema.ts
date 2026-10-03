import { z } from 'zod';

/**
 * Subset of the 365scores `/web/standings/` response we actually rely on.
 * The endpoint returns dozens of fields per row (logos, urls, stage info…) ;
 * we only validate what we read. Zod's default object mode allows extra keys
 * to pass through, so 365scores can keep adding fields without breaking us.
 *
 * Used at the fetch boundary — through `readScores365Standings()`
 * (`scores365-standings.ts`), shared by `StandingsService` and the live
 * mini-standings — to replace untyped `data as any` access. If 365scores
 * changes the response shape, we now fail fast with a typed error instead of
 * producing silently-broken standings.
 */

const competitorSchema = z.object({
  id: z.number(),
  name: z.string().optional(),
  symbolicName: z.string().optional(),
});

/**
 * One game of a row (`detailedRecentForm[]`, `nextMatch`) — we only read who
 * played. Deliberately lenient: these games are a fallback source, they must
 * never be a reason to reject a response.
 */
const rowGameSchema = z.object({
  homeCompetitor: competitorSchema.optional(),
  awayCompetitor: competitorSchema.optional(),
});

const rowSchema = z.object({
  position: z.number(),
  /**
   * Optional since 2026-10-03: degraded renders of 365scores (frozen 30 min by
   * their CDN) ship 18 rows of which 1 to 3 have no `competitor` object, stats
   * intact. Requiring it rejected the whole response and emptied the table.
   * `readScores365Standings()` restores the club from the row's own games and
   * hands out rows whose `competitor` is always set — read rows through it.
   */
  competitor: competitorSchema.optional(),
  /** The row's last games, the club on one side of each (fallback source of the club). */
  detailedRecentForm: z.array(rowGameSchema).optional().catch(undefined),
  /** The row's next game, same use. */
  nextMatch: rowGameSchema.optional().catch(undefined),
  gamePlayed: z.number().optional(),
  gamesWon: z.number().optional(),
  gamesEven: z.number().optional(),
  gamesLost: z.number().optional(),
  for: z.number().optional(),
  against: z.number().optional(),
  ratio: z.number().optional(),
  points: z.number().optional(),
  recentForm: z.array(z.number()).optional(),
  trend: z.number().optional(),
  /** Présent quand l'équipe joue en ce moment : le classement 365scores est live. */
  liveGameId: z.number().optional(),
});

const stageSchema = z.object({
  isCurrentStage: z.boolean().optional(),
  seasonNum: z.number().optional(),
  rows: z.array(rowSchema).optional(),
});

const seasonSchema = z.object({
  num: z.number(),
  name: z.string(),
});

const competitionSchema = z.object({
  seasons: z.array(seasonSchema).optional(),
});

export const Scores365StandingsResponseSchema = z.object({
  standings: z.array(stageSchema).optional(),
  competitions: z.array(competitionSchema).optional(),
});

export type Scores365StandingsResponse = z.infer<typeof Scores365StandingsResponseSchema>;
export type Scores365StandingsRow = z.infer<typeof rowSchema>;
export type Scores365StandingsCompetitor = z.infer<typeof competitorSchema>;
