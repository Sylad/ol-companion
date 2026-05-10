import { computeTeamSeasonStats } from './team-stats';
import type { SeasonMatch } from './season-matches.service';
import { OL_TEAM_ID } from '../../config/constants';

function fixture(partial: Partial<SeasonMatch> & { date: string }): SeasonMatch {
  return {
    id: Math.floor(Math.random() * 1_000_000),
    homeTeam: 'Lyon',
    homeTeamId: OL_TEAM_ID,
    awayTeam: 'Rennes',
    awayTeamId: 477,
    homeScore: 1,
    awayScore: 0,
    competition: 'Ligue 1',
    competitionCode: 'L1',
    competitionId: 35,
    status: 'FINISHED',
    matchday: null,
    ...partial,
  };
}

describe('computeTeamSeasonStats', () => {
  it('returns zeroed totals when no finished match', () => {
    const stats = computeTeamSeasonStats([
      fixture({ date: '2026-05-10T20:00:00Z', status: 'SCHEDULED', homeScore: null, awayScore: null }),
    ]);
    expect(stats.played).toBe(0);
    expect(stats.won).toBe(0);
    expect(stats.cleanSheetRate).toBe(0);
    expect(stats.chart).toEqual([]);
  });

  it('counts wins/draws/losses from OL perspective regardless of home/away', () => {
    const matches = [
      // Home win 2-1
      fixture({ date: '2026-04-01', homeScore: 2, awayScore: 1 }),
      // Away win 0-2 (OL away)
      fixture({
        date: '2026-04-08',
        homeTeam: 'Brest',
        homeTeamId: 522,
        awayTeam: 'Lyon',
        awayTeamId: OL_TEAM_ID,
        homeScore: 0,
        awayScore: 2,
      }),
      // Draw 1-1
      fixture({ date: '2026-04-15', homeScore: 1, awayScore: 1 }),
      // Home loss 0-1
      fixture({ date: '2026-04-22', homeScore: 0, awayScore: 1 }),
    ];
    const stats = computeTeamSeasonStats(matches);
    expect(stats.played).toBe(4);
    expect(stats.won).toBe(2);
    expect(stats.draw).toBe(1);
    expect(stats.lost).toBe(1);
    expect(stats.goalsFor).toBe(5); // 2 + 2 + 1 + 0
    expect(stats.goalsAgainst).toBe(3); // 1 + 0 + 1 + 1
    expect(stats.goalDifference).toBe(2);
    expect(stats.cleanSheets).toBe(1); // away win 0-2 only
  });

  it('breaks down per competition with L1 points only on L1 matches', () => {
    const matches = [
      fixture({ date: '2026-04-01', homeScore: 1, awayScore: 0, competitionCode: 'L1', competitionId: 35 }),
      fixture({ date: '2026-04-08', homeScore: 0, awayScore: 0, competitionCode: 'L1', competitionId: 35 }),
      fixture({
        date: '2026-04-15',
        homeScore: 3,
        awayScore: 1,
        competitionCode: 'CDF',
        competitionId: 37,
        competition: 'Coupe de France',
      }),
    ];
    const stats = computeTeamSeasonStats(matches);
    const l1 = stats.perCompetition.find((p) => p.competitionCode === 'L1');
    const cdf = stats.perCompetition.find((p) => p.competitionCode === 'CDF');
    expect(l1?.played).toBe(2);
    expect(l1?.points).toBe(4); // 3 (W) + 1 (D)
    expect(cdf?.played).toBe(1);
    expect(cdf?.points).toBe(0); // points only tracked for L1
  });

  it('builds a chart with monotonic matchIndex and cumulative goal-difference', () => {
    const matches = [
      fixture({ date: '2026-04-01', homeScore: 2, awayScore: 0 }), // +2
      fixture({ date: '2026-04-08', homeScore: 1, awayScore: 3 }), // -2 → 0 cumul
      fixture({ date: '2026-04-15', homeScore: 1, awayScore: 0 }), // +1 → +1
    ];
    const stats = computeTeamSeasonStats(matches);
    expect(stats.chart.map((p) => p.matchIndex)).toEqual([1, 2, 3]);
    expect(stats.chart.map((p) => p.goalDifference)).toEqual([2, 0, 1]);
    expect(stats.chart.map((p) => p.result)).toEqual(['W', 'L', 'W']);
    // L1 cumulative points: 3, 3, 6
    expect(stats.chart.map((p) => p.points)).toEqual([3, 3, 6]);
  });

  it('sorts matches by date ascending even if input is reversed', () => {
    const matches = [
      fixture({ date: '2026-04-15', homeScore: 1, awayScore: 0 }),
      fixture({ date: '2026-04-01', homeScore: 2, awayScore: 0 }),
    ];
    const stats = computeTeamSeasonStats(matches);
    expect(stats.chart[0].date).toBe('2026-04-01');
    expect(stats.chart[1].date).toBe('2026-04-15');
  });
});
