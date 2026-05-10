import { OL_TEAM_ID } from '../../config/constants';
import type { SeasonMatch } from './season-matches.service';

/**
 * Team-level cumulative season stats for OL, derived from the
 * `season-matches-cache` source-of-truth. Each match scoreline already
 * suffices to compute matches/wins/draws/losses/goals/clean sheets, so
 * we don't need extra API calls.
 *
 * Per-competition breakdown lets the UI display a small chip strip
 * ("L1 28 · CdF 4 · UEL 7") next to the headline figures.
 */

export type CompetitionCode = SeasonMatch['competitionCode'];

export interface PerCompetitionStats {
  competitionCode: CompetitionCode;
  played: number;
  won: number;
  draw: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  cleanSheets: number;
  points: number;
}

export interface TeamSeasonChartPoint {
  /** 1-based index of finished match across all competitions, sorted by date. */
  matchIndex: number;
  /** ISO date of the match. */
  date: string;
  /** Cumulative goal-difference after this match. */
  goalDifference: number;
  /** Cumulative points (for L1 only) after this match. Null for non-L1 matches. */
  points: number | null;
  competitionCode: CompetitionCode;
  /** Result for the match (W/D/L) — drives chart dot colour. */
  result: 'W' | 'D' | 'L';
}

export interface TeamSeasonStats {
  /** Total matches played across L1 + Coupe de France + Europa. */
  played: number;
  won: number;
  draw: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  goalsForPerMatch: number;
  goalsAgainstPerMatch: number;
  cleanSheets: number;
  /** % of finished matches without conceding (0..100). */
  cleanSheetRate: number;
  winRate: number;
  perCompetition: PerCompetitionStats[];
  chart: TeamSeasonChartPoint[];
}

function emptyPerComp(code: CompetitionCode): PerCompetitionStats {
  return {
    competitionCode: code,
    played: 0,
    won: 0,
    draw: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    cleanSheets: 0,
    points: 0,
  };
}

const COMP_ORDER: CompetitionCode[] = ['L1', 'CDF', 'UEL', 'OTHER'];

/**
 * Pure helper, easy to unit-test. Walks `matches` in date order and folds
 * each FINISHED match into the running totals + chart points.
 */
export function computeTeamSeasonStats(matches: SeasonMatch[]): TeamSeasonStats {
  const finished = matches
    .filter((m) => m.status === 'FINISHED' && m.homeScore !== null && m.awayScore !== null)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const stats: TeamSeasonStats = {
    played: 0,
    won: 0,
    draw: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
    goalsForPerMatch: 0,
    goalsAgainstPerMatch: 0,
    cleanSheets: 0,
    cleanSheetRate: 0,
    winRate: 0,
    perCompetition: [],
    chart: [],
  };

  const perComp = new Map<CompetitionCode, PerCompetitionStats>();
  let cumulativeGD = 0;
  let cumulativeL1Points = 0;

  for (const m of finished) {
    const olIsHome = m.homeTeamId === OL_TEAM_ID;
    const olGoals = (olIsHome ? m.homeScore : m.awayScore) ?? 0;
    const opponentGoals = (olIsHome ? m.awayScore : m.homeScore) ?? 0;

    const result: 'W' | 'D' | 'L' =
      olGoals > opponentGoals ? 'W' : olGoals < opponentGoals ? 'L' : 'D';
    const isCleanSheet = opponentGoals === 0;

    stats.played += 1;
    stats.goalsFor += olGoals;
    stats.goalsAgainst += opponentGoals;
    if (result === 'W') stats.won += 1;
    else if (result === 'D') stats.draw += 1;
    else stats.lost += 1;
    if (isCleanSheet) stats.cleanSheets += 1;

    const code = m.competitionCode;
    const bucket = perComp.get(code) ?? emptyPerComp(code);
    bucket.played += 1;
    bucket.goalsFor += olGoals;
    bucket.goalsAgainst += opponentGoals;
    if (result === 'W') bucket.won += 1;
    else if (result === 'D') bucket.draw += 1;
    else bucket.lost += 1;
    if (isCleanSheet) bucket.cleanSheets += 1;
    if (code === 'L1') {
      bucket.points += result === 'W' ? 3 : result === 'D' ? 1 : 0;
      cumulativeL1Points = bucket.points;
    }
    perComp.set(code, bucket);

    cumulativeGD += olGoals - opponentGoals;

    stats.chart.push({
      matchIndex: stats.played,
      date: m.date,
      goalDifference: cumulativeGD,
      points: code === 'L1' ? cumulativeL1Points : null,
      competitionCode: code,
      result,
    });
  }

  stats.goalDifference = stats.goalsFor - stats.goalsAgainst;
  stats.goalsForPerMatch = stats.played > 0 ? stats.goalsFor / stats.played : 0;
  stats.goalsAgainstPerMatch = stats.played > 0 ? stats.goalsAgainst / stats.played : 0;
  stats.cleanSheetRate = stats.played > 0 ? (stats.cleanSheets / stats.played) * 100 : 0;
  stats.winRate = stats.played > 0 ? (stats.won / stats.played) * 100 : 0;

  // Stable ordering for the UI chip strip.
  stats.perCompetition = COMP_ORDER.map((c) => perComp.get(c)).filter(
    (b): b is PerCompetitionStats => !!b,
  );

  return stats;
}
