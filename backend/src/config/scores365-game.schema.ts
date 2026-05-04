import { z } from 'zod';

/**
 * Minimal 365scores `game` shape — only the fields any of our consumers
 * (cups, bracket, lineup, live-match) actually read. Zod's default object
 * mode allows extra keys to pass through, so 365scores can keep adding
 * fields without breaking us.
 */
const competitorSchema = z.object({
  id: z.number(),
  name: z.string().optional(),
  score: z.number().optional(),
});

export const Scores365GameSchema = z.object({
  id: z.number(),
  startTime: z.string(),
  competitionId: z.number().optional(),
  statusGroup: z.number().optional(),
  stageNum: z.number().optional(),
  roundNum: z.number().optional(),
  homeCompetitor: competitorSchema.optional(),
  awayCompetitor: competitorSchema.optional(),
});

export type Scores365Game = z.infer<typeof Scores365GameSchema>;

const pagingSchema = z.object({
  previousPage: z.string().optional(),
  nextPage: z.string().optional(),
});

export const Scores365GamesResponseSchema = z.object({
  games: z.array(Scores365GameSchema).optional(),
  paging: pagingSchema.optional(),
});

export type Scores365GamesResponse = z.infer<typeof Scores365GamesResponseSchema>;
