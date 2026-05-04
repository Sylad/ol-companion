import { Scores365GameSchema, Scores365GamesResponseSchema } from './scores365-game.schema';

describe('Scores365GameSchema', () => {
  const valid = {
    id: 1,
    startTime: '2026-05-10T18:00:00Z',
    competitionId: 35,
    statusGroup: 4,
    stageNum: 6,
    homeCompetitor: { id: 465, name: 'Lyon', score: 2 },
    awayCompetitor: { id: 100, name: 'Lille', score: 1 },
  };

  it('accepts a minimal game (id + startTime)', () => {
    expect(() =>
      Scores365GameSchema.parse({ id: 1, startTime: '2026-01-01T00:00:00Z' }),
    ).not.toThrow();
  });

  it('rejects missing id', () => {
    const { id: _omit, ...incomplete } = valid;
    expect(() => Scores365GameSchema.parse(incomplete)).toThrow();
  });

  it('rejects missing startTime', () => {
    const { startTime: _omit, ...incomplete } = valid;
    expect(() => Scores365GameSchema.parse(incomplete)).toThrow();
  });

  it('passes through extra fields (hasLineups, etc.)', () => {
    const r = Scores365GameSchema.parse({ ...valid, hasLineups: true, foo: 'bar' });
    expect(r.id).toBe(1);
  });
});

describe('Scores365GamesResponseSchema', () => {
  it('accepts an empty response', () => {
    expect(() => Scores365GamesResponseSchema.parse({})).not.toThrow();
  });

  it('accepts response with games + paging', () => {
    const r = Scores365GamesResponseSchema.parse({
      games: [{ id: 1, startTime: '2026-01-01T00:00:00Z' }],
      paging: { previousPage: '/web/games/results/?page=2' },
    });
    expect(r.games).toHaveLength(1);
    expect(r.paging?.previousPage).toBe('/web/games/results/?page=2');
  });

  it('rejects games array with malformed game', () => {
    expect(() =>
      Scores365GamesResponseSchema.parse({ games: [{ id: 'not-a-number', startTime: 'x' }] }),
    ).toThrow();
  });
});
