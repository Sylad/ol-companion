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
    expect(r.standings?.[0].rows?.[0].competitor?.id).toBe(465);
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

  it('accepts a row without competitor (degraded 365scores render, L35) and keeps who played its games', () => {
    const r = Scores365StandingsResponseSchema.parse({
      standings: [
        {
          rows: [
            {
              position: 3,
              points: 11,
              detailedRecentForm: [
                { homeCompetitor: { id: 6075, name: 'Paris FC' }, awayCompetitor: { id: 479, name: 'Strasbourg' } },
              ],
              nextMatch: { homeCompetitor: { id: 472, name: 'Lorient' }, awayCompetitor: { id: 6075, name: 'Paris FC' } },
            },
          ],
        },
      ],
    });
    const row = r.standings?.[0].rows?.[0];
    expect(row?.competitor).toBeUndefined();
    expect(row?.detailedRecentForm?.[0].homeCompetitor?.id).toBe(6075);
    expect(row?.nextMatch?.awayCompetitor?.name).toBe('Paris FC');
  });

  it('never rejects a response because of the shape of a row\'s games', () => {
    const r = Scores365StandingsResponseSchema.parse({
      standings: [
        {
          rows: [
            { ...validRow, detailedRecentForm: 'n/a', nextMatch: { homeCompetitor: { name: 'no id' } } },
          ],
        },
      ],
    });
    const row = r.standings?.[0].rows?.[0];
    expect(row?.competitor?.id).toBe(465);
    expect(row?.detailedRecentForm).toBeUndefined();
    expect(row?.nextMatch).toBeUndefined();
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
