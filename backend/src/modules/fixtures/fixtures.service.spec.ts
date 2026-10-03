import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ConfigService } from '@nestjs/config';
import { FixturesService } from './fixtures.service';
import { footballDataTimeConfirmed } from './kickoff-time';
import { EventBusService } from '../events/event-bus.service';

jest.mock('@nestjs/schedule', () => ({
  Cron: () => () => undefined,
}));

/**
 * L39 — une heure de coup d'envoi non fixée ne doit plus être servie comme
 * une heure. football-data le dit par le statut : `SCHEDULED` (date connue,
 * heure non fixée, `utcDate` à 00:00:00Z) contre `TIMED` (heure fixée).
 * Mesuré en prod le 03-10 : J13 et J15 à `T00:00:00Z`, affichés « 01:00 ».
 */

const fixture = JSON.parse(
  fs.readFileSync(
    path.resolve(
      __dirname,
      '../../../test/fixtures/football_data_ol_matches_2026_10_03.json',
    ),
    'utf-8',
  ),
) as { finished: unknown; scheduled: unknown };

function withCwd<T>(fn: (dir: string) => Promise<T> | T): Promise<T> {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fixtures-'));
  const original = process.cwd();
  process.chdir(tmp);
  return Promise.resolve(fn(tmp)).finally(() => {
    process.chdir(original);
    fs.rmSync(tmp, { recursive: true, force: true });
  });
}

function buildService(
  apiKey: string | undefined = 'test-key',
): FixturesService {
  const config = { get: () => apiKey } as unknown as ConfigService;
  return new FixturesService(config, new EventBusService());
}

describe('footballDataTimeConfirmed', () => {
  it("SCHEDULED à 00:00:00Z : l'heure n'est pas fixée", () => {
    expect(footballDataTimeConfirmed('SCHEDULED', '2026-12-05T00:00:00Z')).toBe(
      false,
    );
    expect(
      footballDataTimeConfirmed('SCHEDULED', '2027-01-02T00:00:00.000Z'),
    ).toBe(false);
  });

  it("TIMED, en cours, terminé : l'heure est fixée", () => {
    expect(footballDataTimeConfirmed('TIMED', '2026-10-09T18:45:00Z')).toBe(
      true,
    );
    expect(footballDataTimeConfirmed('IN_PLAY', '2026-10-09T18:45:00Z')).toBe(
      true,
    );
    expect(footballDataTimeConfirmed('FINISHED', '2026-09-19T18:45:00Z')).toBe(
      true,
    );
  });

  it('SCHEDULED avec une vraie heure (statut inconnu replié sur SCHEDULED) : heure fixée', () => {
    expect(footballDataTimeConfirmed('SCHEDULED', '2026-10-09T18:45:00Z')).toBe(
      true,
    );
  });
});

