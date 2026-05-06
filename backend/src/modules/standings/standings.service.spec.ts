import { sortByLfpRules } from './standings.service';

describe('sortByLfpRules', () => {
  it('sorts by points desc first', () => {
    const rows = [
      { team: 'A', points: 40, goalDifference: 0, goalsFor: 30 },
      { team: 'B', points: 60, goalDifference: -10, goalsFor: 20 },
      { team: 'C', points: 50, goalDifference: 5, goalsFor: 25 },
    ];
    expect(sortByLfpRules(rows).map((r) => r.team)).toEqual(['B', 'C', 'A']);
  });

  it('sorts by goal difference when points are equal', () => {
    const rows = [
      { team: 'Toulouse', points: 41, goalDifference: 0, goalsFor: 45 },
      { team: 'Paris FC', points: 41, goalDifference: -3, goalsFor: 44 },
    ];
    expect(sortByLfpRules(rows).map((r) => r.team)).toEqual(['Toulouse', 'Paris FC']);
  });

  it('sorts by goals for when points and GD are equal', () => {
    const rows = [
      { team: 'TeamA', points: 50, goalDifference: 5, goalsFor: 30 },
      { team: 'TeamB', points: 50, goalDifference: 5, goalsFor: 40 },
    ];
    expect(sortByLfpRules(rows).map((r) => r.team)).toEqual(['TeamB', 'TeamA']);
  });

  it('keeps stable order on perfect ties (points, GD, goals for all equal)', () => {
    // No H2H in this pure helper — we accept stable ordering as input order.
    const rows = [
      { team: 'A', points: 30, goalDifference: 0, goalsFor: 20 },
      { team: 'B', points: 30, goalDifference: 0, goalsFor: 20 },
    ];
    expect(sortByLfpRules(rows).map((r) => r.team)).toEqual(['A', 'B']);
  });

  it('does not mutate the input array', () => {
    const rows = [
      { team: 'A', points: 10, goalDifference: 0, goalsFor: 5 },
      { team: 'B', points: 20, goalDifference: 0, goalsFor: 5 },
    ];
    const before = rows.map((r) => r.team);
    sortByLfpRules(rows);
    expect(rows.map((r) => r.team)).toEqual(before);
  });

  it('reproduces the live Ligue 1 snapshot 2026-05-06 (J32) ordering', () => {
    // Curl 365scores 2026-05-06 — preserves the order observed live.
    const live = [
      { team: 'PSG', points: 70, goalDifference: 43, goalsFor: 70 },
      { team: 'Lens', points: 64, goalDifference: 28, goalsFor: 61 },
      { team: 'Lyon', points: 60, goalDifference: 18, goalsFor: 52 },
      { team: 'Lille', points: 58, goalDifference: 16, goalsFor: 51 },
      { team: 'Rennes', points: 56, goalDifference: 10, goalsFor: 56 },
      { team: 'Monaco', points: 54, goalDifference: 8, goalsFor: 56 },
      { team: 'OM', points: 53, goalDifference: 15, goalsFor: 59 },
      { team: 'Toulouse', points: 41, goalDifference: 0, goalsFor: 45 },
      { team: 'Paris FC', points: 41, goalDifference: -3, goalsFor: 44 },
    ];
    // Shuffle a bit to confirm we recover the LFP order
    const shuffled = [live[3], live[8], live[0], live[5], live[1], live[7], live[6], live[4], live[2]];
    expect(sortByLfpRules(shuffled).map((r) => r.team)).toEqual([
      'PSG', 'Lens', 'Lyon', 'Lille', 'Rennes', 'Monaco', 'OM', 'Toulouse', 'Paris FC',
    ]);
  });
});
