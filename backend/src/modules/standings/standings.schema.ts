import { z } from 'zod';

/**
 * Subset of the 365scores `/web/standings/` response we actually rely on.
 * The endpoint returns dozens of fields per row (logos, urls, stage info…) ;
 * we only validate what we read. Zod's default object mode allows extra keys
 * to pass through, so 365scores can keep adding fields without breaking us.
 *
 * Used at the fetch boundary in `StandingsService.fetchStandings()` to
 * replace untyped `data as any` access. If 365scores changes the response
 * shape, we now fail fast with a typed error instead of producing
 * silently-broken standings.
 */

const competitorSchema = z.object({
  id: z.number(),
  name: z.string().optional(),
  symbolicName: z.string().optional(),
});

const rowSchema = z.object({
  position: z.number(),
  competitor: competitorSchema,
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
