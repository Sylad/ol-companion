import { sortByLfpRules, computeCurrentMatchday } from './standings.service';
import type { LeagueGame } from './season-rankings';

describe('sortByLfpRules', () => {
  it('sorts by points desc first', () => {
    const rows = [
      { team: 'A', teamId: 101, points: 40, goalDifference: 0, goalsFor: 30 },
      { team: 'B', teamId: 102, points: 60, goalDifference: -10, goalsFor: 20 },
      { team: 'C', teamId: 103, points: 50, goalDifference: 5, goalsFor: 25 },
    ];
    expect(sortByLfpRules(rows).map((r) => r.team)).toEqual(['B', 'C', 'A']);
  });

  it('sorts by goal difference when points are equal', () => {
    const rows = [
      { team: 'Toulouse', teamId: 104, points: 41, goalDifference: 0, goalsFor: 45 },
      { team: 'Paris FC', teamId: 105, points: 41, goalDifference: -3, goalsFor: 44 },
    ];
    expect(sortByLfpRules(rows).map((r) => r.team)).toEqual(['Toulouse', 'Paris FC']);
  });

  it('sorts by goals for when points and GD are equal', () => {
    const rows = [
      { team: 'TeamA', teamId: 106, points: 50, goalDifference: 5, goalsFor: 30 },
      { team: 'TeamB', teamId: 107, points: 50, goalDifference: 5, goalsFor: 40 },
    ];
    expect(sortByLfpRules(rows).map((r) => r.team)).toEqual(['TeamB', 'TeamA']);
  });

  it('keeps stable order on perfect ties (points, GD, goals for all equal)', () => {
    // No H2H in this pure helper — we accept stable ordering as input order.
    const rows = [
      { team: 'A', teamId: 108, points: 30, goalDifference: 0, goalsFor: 20 },
      { team: 'B', teamId: 109, points: 30, goalDifference: 0, goalsFor: 20 },
    ];
    expect(sortByLfpRules(rows).map((r) => r.team)).toEqual(['A', 'B']);
  });

  it('does not mutate the input array', () => {
    const rows = [
      { team: 'A', teamId: 110, points: 10, goalDifference: 0, goalsFor: 5 },
      { team: 'B', teamId: 111, points: 20, goalDifference: 0, goalsFor: 5 },
    ];
    const before = rows.map((r) => r.team);
    sortByLfpRules(rows);
    expect(rows.map((r) => r.team)).toEqual(before);
  });

  it('reproduces the live Ligue 1 snapshot 2026-05-10 (one team ahead) ordering', () => {
    // Sanity check that a rescheduled-ahead Nantes does not perturb the
    // top of the table — it stays a function of points/GD/GF.
    const live = [
      { team: 'PSG', teamId: 112, points: 70, goalDifference: 43, goalsFor: 70 },
      { team: 'Lens', teamId: 113, points: 67, goalDifference: 29, goalsFor: 62 },
      { team: 'Lyon', teamId: 114, points: 60, goalDifference: 18, goalsFor: 52 },
      { team: 'Nantes', teamId: 115, points: 23, goalDifference: -23, goalsFor: 29 },
    ];
    expect(sortByLfpRules(live).map((r) => r.team)).toEqual(['PSG', 'Lens', 'Lyon', 'Nantes']);
  });

  it('reproduces the live Ligue 1 snapshot 2026-05-06 (J32) ordering', () => {
    // Curl 365scores 2026-05-06 — preserves the order observed live.
    const live = [
      { team: 'PSG', teamId: 116, points: 70, goalDifference: 43, goalsFor: 70 },
      { team: 'Lens', teamId: 117, points: 64, goalDifference: 28, goalsFor: 61 },
      { team: 'Lyon', teamId: 118, points: 60, goalDifference: 18, goalsFor: 52 },
      { team: 'Lille', teamId: 119, points: 58, goalDifference: 16, goalsFor: 51 },
      { team: 'Rennes', teamId: 120, points: 56, goalDifference: 10, goalsFor: 56 },
      { team: 'Monaco', teamId: 121, points: 54, goalDifference: 8, goalsFor: 56 },
      { team: 'OM', teamId: 122, points: 53, goalDifference: 15, goalsFor: 59 },
      { team: 'Toulouse', teamId: 123, points: 41, goalDifference: 0, goalsFor: 45 },
      { team: 'Paris FC', teamId: 124, points: 41, goalDifference: -3, goalsFor: 44 },
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

describe('sortByLfpRules — confrontations directes (L243)', () => {
  const game = (roundNum: number, home: [number, number], away: [number, number]): LeagueGame => ({
    roundNum,
    statusGroup: 4,
    home: { id: home[0], score: home[1] },
    away: { id: away[0], score: away[1] },
  });
  // Même total de points et même différence de buts ; A a plus de buts marqués, B a battu A.
  const rows = [
    { team: 'A', teamId: 1, points: 6, goalDifference: 2, goalsFor: 6, won: 2 },
    { team: 'B', teamId: 2, points: 6, goalDifference: 2, goalsFor: 4, won: 2 },
  ];
  const b2a1 = [game(1, [2, 2], [1, 1])];

  it('confrontations directes avant les buts marqués : B devant A malgré moins de buts', () => {
    expect(sortByLfpRules(rows, b2a1).map((r) => r.team)).toEqual(['B', 'A']);
  });

  it('sans résultats à croiser, retombe sur les buts marqués', () => {
    expect(sortByLfpRules(rows, []).map((r) => r.team)).toEqual(['A', 'B']);
  });

  it('les confrontations directes ne comptent que les clubs à égalité de points et de différence', () => {
    const three = [...rows, { team: 'C', teamId: 3, points: 6, goalDifference: 1, goalsFor: 9, won: 2 }];
    // C a battu B mais n'est pas à égalité de différence de buts : sans effet sur A/B.
    const games = [game(1, [2, 0], [1, 1]), game(2, [3, 5], [2, 0])];
    expect(sortByLfpRules(three, games).map((r) => r.team)).toEqual(['A', 'B', 'C']);
  });

  it("l'OL (teamId interne) est retrouvé dans les résultats par son identifiant 365scores", () => {
    const ol = [
      { team: 'OL', teamId: 523, points: 6, goalDifference: 2, goalsFor: 4, won: 2 },
      { team: 'X', teamId: 9, points: 6, goalDifference: 2, goalsFor: 6, won: 2 },
    ];
    const games = [game(1, [465, 3], [9, 0])];
    expect(sortByLfpRules(ol, games, (r) => (r.teamId === 523 ? 465 : r.teamId)).map((r) => r.team)).toEqual(['OL', 'X']);
  });

  it('victoires départagent après les buts marqués', () => {
    const w = [
      { team: 'A', teamId: 1, points: 6, goalDifference: 2, goalsFor: 6, won: 1 },
      { team: 'B', teamId: 2, points: 6, goalDifference: 2, goalsFor: 6, won: 2 },
    ];
    expect(sortByLfpRules(w, []).map((r) => r.team)).toEqual(['B', 'A']);
  });
});
