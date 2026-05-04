import { Scores365StandingsResponseSchema } from './standings.schema';

describe('Scores365StandingsResponseSchema', () => {
  const validRow = {
    position: 1,
    competitor: { id: 465, name: 'Lyon' },
    gamePlayed: 30,
    gamesWon: 18,
    gamesEven: 6,
    gamesLost: 6,
    for: 60,
    against: 30,
    points: 60,
    recentForm: [1, 0, 1, 2, 1],
  };

  const validResponse = {
    standings: [{ isCurrentStage: true, seasonNum: 2026, rows: [validRow] }],
    competitions: [{ seasons: [{ num: 2026, name: '2025/2026' }] }],
  };

  it('accepts a minimal valid response', () => {
    const r = Scores365StandingsResponseSchema.parse(validResponse);
    expect(r.standings?.[0].rows?.[0].competitor.id).toBe(465);
  });

  it('accepts an empty response (all fields optional at top level)', () => {
    expect(() => Scores365StandingsResponseSchema.parse({})).not.toThrow();
  });

  it('rejects competitor without id', () => {
    expect(() =>
      Scores365StandingsResponseSchema.parse({
        standings: [{ rows: [{ position: 1, competitor: { name: 'Lyon' } }] }],
      }),
    ).toThrow();
  });

  it('rejects row without position', () => {
    expect(() =>
      Scores365StandingsResponseSchema.parse({
        standings: [{ rows: [{ competitor: { id: 465 } }] }],
      }),
    ).toThrow();
  });

  it('passes through unknown extra fields (forward-compat with 365scores)', () => {
    const r = Scores365StandingsResponseSchema.parse({
      ...validResponse,
      anUnknownField: 'whatever',
      standings: [{ ...validResponse.standings[0], somethingNew: 42 }],
    });
    expect(r.standings?.[0].rows).toHaveLength(1);
  });
});
