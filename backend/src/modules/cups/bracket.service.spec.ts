import { BracketService } from './bracket.service';

const sample365 = (overrides: Partial<any> = {}) => ({
  id: 1,
  startTime: '2026-04-15T19:00:00Z',
  statusGroup: 4,
  stageNum: 6,
  homeCompetitor: { id: 100, name: 'Lille', score: 0 },
  awayCompetitor: { id: 465, name: 'Lyon', score: 2 },
  ...overrides,
});

describe('BracketService.fetchBracket', () => {
  let service: BracketService;
  beforeEach(() => { service = new BracketService(); });

  function withFetch(games: any[]) {
    (global as any).fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ games }),
    });
  }

  it('returns null when no match meets the stage threshold', async () => {
    withFetch([sample365({ stageNum: 4 })]);
    const result = await service.fetchBracket(37, 6, new Date('2025-08-01'));
    expect(result).toBeNull();
  });

  it('groups CdF matches from quarter-finals onward into stages', async () => {
    withFetch([
      sample365({ id: 1, stageNum: 6 }),
      sample365({ id: 2, stageNum: 6, homeCompetitor: { id: 200, name: 'PSG' }, awayCompetitor: { id: 300, name: 'Nice' } }),
      sample365({ id: 3, stageNum: 7 }),
      sample365({ id: 4, stageNum: 8 }),
    ]);
    const r = await service.fetchBracket(37, 6, new Date('2025-08-01'));
    expect(r).not.toBeNull();
    expect(r!.fromStageNum).toBe(6);
    expect(r!.stages.map((s) => s.stageNum)).toEqual([6, 7, 8]);
    expect(r!.stages[0].matches).toHaveLength(2);
    expect(r!.stages[0].matches[0].hasOL).toBe(true);
    expect(r!.stages[0].matches[1].hasOL).toBe(false);
  });

  it('continues to expose bracket after OL is eliminated', async () => {
    withFetch([
      sample365({ id: 1, stageNum: 6, homeCompetitor: { id: 100, name: 'Lille', score: 1 }, awayCompetitor: { id: 465, name: 'Lyon', score: 0 } }),
      sample365({ id: 2, stageNum: 7, homeCompetitor: { id: 100, name: 'Lille' }, awayCompetitor: { id: 200, name: 'PSG' } }),
    ]);
    const r = await service.fetchBracket(37, 6, new Date('2025-08-01'));
    expect(r).not.toBeNull();
    expect(r!.stages.map((s) => s.stageNum)).toEqual([6, 7]);
    expect(r!.stages[1].matches[0].hasOL).toBe(false);
  });

  it('filters out matches before season start', async () => {
    withFetch([
      sample365({ id: 1, stageNum: 6, startTime: '2025-04-15T19:00:00Z' }),
      sample365({ id: 2, stageNum: 6, startTime: '2026-04-15T19:00:00Z' }),
    ]);
    const r = await service.fetchBracket(37, 6, new Date('2025-08-01'));
    expect(r!.stages[0].matches).toHaveLength(1);
    expect(r!.stages[0].matches[0].id).toBe(2);
  });

  it('labels EL stages from round of 16 (stageNum 3) onward', async () => {
    withFetch([
      sample365({ stageNum: 3 }),
      sample365({ stageNum: 4 }),
      sample365({ stageNum: 5 }),
      sample365({ stageNum: 6 }),
    ]);
    const r = await service.fetchBracket(573, 3, new Date('2025-08-01'));
    expect(r!.stages.map((s) => s.stageFr)).toEqual([
      '1/8 de finale',
      '1/4 de finale',
      'Demi-finale',
      'Finale',
    ]);
  });
});
