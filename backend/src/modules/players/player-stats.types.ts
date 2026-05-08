/**
 * Per-player season totals derived from per-match `members[].stats` payloads
 * served by 365scores. The same lineup data the live-match aggregator already
 * consumes is replayed across every season match so we get cumulative figures
 * without a second data source.
 */

export interface PlayerByMatch {
  /** 365scores game id of the match (links to /match/:gameId). */
  gameId: number;
  /** ISO date of kickoff. */
  date: string;
  /** Opponent display name (e.g. "Rennes"). */
  opponent: string;
  /** Whether OL was the home side. */
  isHome: boolean;
  /** OL goals scored in the match. */
  olScore: number | null;
  /** Opponent goals scored in the match. */
  opponentScore: number | null;
  /** Match result from OL's perspective. null when not finished. */
  result: 'W' | 'D' | 'L' | null;
  /** Stable competition code (L1, CDF, UEL). */
  competitionCode: 'L1' | 'CDF' | 'UEL' | 'OTHER';

  // Per-match player stats
  minutes: number;
  goals: number;
  assists: number;
  shots: number;
  shotsOnTarget: number;
  yellowCards: number;
  redCards: number;
  /** 365scores member ranking (0..10), null if absent. */
  rating: number | null;
  /** Whether the player was a starter for this match (vs. came in off the bench). */
  isStarter: boolean;
}

export interface PlayerSeasonStats {
  athleteId: number;
  /** 365scores member id (lineup `members[].id`). */
  memberId: number;
  name: string;
  shortName: string;
  jerseyNumber: number | null;
  /** Long position label (e.g. "Attaquant"). */
  position: string;
  /** Short position code (e.g. "ST"). Inferred from latest appearance. */
  positionShort: string;
  /** 365scores image version for /Athletes/:athleteId photo URL. */
  imageVersion: number | null;

  matchesPlayed: number;
  matchesStarted: number;
  minutesPlayed: number;

  goals: number;
  assists: number;
  /** goals + assists. Convenience field for sorting. */
  goalContributions: number;

  shots: number;
  shotsOnTarget: number;
  /** 0..100, derived from aggregated shotsOnTarget / shots (or 0 if no shots). */
  shotAccuracy: number;

  yellowCards: number;
  redCards: number;

  /** Average ranking (0..10) across matches where ranking was provided. null otherwise. */
  averageRating: number | null;

  /** Per-match breakdown sorted by date ASC. Powers sparklines + table. */
  byMatch: PlayerByMatch[];
}