describe('FixturesService — heure de coup d’envoi fixée ou non (L39)', () => {
  const realFetch = globalThis.fetch;
  let requested: string[] = [];

  beforeEach(() => {
    requested = [];
    globalThis.fetch = (input: unknown) => {
      const url = String(input);
      requested.push(url);
      const body = url.includes('status=FINISHED')
        ? fixture.finished
        : fixture.scheduled;
      return Promise.resolve(
        new Response(JSON.stringify(body), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );
    };
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it('marque J13 et J15 (SCHEDULED, 00:00:00Z) sans heure fixée, les autres avec', async () => {
    await withCwd(async () => {
      const matches = await buildService().getFixtures({ force: true });

      expect(matches).toHaveLength(15);
      const unconfirmed = matches
        .filter((m) => !m.timeConfirmed)
        .map((m) => m.matchday);
      expect(unconfirmed).toEqual([13, 15]);
      expect(matches.find((m) => m.matchday === 12)?.timeConfirmed).toBe(true);
      expect(matches.find((m) => m.matchday === 1)?.timeConfirmed).toBe(true);
    });
  });

  it('peekFixtures lit le cache sans appel réseau, même périmé, et le marque de la même façon', async () => {
    await withCwd(async (dir) => {
      const svc = buildService();
      await svc.getFixtures({ force: true });
      const afterRefresh = requested.length;

      // Cache vieux de 3 h (TTL 1 h) : peekFixtures le lit quand même.
      const cacheFile = path.join(dir, 'data', 'fixtures-cache.json');
      const cache = JSON.parse(fs.readFileSync(cacheFile, 'utf-8')) as {
        ts: number;
        data: unknown[];
      };
      fs.writeFileSync(
        cacheFile,
        JSON.stringify({ ...cache, ts: Date.now() - 3 * 3600_000 }),
      );

      const peeked = svc.peekFixtures();

      expect(requested).toHaveLength(afterRefresh);
      expect(peeked).toHaveLength(15);
      expect(
        peeked.filter((m) => !m.timeConfirmed).map((m) => m.matchday),
      ).toEqual([13, 15]);
    });
  });

  it("peekFixtures rend une liste vide quand il n'y a pas de cache, sans appel réseau", async () => {
    await withCwd(() => {
      expect(buildService().peekFixtures()).toEqual([]);
      expect(requested).toEqual([]);
    });
  });

  it('un cache écrit avant ce champ (sans timeConfirmed) est marqué à la lecture', async () => {
    await withCwd(async (dir) => {
      fs.mkdirSync(path.join(dir, 'data'), { recursive: true });
      fs.writeFileSync(
        path.join(dir, 'data', 'fixtures-cache.json'),
        JSON.stringify({
          ts: Date.now(),
          data: [
            {
              id: 559603,
              date: '2026-12-05T00:00:00Z',
              homeTeam: 'ES Troyes AC',
              homeTeamId: 531,
              awayTeam: 'Olympique Lyonnais',
              awayTeamId: 523,
              homeScore: null,
              awayScore: null,
              competition: 'Ligue 1',
              status: 'SCHEDULED',
              matchday: 13,
            },
          ],
        }),
      );

      const matches = await buildService().getFixtures();

      expect(requested).toEqual([]);
      expect(matches).toHaveLength(1);
      expect(matches[0].timeConfirmed).toBe(false);
    });
  });
});

/**
 * L39 — un appel football-data refusé ou en échec ne retire rien du cache.
 * Mesuré le 03-10 : après un bon rafraîchissement (15 matchs, J6 du 09-10 en
 * `TIMED`), l'appel `status=SCHEDULED` répond 429 ; `fetchMatches` rendait
 * alors `[]`, le cache était réécrit avec les 5 matchs joués, et J6 perdait
 * son heure au calendrier (« Horaire à confirmer »), poussé aux pages ouvertes.
 */
describe('FixturesService — appel football-data refusé ou en échec (L39)', () => {
  const realFetch = globalThis.fetch;
  type Answer = unknown | number | Error;
  let requested: string[] = [];
  /** Réponse par partie : une charge (200), un code HTTP, ou une erreur réseau. */
  let answers: { finished: Answer; scheduled: Answer; competition: Answer };

  const respond = (answer: Answer): Promise<Response> => {
    if (answer instanceof Error) return Promise.reject(answer);
    if (typeof answer === 'number')
      return Promise.resolve(new Response('', { status: answer }));
    return Promise.resolve(
      new Response(JSON.stringify(answer), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
  };

  beforeEach(() => {
    requested = [];
    answers = {
      finished: fixture.finished,
      scheduled: fixture.scheduled,
      competition: { matches: [] },
    };
    globalThis.fetch = (input: unknown) => {
      const url = String(input);
      requested.push(url);
      if (url.includes('/competitions/')) return respond(answers.competition);
      return respond(
        url.includes('status=FINISHED') ? answers.finished : answers.scheduled,
      );
    };
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  function readCache(dir: string): { id: number; matchday: number; status: string }[] {
    return (
      JSON.parse(
        fs.readFileSync(path.join(dir, 'data', 'fixtures-cache.json'), 'utf-8'),
      ) as { data: { id: number; matchday: number; status: string }[] }
    ).data;
  }

  function buildWithBus(): { svc: FixturesService; events: string[] } {
    const bus = new EventBusService();
    const events: string[] = [];
    bus.events$.subscribe((e) => events.push(e.type));
    const config = { get: () => 'test-key' } as unknown as ConfigService;
    return { svc: new FixturesService(config, bus), events };
  }

  it('demande toute la fin de saison à football-data : limit=100 sur les matchs à venir', async () => {
    await withCwd(async () => {
      await buildWithBus().svc.getFixtures({ force: true });

      expect(requested).toContain(
        'https://api.football-data.org/v4/teams/523/matches?status=SCHEDULED&limit=100',
      );
      expect(requested).toContain(
        'https://api.football-data.org/v4/teams/523/matches?status=FINISHED&limit=20',
      );
    });
  });

  it('matchs à venir refusés (429), repli par journée refusé aussi : le cache garde ses 15 matchs et J6 son heure', async () => {
    await withCwd(async (dir) => {
      const { svc, events } = buildWithBus();
      await svc.getFixtures({ force: true });
      expect(readCache(dir)).toHaveLength(15);
      events.length = 0;

      answers.scheduled = 429;
      answers.competition = 429;
      const matches = await svc.getFixtures({ force: true });

      expect(matches).toHaveLength(15);
      expect(readCache(dir)).toHaveLength(15);
      const j6 = svc.peekFixtures().find((m) => m.matchday === 6);
      expect(j6).toMatchObject({ status: 'TIMED', timeConfirmed: true });
      // Rien n'a changé : rien n'est poussé aux pages ouvertes.
      expect(events).toEqual([]);
    });
  });

  it('matchs à venir refusés : aucun appel de repli par journée quand le cache a déjà la réponse', async () => {
    await withCwd(async () => {
      const { svc } = buildWithBus();
      await svc.getFixtures({ force: true });
      requested = [];

      answers.scheduled = 429;
      await svc.getFixtures({ force: true });

      expect(requested.filter((u) => u.includes('/competitions/'))).toEqual([]);
    });
  });

  it('matchs à venir en erreur réseau : même garde, et la liste rendue n’est pas vide', async () => {
    await withCwd(async (dir) => {
      const { svc } = buildWithBus();
      await svc.getFixtures({ force: true });

      answers.scheduled = new Error('The operation was aborted due to timeout');
      const matches = await svc.getFixtures({ force: true });

      expect(matches).toHaveLength(15);
      expect(readCache(dir)).toHaveLength(15);
    });
  });

  it('matchs joués refusés : les 5 résultats du cache restent, les matchs à venir sont ceux de la réponse', async () => {
    await withCwd(async (dir) => {
      const { svc } = buildWithBus();
      await svc.getFixtures({ force: true });

      answers.finished = 503;
      const matches = await svc.getFixtures({ force: true });

      expect(matches.filter((m) => m.status === 'FINISHED')).toHaveLength(5);
      expect(readCache(dir)).toHaveLength(15);
    });
  });

  it('les deux appels refusés : le cache n’est pas réécrit (ni son horodatage) et reste servi', async () => {
    await withCwd(async (dir) => {
      const { svc, events } = buildWithBus();
      await svc.getFixtures({ force: true });
      const cacheFile = path.join(dir, 'data', 'fixtures-cache.json');
      const before = fs.readFileSync(cacheFile, 'utf-8');
      events.length = 0;

      answers.finished = 429;
      answers.scheduled = 429;
      const matches = await svc.getFixtures({ force: true });

      expect(matches).toHaveLength(15);
      expect(fs.readFileSync(cacheFile, 'utf-8')).toBe(before);
      expect(events).toEqual([]);
    });
  });

  it('un match gardé du cache et rendu joué par la réponse n’apparaît qu’une fois, joué', async () => {
    await withCwd(async (dir) => {
      const { svc } = buildWithBus();
      await svc.getFixtures({ force: true });

      // J6 vient d'être joué : il est dans les résultats ; les matchs à venir sont refusés.
      const scheduled = (fixture.scheduled as { matches: Record<string, unknown>[] })
        .matches;
      const j6Played = {
        ...scheduled[0],
        status: 'FINISHED',
        score: { fullTime: { home: 0, away: 1 } },
      };
      answers.finished = {
        matches: [
          ...(fixture.finished as { matches: unknown[] }).matches,
          j6Played,
        ],
      };
      answers.scheduled = 429;
      await svc.getFixtures({ force: true });

      const cache = readCache(dir);
      expect(cache).toHaveLength(15);
      expect(cache.filter((m) => m.matchday === 6)).toEqual([
        expect.objectContaining({ status: 'FINISHED' }),
      ]);
      expect(cache.filter((m) => m.status === 'FINISHED')).toHaveLength(6);
    });
  });

  it('réponse 200 sans match à venir (fin de saison) : ce n’est pas un échec, le cache suit la réponse', async () => {
    await withCwd(async (dir) => {
      const { svc } = buildWithBus();
      await svc.getFixtures({ force: true });

      answers.scheduled = { matches: [] };
      answers.competition = { matches: [] };
      await svc.getFixtures({ force: true });

      expect(readCache(dir)).toHaveLength(5);
    });
  });

  it('sans cache : un appel refusé laisse écrire la partie obtenue', async () => {
    await withCwd(async (dir) => {
      answers.scheduled = 429;
      answers.competition = 429;

      const matches = await buildWithBus().svc.getFixtures({ force: true });

      expect(matches).toHaveLength(5);
      expect(readCache(dir)).toHaveLength(5);
    });
  });
});
