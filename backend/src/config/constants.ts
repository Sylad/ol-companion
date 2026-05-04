/**
 * Centralized OL & Ligue 1 IDs across data sources.
 *
 * 365scores and football-data.org use different team/competition IDs.
 * Frontend keeps the football-data ID as canonical (`OL_TEAM_ID`) for
 * historical reasons; we translate at the standings boundary.
 */

/** 365scores team competitor id for Olympique Lyonnais. */
export const OL_365SCORES_ID = 465;

/** football-data.org team id for Olympique Lyonnais. Used as the canonical id on the frontend. */
export const OL_TEAM_ID = 523;

/** 365scores competition id for Ligue 1. */
export const LIGUE1_365SCORES_ID = 35;

/** football-data.org competition id for Ligue 1. */
export const LIGUE1_FOOTBALL_DATA_ID = 2015;

/** 365scores competition id for Coupe de France. */
export const COUPE_DE_FRANCE_365SCORES_ID = 37;

/** 365scores competition id for Europa League. */
export const EUROPA_LEAGUE_365SCORES_ID = 573;
