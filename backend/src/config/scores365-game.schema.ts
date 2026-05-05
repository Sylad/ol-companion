import { z } from 'zod';

/**
 * 365scores `game` shapes — only the fields any of our consumers
 * (cups, bracket, lineup, live-match) actually read. Every object
 * uses `.passthrough()` so 365scores can keep adding fields without
 * breaking us, while declared fields stay strictly typed.
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

/* ------------------------------------------------------------------ */
/* Detailed `game` payload — used by live-match aggregator.            */
/* Schemas use .passthrough() so unknown 365scores fields are kept     */
/* on the parsed object (forward-compat with API drift).               */
/* ------------------------------------------------------------------ */

const lineupMemberStatSchema = z
  .object({
    type: z.number().optional(),
    name: z.string().optional(),
    shortName: z.string().optional(),
    value: z.union([z.string(), z.number()]).optional(),
    isTop: z.boolean().optional(),
    categoryId: z.number().optional(),
    order: z.number().optional(),
    imageId: z.number().optional(),
  })
  .passthrough();

const lineupMemberPositionSchema = z
  .object({
    id: z.number().optional(),
    name: z.string().optional(),
    shortName: z.string().optional(),
  })
  .passthrough();

const lineupYardFormationSchema = z
  .object({
    line: z.number().optional(),
    fieldPosition: z.number().optional(),
    fieldLine: z.number().optional(),
    fieldSide: z.number().optional(),
  })
  .passthrough();

export const Scores365LineupMemberSchema = z
  .object({
    id: z.number(),
    competitorId: z.number().optional(),
    athleteId: z.number().optional(),
    status: z.number().optional(),
    statusText: z.string().optional(),
    position: lineupMemberPositionSchema.optional(),
    formation: lineupMemberPositionSchema.optional(),
    yardFormation: lineupYardFormationSchema.optional(),
    ranking: z.number().optional(),
    hasStats: z.boolean().optional(),
    stats: z.array(lineupMemberStatSchema).optional(),
  })
  .passthrough();

export type Scores365LineupMember = z.infer<typeof Scores365LineupMemberSchema>;

const lineupSchema = z
  .object({
    formation: z.string().optional(),
    status: z.string().optional(),
    hasFieldPositions: z.boolean().optional(),
    members: z.array(Scores365LineupMemberSchema).optional(),
  })
  .passthrough();

const detailedCompetitorSchema = competitorSchema
  .extend({
    symbolicName: z.string().optional(),
    imageVersion: z.number().optional(),
    lineups: lineupSchema.optional(),
  })
  .passthrough();

export type Scores365Competitor = z.infer<typeof detailedCompetitorSchema>;

const eventTypeSchema = z
  .object({
    id: z.number().optional(),
    name: z.string().optional(),
    subTypeId: z.number().optional(),
    subTypeName: z.string().optional(),
  })
  .passthrough();

export const Scores365EventSchema = z
  .object({
    competitorId: z.number().optional(),
    gameTime: z.number().optional(),
    gameTimeDisplay: z.string().optional(),
    isMajor: z.boolean().optional(),
    playerId: z.number().optional(),
    extraPlayers: z.array(z.number()).optional(),
    eventType: eventTypeSchema.optional(),
  })
  .passthrough();

export type Scores365Event = z.infer<typeof Scores365EventSchema>;

const chartEventOutcomeSchema = z
  .object({
    id: z.number().optional(),
    name: z.string().optional(),
    y: z.number().optional(),
    z: z.number().optional(),
  })
  .passthrough();

const chartEventItemSchema = z
  .object({
    competitorNum: z.number().optional(),
    playerId: z.number().optional(),
    time: z.string().optional(),
    xg: z.union([z.string(), z.number()]).optional(),
    xgot: z.union([z.string(), z.number()]).optional(),
    bodyPart: z.string().optional(),
    line: z.number().optional(),
    side: z.number().optional(),
    outcome: chartEventOutcomeSchema.optional(),
  })
  .passthrough();

export const Scores365ChartEventsSchema = z
  .object({
    events: z.array(chartEventItemSchema).optional(),
  })
  .passthrough();

export type Scores365ChartEventItem = z.infer<typeof chartEventItemSchema>;

const topPerformerStatSchema = z
  .object({
    type: z.number().optional(),
    name: z.string().optional(),
    shortName: z.string().optional(),
    value: z.union([z.string(), z.number()]).optional(),
  })
  .passthrough();

const topPerformerPlayerSchema = z
  .object({
    id: z.number().optional(),
    athleteId: z.number().optional(),
    name: z.string().optional(),
    stats: z.array(topPerformerStatSchema).optional(),
  })
  .passthrough();

export const Scores365TopPerformerCategorySchema = z
  .object({
    name: z.string().optional(),
    homePlayer: topPerformerPlayerSchema.optional(),
    awayPlayer: topPerformerPlayerSchema.optional(),
  })
  .passthrough();

const topPerformersSchema = z
  .object({
    categories: z.array(Scores365TopPerformerCategorySchema).optional(),
  })
  .passthrough();

export type Scores365TopPerformerCategory = z.infer<typeof Scores365TopPerformerCategorySchema>;

const topLevelMemberSchema = z
  .object({
    id: z.number(),
    competitorId: z.number().optional(),
    athleteId: z.number().optional(),
    name: z.string().optional(),
    shortName: z.string().optional(),
    jerseyNumber: z.number().optional(),
    imageVersion: z.number().optional(),
  })
  .passthrough();

export const Scores365GameDetailedSchema = Scores365GameSchema.extend({
  competitionDisplayName: z.string().optional(),
  statusText: z.string().optional(),
  gameTime: z.number().optional(),
  gameTimeDisplay: z.string().optional(),
  homeCompetitor: detailedCompetitorSchema.optional(),
  awayCompetitor: detailedCompetitorSchema.optional(),
  events: z.array(Scores365EventSchema).optional(),
  chartEvents: Scores365ChartEventsSchema.optional(),
  topPerformers: topPerformersSchema.optional(),
  members: z.array(topLevelMemberSchema).optional(),
}).passthrough();

export type Scores365GameDetailed = z.infer<typeof Scores365GameDetailedSchema>;

export const Scores365GameDetailResponseSchema = z
  .object({
    game: Scores365GameDetailedSchema.optional(),
  })
  .passthrough();

export type Scores365GameDetailResponse = z.infer<typeof Scores365GameDetailResponseSchema>;
