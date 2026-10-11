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

  it('R8 — le staff (poste id 0) et un joueur sans poste connu ne sont pas dans l’effectif', async () => {
    const squads = {
      squads: [
        {
          competitorId: 5061,
          athletes: [
            { id: 3, name: 'Rabiot', age: 31, position: { id: 3, name: 'Milieu de Terrain' } },
            { id: 8, name: 'Zinedine Zidane', age: 54, position: { id: 0 } },
            { id: 9, name: 'Sans Poste', age: 20, position: { id: 99 } },
            { id: 10, name: 'Sans Position', age: 20 },
          ],
        },
      ],
    };
    const { squad } = await service({ squads: () => squads }).svc.getFrance();
    expect(squad).toEqual([{ id: 3, name: 'Rabiot', position: 'Midfielder', age: 31 }]);
  });

  it('R4 — les trois lectures 365scores demandent le français (langId=15)', async () => {
    const { svc, urls } = service();
    await svc.getFrance();
    expect(urls.length).toBe(3);
    for (const u of urls) {
      expect(u).toContain('langId=15');
      expect(u).not.toContain('langId=1&');
    }
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

  it('L118 — un 200 sans « games » (résultats) n’est pas gardé : 503 sans copie, copie périmée sinon', async () => {
    const T0 = Date.now();
    await expect(service({ results: () => ({}) }).svc.getFrance()).rejects.toBeInstanceOf(ServiceUnavailableException);
    const { svc } = service();
    const first = await svc.getFrance();
    let degraded = true;
    const ok = svc.fetcher;
    svc.fetcher = ((url: string, init: never) => (degraded ? Promise.resolve({ ok: true, status: 200, json: async () => ({}) }) : (ok as any)(url, init))) as never;
    jest.setSystemTime(new Date(T0 + 11 * 60 * 1000));
    expect(await svc.getFrance()).toEqual(first);
    degraded = false;
    jest.setSystemTime(new Date(T0 + 13 * 60 * 1000));
    expect((await svc.getFrance()).results).toHaveLength(5);
  });

  it('L118 — un 200 sans « games » côté matchs à venir n’est pas gardé 10 min', async () => {
    const T0 = Date.now();
    const { svc, urls } = service({ fixtures: () => ({}) });
    expect((await svc.getFrance()).nextMatch).toBeNull();
    const n = urls.length;
    jest.setSystemTime(new Date(T0 + 2 * 60 * 1000));
    await svc.getFrance();
    expect(urls.length).toBeGreaterThan(n);
  });

  it('L118 — copie périmée servie quand 365scores est en panne : réhorodatée, pas de nouvelle rafale à chaque requête', async () => {
    const T0 = Date.now();
    const { svc } = service();
    await svc.getFrance();
    let calls = 0;
    svc.fetcher = (async () => {
      calls++;
      throw new Error('boom');
    }) as never;
    jest.setSystemTime(new Date(T0 + 11 * 60 * 1000));
    await svc.getFrance();
    const afterFirst = calls;
    expect(afterFirst).toBe(3 * 2);
    await svc.getFrance();
    await svc.getFrance();
    expect(calls).toBe(afterFirst);
    jest.setSystemTime(new Date(T0 + 13 * 60 * 1000));
    await svc.getFrance();
    expect(calls).toBeGreaterThan(afterFirst);
  });

  it('L118 — âge absent : null, jamais 0', async () => {
    const T0 = Date.now();
    const squads = { squads: [{ competitorId: 5061, athletes: [{ id: 3, name: 'Rabiot', position: { id: 3 } }] }] };
    expect((await service({ squads: () => squads }).svc.getFrance()).squad).toEqual([{ id: 3, name: 'Rabiot', position: 'Midfielder', age: null }]);
  });
});
