import { ServiceUnavailableException } from '@nestjs/common';
import { FranceService } from './france.service';

// Horloge figée : la règle des 14 jours (R7 de la fiche L113) en dépend.
const NOW = new Date('2026-10-11T12:00:00Z');
beforeAll(() => {
  jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'setTimeout', 'setInterval', 'queueMicrotask'] as never, now: NOW });
});
afterAll(() => jest.useRealTimers());

const FR = { id: 5061, name: 'France' };
const game = (id: number, startTime: string, home: any, away: any, extra: Record<string, unknown> = {}) => ({
  id,
  startTime,
  competitionDisplayName: 'UEFA WC Qualification',
  homeCompetitor: home,
  awayCompetitor: away,
  ...extra,
});
const RESULTS = {
  games: [
    game(1, '2026-10-05T20:45:00+02:00', { ...FR, score: 4 }, { id: 2373, name: 'Belgium', score: 1 }),
    game(2, '2026-10-02T20:45:00+02:00', { id: 5047, name: 'Turkiye', score: 0 }, { ...FR, score: 1 }),
    game(3, '2026-09-28T20:45:00+02:00', { ...FR, score: 1 }, { id: 4, name: 'Italy', score: 1 }),
    game(4, '2026-09-25T20:45:00+02:00', { ...FR, score: 2 }, { id: 5, name: 'Spain', score: 0 }),
    game(5, '2026-09-20T20:45:00+02:00', { ...FR, score: 2 }, { id: 6, name: 'Chile', score: 0 }),
    game(6, '2026-09-10T20:45:00+02:00', { ...FR, score: 2 }, { id: 7, name: 'Peru', score: 0 }),
  ],
};
const FIXTURES = {
  games: [
    game(10, '2026-10-14T20:45:00+02:00', { ...FR, score: -1 }, { id: 8, name: 'Iceland', score: -1 }),
    game(11, '2026-11-15T20:45:00+01:00', { ...FR, score: -1 }, { id: 9, name: 'Wales', score: -1 }),
  ],
};
const SQUAD = {
  squads: [
    {
      competitorId: 5061,
      athletes: [
        { id: 1, name: 'Mike Maignan', age: 31, jerseyNum: -1, position: { id: 1, name: 'Goalkeeper' } },
        { id: 2, name: 'Kylian Mbappé', age: 27, jerseyNum: -1, position: { id: 4, name: 'Attacker' } },
      ],
    },
  ],
};

function service(overrides: Partial<Record<'results' | 'fixtures' | 'squads', () => unknown>> = {}) {
  const svc = new FranceService();
  const urls: string[] = [];
  svc.fetcher = (async (url: string) => {
    urls.push(String(url));
    const kind = String(url).includes('/results/') ? 'results' : String(url).includes('/fixtures/') ? 'fixtures' : 'squads';
    const body = overrides[kind] ? overrides[kind]!() : { results: RESULTS, fixtures: FIXTURES, squads: SQUAD }[kind];
    if (body instanceof Error) throw body;
    return { ok: true, status: 200, json: async () => body };
  }) as never;
  svc.retryDelayMs = 0;
  return { svc, urls };
}

describe('FranceService', () => {
  it('lit les trois endpoints 365scores de l’équipe de France A (5061)', async () => {
    const { svc, urls } = service();
    await svc.getFrance();
    expect(urls).toHaveLength(3);
    expect(urls.every((u) => u.includes('5061'))).toBe(true);
  });

  it('R5 — garde les 5 matchs joués les plus récents, du plus récent au plus ancien, vus domicile/extérieur', async () => {
    const { svc } = service();
    const { results } = await svc.getFrance();
    expect(results.map((r) => r.id)).toEqual([1, 2, 3, 4, 5]);
    expect(results[1]).toMatchObject({ home: { id: 5047, name: 'Turkiye' }, away: { id: 5061 }, homeScore: 0, awayScore: 1, franceIsHome: false });
    expect(results[0]).toMatchObject({ franceIsHome: true, homeScore: 4, awayScore: 1, competition: 'UEFA WC Qualification' });
  });

  it('prochain match = le premier à venir ; null sans match à venir', async () => {
    expect((await service().svc.getFrance()).nextMatch).toMatchObject({ id: 10, away: { name: 'Iceland' } });
    const { svc } = service({ fixtures: () => ({ games: [] }) });
    expect((await svc.getFrance()).nextMatch).toBeNull();
  });

  it('R7 — l’heure est tenue pour fixée dans les 14 prochains jours, non fixée au-delà', async () => {
    const { svc } = service();
    expect((await svc.getFrance()).nextMatch?.timeConfirmed).toBe(true);
    const far = service({ fixtures: () => ({ games: [FIXTURES.games[1]] }) });
    expect((await far.svc.getFrance()).nextMatch?.timeConfirmed).toBe(false);
  });

  it('R8 — effectif : nom, poste, âge, sans numéro', async () => {
    const { squad } = await service().svc.getFrance();
    expect(squad).toEqual([
      { id: 1, name: 'Mike Maignan', position: 'Goalkeeper', age: 31 },
      { id: 2, name: 'Kylian Mbappé', position: 'Attacker', age: 27 },
    ]);
  });

  it('un appel en échec sans copie en mémoire : 503, jamais une réponse vide', async () => {
    const { svc } = service({ squads: () => new Error('boom') });
    await expect(svc.getFrance()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('un appel en échec après un succès : la dernière réponse connue est rendue', async () => {
    const { svc } = service();
    const first = await svc.getFrance();
    svc.fetcher = (async () => {
      throw new Error('boom');
    }) as never;
    jest.setSystemTime(new Date(NOW.getTime() + 60 * 60 * 1000));
    expect(await svc.getFrance()).toEqual(first);
  });

  it('la réponse est gardée en mémoire : un second appel proche ne relit pas 365scores', async () => {
    const { svc, urls } = service();
    await svc.getFrance();
    await svc.getFrance();
    expect(urls).toHaveLength(3);
  });
});
