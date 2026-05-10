import { sortByLfpRules, computeCurrentMatchday, isRoundComplete } from './standings.service';

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

  it('reproduces the live Ligue 1 snapshot 2026-05-10 (one team ahead) ordering', () => {
    // Sanity check that a rescheduled-ahead Nantes does not perturb the
    // top of the table — it stays a function of points/GD/GF.
    const live = [
      { team: 'PSG', points: 70, goalDifference: 43, goalsFor: 70 },
      { team: 'Lens', points: 67, goalDifference: 29, goalsFor: 62 },
      { team: 'Lyon', points: 60, goalDifference: 18, goalsFor: 52 },
      { team: 'Nantes', points: 23, goalDifference: -23, goalsFor: 29 },
    ];
    expect(sortByLfpRules(live).map((r) => r.team)).toEqual(['PSG', 'Lens', 'Lyon', 'Nantes']);
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

describe('computeCurrentMatchday', () => {
  it('returns 0 for an empty league', () => {
    expect(computeCurrentMatchday([])).toBe(0);
  });

  it('returns the unique matchday when every team is aligned', () => {
    expect(computeCurrentMatchday(Array(18).fill(30))).toBe(30);
  });

  it('returns the mode when one team is rescheduled-ahead (real-world Nantes case)', () => {
    // 2026-05-10 snapshot: Nantes played 33, others mostly 32, a few 31.
    const counts = [31, 32, 32, 32, 32, 32, 32, 31, 32, 32, 32, 31, 32, 32, 32, 32, 33, 32];
    expect(computeCurrentMatchday(counts)).toBe(32);
  });

  it('prefers the higher matchday on a tie (more recent round wins)', () => {
    expect(computeCurrentMatchday([30, 30, 31, 31])).toBe(31);
  });

  it('handles an asymmetric distribution where most teams are behind', () => {
    // Mid-week: just two teams played MD33 ahead, rest at MD32.
    const counts = [32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 32, 33, 33];
    expect(computeCurrentMatchday(counts)).toBe(32);
  });
});

describe('isRoundComplete', () => {
  it('returns false for an empty league', () => {
    expect(isRoundComplete([], 0)).toBe(false);
  });

  it('returns true when 18/18 teams are aligned', () => {
    expect(isRoundComplete(Array(18).fill(30), 30)).toBe(true);
  });

  it('returns true when one team is rescheduled-ahead — no longer freezes the tracker', () => {
    // The exact bug Sylvain reported 2026-05-10: 17 teams at MD32, Nantes at MD33.
    // The mode-based currentMatchday is 32, and 17/18 ≥ 14 → round complete.
    const counts = [31, 32, 32, 32, 32, 32, 32, 31, 32, 32, 32, 31, 32, 32, 32, 32, 33, 32];
    // 14 teams at 32 → above the 14/18 threshold (75%).
    expect(isRoundComplete(counts, 32)).toBe(true);
  });

  it('returns false during a round that is genuinely mid-flight', () => {
    // 5 teams at MD32, 13 at MD31 — round 32 not played by anyone yet meaningfully.
    const counts = [31, 31, 31, 31, 31, 31, 31, 31, 31, 31, 31, 31, 31, 32, 32, 32, 32, 32];
    expect(isRoundComplete(counts, 32)).toBe(false);
  });

  it('returns false when currentMatchday is non-positive', () => {
    expect(isRoundComplete([0, 0, 0], 0)).toBe(false);
  });
});
