import { z } from 'zod';

/**
 * Subset of the football-data.org v4 API response we actually use
 * (`/v4/teams/:id/matches` and `/v4/competitions/:id/matches`).
 *
 * Every object uses `.passthrough()` so football-data can keep adding
 * fields without breaking us, while declared fields stay strictly typed.
 *
 * Used at the fetch boundary in `FixturesService` to replace the
 * untyped `data as any`. If the API drifts, we now fail fast in
 * `parseExternal()` with a clear message instead of crashing later.
 */

const teamSchema = z
  .object({
    id: z.number(),
    name: z.string().optional(),
    shortName: z.string().optional(),
  })
  .passthrough();

const scoreFullTimeSchema = z
  .object({
    home: z.number().nullable().optional(),
    away: z.number().nullable().optional(),
  })
  .passthrough();

const scoreSchema = z
  .object({
    fullTime: scoreFullTimeSchema.optional(),
  })
  .passthrough();

const competitionSchema = z
  .object({
    name: z.string().optional(),
  })
  .passthrough();

export const FootballDataMatchSchema = z
  .object({
    id: z.number(),
    utcDate: z.string(),
    status: z.string(),
    matchday: z.number().nullable().optional(),
    homeTeam: teamSchema,
    awayTeam: teamSchema,
    score: scoreSchema.optional(),
    competition: competitionSchema.optional(),
  })
  .passthrough();

export type FootballDataMatch = z.infer<typeof FootballDataMatchSchema>;

export const FootballDataMatchesResponseSchema = z
  .object({
    matches: z.array(FootballDataMatchSchema).optional(),
  })
  .passthrough();

export type FootballDataMatchesResponse = z.infer<typeof FootballDataMatchesResponseSchema>;
