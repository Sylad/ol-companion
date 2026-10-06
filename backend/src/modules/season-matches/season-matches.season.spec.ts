import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { SeasonMatchesService } from './season-matches.service';
import { EventBusService } from '../events/event-bus.service';
import type { FixturesService, Match } from '../fixtures/fixtures.service';
import { footballDataTimeConfirmed } from '../fixtures/kickoff-time';
import { computeTeamSeasonStats } from './team-stats';

jest.mock('@nestjs/schedule', () => ({
  Cron: () => () => undefined,
}));

/**
 * L39 — la saison telle que 365scores la servait le 2026-10-03 (charges
 * réelles réduites, `test/fixtures/365_games_ol_season_2026_10_03.json`) :
 * 34 journées de Ligue 1, 8 matchs de Ligue Europa et les 4 matchs de
 * qualification de Ligue des champions d'août (compétition 332), 10 joués.
 *
 * Avant ce lot, la marche avant s'arrêtait après 8 pages de 3 à 5 matchs :
 * 36 matchs, dernier le 17-04-2027 (J28) — J29 à J34 manquaient. Et la
 * journée (`roundNum`) n'était pas reprise.
 */

interface Page {
  games?: unknown[];
  paging?: { previousPage?: string; nextPage?: string };
}

const season = JSON.parse(
  fs.readFileSync(
    path.resolve(
      __dirname,
      '../../../test/fixtures/365_games_ol_season_2026_10_03.json',
    ),
    'utf-8',
  ),
) as { results: Page; fixtures: Page; forward: Page[] };

const footballData = JSON.parse(
  fs.readFileSync(
    path.resolve(
      __dirname,
      '../../../test/fixtures/football_data_ol_matches_2026_10_03.json',
    ),
    'utf-8',
  ),
) as {
  finished: { matches: FootballDataRaw[] };
  scheduled: { matches: FootballDataRaw[] };
};

interface FootballDataRaw {
  id: number;
  utcDate: string;
  status: string;
  matchday: number;
  homeTeam: { id: number; name: string };
  awayTeam: { id: number; name: string };
  score: { fullTime: { home: number | null; away: number | null } };
  competition: { name: string };
}

/** Ce que `FixturesService.peekFixtures()` rend pour la charge football-data du 03-10. */
function footballDataMatches(): Match[] {
  return [
    ...footballData.finished.matches,
    ...footballData.scheduled.matches,
  ].map((m) => ({
    id: m.id,
    date: m.utcDate,
    homeTeam: m.homeTeam.name,
    homeTeamId: m.homeTeam.id,
    awayTeam: m.awayTeam.name,
    awayTeamId: m.awayTeam.id,
    homeScore: m.score.fullTime.home,
    awayScore: m.score.fullTime.away,
    competition: m.competition.name,
    status: m.status as Match['status'],
    matchday: m.matchday,
    timeConfirmed: footballDataTimeConfirmed(m.status, m.utcDate),
  }));
}

function fixturesStub(matches: Match[]): FixturesService {
  return { peekFixtures: () => matches } as unknown as FixturesService;
}

beforeAll(() => {
  jest.useFakeTimers({
    doNotFake: [
      'nextTick',
      'setImmediate',
      'setTimeout',
      'setInterval',
      'queueMicrotask',
    ],
    now: new Date('2026-10-03T12:00:00Z'),
  });
});
afterAll(() => jest.useRealTimers());

function withCwd<T>(fn: (dir: string) => Promise<T> | T): Promise<T> {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'season-matches-'));
  const original = process.cwd();
  process.chdir(tmp);
  return Promise.resolve(fn(tmp)).finally(() => {
    process.chdir(original);
    fs.rmSync(tmp, { recursive: true, force: true });
  });
}

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

/**
 * Sert les pages capturées selon l'URL demandée, comme 365scores : la page des
 * résultats, la page des matchs à venir, puis chaque page « suivante » repérée
 * par son `aftergame`.
 */
function buildService(
  fixtures: Match[] = footballDataMatches(),
  pages: {
    fixtures?: Page | 'http-503';
    /** Pages servies en suivant le curseur de la page des RÉSULTATS. */
    afterResults?: Page[];
  } = {},
): { svc: SeasonMatchesService; requested: string[] } {
  const requested: string[] = [];
  const forwardByCursor = new Map<string, Page>();
  // Chaque page avant est la réponse au `nextPage` de la page qui la précède,
  // en partant de la page des matchs à venir. Les pages qui suivent le curseur
  // de la page des résultats n'ont pas été reprises ici : elles ne sont jamais
  // demandées quand la page des matchs à venir répond.
  let previous: Page = season.fixtures;
  for (const page of season.forward) {
    const cursor = new URL(
      `https://x${previous.paging?.nextPage ?? ''}`,
    ).searchParams.get('aftergame');
    if (cursor) forwardByCursor.set(cursor, page);
    previous = page;
  }
  previous = season.results;
  for (const page of pages.afterResults ?? []) {
    const cursor = new URL(
      `https://x${previous.paging?.nextPage ?? ''}`,
    ).searchParams.get('aftergame');
    if (cursor) forwardByCursor.set(cursor, page);
    previous = page;
  }

  const svc = new SeasonMatchesService(
    new EventBusService(),
    fixturesStub(fixtures),
  );
  svc.fetcher = (input: unknown) => {
    const url = new URL(String(input));
    requested.push(`${url.pathname}${url.search}`);
    if (url.pathname === '/web/games/results/')
      return Promise.resolve(json(season.results));
    if (url.pathname === '/web/games/fixtures/') {
      if (pages.fixtures === 'http-503')
        return Promise.resolve(new Response('', { status: 503 }));
      return Promise.resolve(json(pages.fixtures ?? season.fixtures));
    }
    if (
      url.pathname === '/web/games/' &&
      url.searchParams.get('direction') === '1'
    ) {
      const page = forwardByCursor.get(url.searchParams.get('aftergame') ?? '');
      if (page) return Promise.resolve(json(page));
    }
    return Promise.resolve(new Response('', { status: 404 }));
  };
  return { svc, requested };
}

describe('SeasonMatchesService — saison réelle du 2026-10-03 (L39)', () => {
  it('rend toute la saison : 34 journées de Ligue 1, 8 matchs de Ligue Europa et 4 de qualification de Ligue des champions, du 04-08-2026 au 29-05-2027', async () => {
    await withCwd(async () => {
      const { svc } = buildService();

      const matches = await svc.getMatches({ force: true });

      const byCode = (code: string) =>
        matches.filter((m) => m.competitionCode === code);
      expect(matches).toHaveLength(46);
      expect(byCode('L1')).toHaveLength(34);
      expect(byCode('UEL')).toHaveLength(8);
      expect(byCode('UCL')).toHaveLength(4);
      expect(matches.filter((m) => m.status === 'FINISHED')).toHaveLength(10);
      expect(matches[0].date).toBe('2026-08-04T18:00:00.000Z');
      expect(matches[matches.length - 1].date).toBe('2027-05-29T17:00:00.000Z');
      // Triés par date.
      const dates = matches.map((m) => m.date);
      expect([...dates].sort()).toEqual(dates);
    });
  });

  it('demande la page des matchs à venir puis suit ses pages suivantes jusqu’à la page vide — 6 appels, aucun vers la saison passée', async () => {
    await withCwd(async () => {
      const { svc, requested } = buildService();

      await svc.getMatches({ force: true });

      expect(requested).toEqual([
        '/web/games/results/?appTypeId=5&langId=1&timezoneName=Europe/Paris&userCountryId=75&competitors=465&limit=50',
        '/web/games/fixtures/?appTypeId=5&langId=1&timezoneName=Europe/Paris&userCountryId=75&competitors=465&limit=50',
        season.fixtures.paging?.nextPage,
        season.forward[0].paging?.nextPage,
        season.forward[1].paging?.nextPage,
        season.forward[2].paging?.nextPage,
      ]);
    });
  });

  it('reprend la journée (roundNum) : J1 à J34 en Ligue 1, J1 à J8 en Ligue Europa', async () => {
    await withCwd(async () => {
      const { svc } = buildService();

      const matches = await svc.getMatches({ force: true });

      const days = (code: string) =>
        matches
          .filter((m) => m.competitionCode === code)
          .map((m) => m.matchday);
      expect(days('L1')).toEqual(Array.from({ length: 34 }, (_, i) => i + 1));
      expect(days('UEL')).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
      const palace = matches.find((m) => m.id === 4828743);
      expect(palace).toMatchObject({
        competition: 'UEFA Europa League',
        competitionCode: 'UEL',
        matchday: 2,
        date: '2026-10-15T16:45:00.000Z',
        homeTeam: 'Lyon',
        awayTeam: 'Crystal Palace',
        status: 'SCHEDULED',
        homeScore: null,
        awayScore: null,
      });
    });
  });

  it('qualifications de Ligue des champions (332) : les 4 matchs d’août à leur date, sans journée, avec leur tour et leur manche', async () => {
    await withCwd(async () => {
      const { svc } = buildService();

      const matches = await svc.getMatches({ force: true });

      const qualifiers = matches.filter((m) => m.competitionCode === 'UCL');
      expect(
        qualifiers.map((m) => [
          m.id,
          m.date,
          `${m.homeTeam} ${m.homeScore}-${m.awayScore} ${m.awayTeam}`,
          m.round,
        ]),
      ).toEqual([
        [
          4779514,
          '2026-08-04T18:00:00.000Z',
          'Sparta Praha 2-1 Lyon',
          '3e tour de qualification · aller',
        ],
        [
          4779515,
          '2026-08-11T19:00:00.000Z',
          'Lyon 3-0 Sparta Praha',
          '3e tour de qualification · retour',
        ],
        [
          4809607,
          '2026-08-18T19:00:00.000Z',
          'Fenerbahçe SK 1-1 Lyon',
          'Barrages · aller',
        ],
        [
          4809611,
          '2026-08-26T19:00:00.000Z',
          'Lyon 1-2 Fenerbahçe SK',
          'Barrages · retour',
        ],
      ]);
      for (const m of qualifiers) {
        expect(m).toMatchObject({
          competition: 'UEFA Champions League',
          competitionId: 332,
          status: 'FINISHED',
          matchday: null,
          timeConfirmed: true,
        });
      }
      // L'OL y garde son identifiant canonique (523), comme partout ailleurs.
      expect(qualifiers[1].homeTeamId).toBe(523);
      expect(qualifiers[0].awayTeamId).toBe(523);
    });
  });

  it('les matchs à journée (Ligue 1, phase de ligue européenne) n’ont pas de tour', async () => {
    await withCwd(async () => {
      const { svc } = buildService();

      const matches = await svc.getMatches({ force: true });

      expect(
        matches
          .filter((m) => m.competitionCode !== 'UCL')
          .every((m) => m.round === null),
      ).toBe(true);
    });
  });

  it('ne retient ni les matchs amicaux (321) ni un match d’avant le 1er août', async () => {
    await withCwd(async () => {
      const { svc } = buildService();

      const matches = await svc.getMatches({ force: true });

      expect(matches.some((m) => m.competitionId === 321)).toBe(false);
      expect([...new Set(matches.map((m) => m.competitionId))].sort()).toEqual([
        332, 35, 573,
      ]);
    });
  });

  it('statistiques d’équipe : les 4 qualifications comptent — 10 joués (5 V, 3 N, 2 D), 18 buts pour, 8 contre', async () => {
    await withCwd(async () => {
      const { svc } = buildService();

      const stats = computeTeamSeasonStats(
        await svc.getMatches({ force: true }),
      );

      // Sans les qualifications (avant) : 6 joués, 4 V, 2 N, 0 D, 12-3.
      expect(stats).toMatchObject({
        played: 10,
        won: 5,
        draw: 3,
        lost: 2,
        goalsFor: 18,
        goalsAgainst: 8,
        cleanSheets: 4,
      });
      expect(
        stats.perCompetition.map((c) => [
          c.competitionCode,
          c.played,
          c.won,
          c.draw,
          c.lost,
          c.goalsFor,
          c.goalsAgainst,
          c.points,
        ]),
      ).toEqual([
        ['L1', 5, 3, 2, 0, 10, 2, 11],
        ['UCL', 4, 1, 1, 2, 6, 5, 0],
        ['UEL', 1, 1, 0, 0, 2, 1, 0],
      ]);
      // Les points de Ligue 1 ne bougent pas : 11 après J5.
      expect(stats.chart).toHaveLength(10);
      expect(stats.chart[stats.chart.length - 1].points).toBe(11);
      expect(stats.chart[0]).toMatchObject({
        competitionCode: 'UCL',
        result: 'L',
        points: null,
      });
    });
  });

  it('page des matchs à venir en échec : repart du curseur de la page des résultats', async () => {
    await withCwd(async () => {
      const { svc, requested } = buildService(footballDataMatches(), {
        fixtures: 'http-503',
      });
      svc.retryDelayMs = 0;

      const matches = await svc.getMatches({ force: true });

      // Les 10 matchs joués sont là ; la marche avant a été tentée depuis le
      // curseur des résultats (page non capturée ici → 404 → arrêt propre).
      expect(matches.filter((m) => m.status === 'FINISHED')).toHaveLength(10);
      expect(requested).toContain(season.results.paging?.nextPage);
    });
  });

  describe('marche avant en échec (L67 — QA prod du 06-10 : 38 matchs au lieu de 46)', () => {
    /** Fait échouer (timeout) toute requête dont le chemin/curseur satisfait `pred`, `times` fois. */
    function failing(
      svc: SeasonMatchesService,
      pred: (url: URL) => boolean,
      times: number,
    ): { failures: () => number } {
      const real = svc.fetcher;
      let n = 0;
      svc.fetcher = (input: unknown, init?: RequestInit) => {
        if (pred(new URL(String(input))) && n < times) {
          n++;
          return Promise.reject(new Error('The operation was aborted due to timeout'));
        }
        return real(input as string, init);
      };
      return { failures: () => n };
    }
    const secondForwardCursor = new URL(
      `https://x${season.forward[0].paging?.nextPage ?? ''}`,
    ).searchParams.get('aftergame');
    const isSecondForward = (u: URL) =>
      u.pathname === '/web/games/' && u.searchParams.get('aftergame') === secondForwardCursor;

    it('un timeout sur une page de la marche avant est réessayé : la saison reste complète (46 matchs)', async () => {
      await withCwd(async () => {
        const { svc } = buildService();
        svc.retryDelayMs = 0;
        const f = failing(svc, isSecondForward, 1);

        const matches = await svc.getMatches({ force: true });

        expect(f.failures()).toBe(1);
        expect(matches).toHaveLength(46);
      });
    });

    it('une page qui échoue encore au 2e essai ne remplace pas une saison complète du cache par une plus courte', async () => {
      await withCwd(async (dir) => {
        const first = buildService();
        first.svc.retryDelayMs = 0;
        expect(await first.svc.getMatches({ force: true })).toHaveLength(46);
        const cacheFile = path.join(dir, 'data', 'season-matches-cache.json');
        const before = fs.readFileSync(cacheFile, 'utf-8');

        const { svc } = buildService();
        svc.retryDelayMs = 0;
        const warn = jest.spyOn(svc['logger'], 'warn').mockImplementation();
        failing(svc, isSecondForward, 99);

        const matches = await svc.getMatches({ force: true });

        expect(matches).toHaveLength(46);
        expect(fs.readFileSync(cacheFile, 'utf-8')).toBe(before);
        expect(warn).toHaveBeenCalledWith(
          expect.stringContaining('cache existant conservé'),
        );
      });
    });

    it('après le déclenchement de la garde, une lecture non forcée sert l’ancienne saison sans relancer le parcours de 365scores', async () => {
      await withCwd(async (dir) => {
        const first = buildService();
        first.svc.retryDelayMs = 0;
        await first.svc.getMatches({ force: true });
        // Cache plus vieux que le TTL de 30 min : une lecture non forcée doit rafraîchir.
        const cacheFile = path.join(dir, 'data', 'season-matches-cache.json');
        const stored = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
        stored.ts = Date.now() - 31 * 60_000;
        fs.writeFileSync(cacheFile, JSON.stringify(stored));

        const { svc } = buildService();
        svc.retryDelayMs = 0;
        jest.spyOn(svc['logger'], 'warn').mockImplementation();
        const f = failing(svc, isSecondForward, 99);
        const calls = jest.fn(svc.fetcher);
        svc.fetcher = calls as typeof svc.fetcher;

        expect(await svc.getMatches({ force: true })).toHaveLength(46); // garde déclenchée
        const callsAfterGuard = calls.mock.calls.length;
        const failuresAfterGuard = f.failures();

        expect(await svc.getMatches()).toHaveLength(46);
        expect(await svc.getMatches()).toHaveLength(46);
        expect(calls.mock.calls.length).toBe(callsAfterGuard);
        expect(f.failures()).toBe(failuresAfterGuard);
      });
    });

    it('sans cache précédent, la saison tronquée est tout de même rendue (mieux que rien)', async () => {
      await withCwd(async () => {
        const { svc } = buildService();
        svc.retryDelayMs = 0;
        failing(svc, isSecondForward, 99);

        const matches = await svc.getMatches({ force: true });

        expect(matches.length).toBeGreaterThan(10);
        expect(matches.length).toBeLessThan(46);
      });
    });

    it('page des matchs à venir en timeout : réessayée aussi', async () => {
      await withCwd(async () => {
        const { svc } = buildService();
        svc.retryDelayMs = 0;
        const f = failing(svc, (u) => u.pathname === '/web/games/fixtures/', 1);

        const matches = await svc.getMatches({ force: true });

        expect(f.failures()).toBe(1);
        expect(matches).toHaveLength(46);
      });
    });
  });

  describe('échec hors marche avant (L67 — décision du lead du 06-10)', () => {
    const isResults = (u: URL) => u.pathname === '/web/games/results/';

    /** Fait échouer (timeout) toute requête dont l'URL satisfait `pred`. */
    function failAll(svc: SeasonMatchesService, pred: (url: URL) => boolean): { calls: () => number } {
      const real = svc.fetcher;
      let calls = 0;
      svc.fetcher = (input: unknown, init?: RequestInit) => {
        calls++;
        if (pred(new URL(String(input)))) return Promise.reject(new Error('The operation was aborted due to timeout'));
        return real(input as string, init);
      };
      return { calls: () => calls };
    }

    it('une page de résultats en échec après son nouvel essai : le cache complet est conservé, sans réécriture', async () => {
      await withCwd(async (dir) => {
        const first = buildService();
        first.svc.retryDelayMs = 0;
        expect(await first.svc.getMatches({ force: true })).toHaveLength(46);
        const cacheFile = path.join(dir, 'data', 'season-matches-cache.json');
        const before = fs.readFileSync(cacheFile, 'utf-8');

        const { svc } = buildService();
        svc.retryDelayMs = 0;
        const warn = jest.spyOn(svc['logger'], 'warn').mockImplementation();
        failAll(svc, isResults);

        expect(await svc.getMatches({ force: true })).toHaveLength(46);
        expect(fs.readFileSync(cacheFile, 'utf-8')).toBe(before);
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('cache existant conservé'));
      });
    });

    it('page des matchs à venir seule en échec (marche avant depuis le curseur des résultats sans erreur) : le cache complet est conservé, sans réécriture', async () => {
      await withCwd(async (dir) => {
        const first = buildService();
        first.svc.retryDelayMs = 0;
        expect(await first.svc.getMatches({ force: true })).toHaveLength(46);
        const cacheFile = path.join(dir, 'data', 'season-matches-cache.json');
        const before = fs.readFileSync(cacheFile, 'utf-8');

        // Le curseur des résultats mène à une page vide : seule la page des matchs à venir échoue.
        const { svc } = buildService(footballDataMatches(), {
          fixtures: 'http-503',
          afterResults: [{ games: [] }],
        });
        svc.retryDelayMs = 0;
        const warn = jest.spyOn(svc['logger'], 'warn').mockImplementation();

        expect(await svc.getMatches({ force: true })).toHaveLength(46);
        expect(fs.readFileSync(cacheFile, 'utf-8')).toBe(before);
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('cache existant conservé'));
      });
    });

    it('panne totale (0 match) : cache conservé, puis les lectures non forcées ne relancent pas de parcours', async () => {
      await withCwd(async (dir) => {
        const first = buildService();
        first.svc.retryDelayMs = 0;
        await first.svc.getMatches({ force: true });
        const cacheFile = path.join(dir, 'data', 'season-matches-cache.json');
        const stored = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
        stored.ts = Date.now() - 31 * 60_000;
        fs.writeFileSync(cacheFile, JSON.stringify(stored));

        const { svc } = buildService();
        svc.retryDelayMs = 0;
        jest.spyOn(svc['logger'], 'warn').mockImplementation();
        const f = failAll(svc, () => true);

        expect(await svc.getMatches({ force: true })).toHaveLength(46);
        const callsAfterOutage = f.calls();
        expect(callsAfterOutage).toBeGreaterThan(0);

        expect(await svc.getMatches()).toHaveLength(46);
        expect(await svc.getMatches()).toHaveLength(46);
        expect(f.calls()).toBe(callsAfterOutage);

        // Le forçage (cron) retente bien.
        await svc.getMatches({ force: true });
        expect(f.calls()).toBeGreaterThan(callsAfterOutage);
      });
    });

    it('enveloppe sans `games` en HTTP 200 (parcours complet, 0 match) : cache conservé sans réécriture, puis lectures non forcées sans nouveau parcours', async () => {
      await withCwd(async (dir) => {
        const first = buildService();
        first.svc.retryDelayMs = 0;
        await first.svc.getMatches({ force: true });
        const cacheFile = path.join(dir, 'data', 'season-matches-cache.json');
        const stored = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
        stored.ts = Date.now() - 31 * 60_000;
        const aged = JSON.stringify(stored);
        fs.writeFileSync(cacheFile, aged);

        const { svc } = buildService();
        svc.retryDelayMs = 0;
        const warn = jest.spyOn(svc['logger'], 'warn').mockImplementation();
        const fetcher = jest.fn(async () => new Response('{}', { status: 200 }));
        svc.fetcher = fetcher as unknown as typeof svc.fetcher;

        expect(await svc.getMatches({ force: true })).toHaveLength(46);
        expect(fs.readFileSync(cacheFile, 'utf-8')).toBe(aged);
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('cache existant conservé'));

        const callsAfterGuard = fetcher.mock.calls.length;
        expect(await svc.getMatches()).toHaveLength(46);
        expect(fetcher.mock.calls.length).toBe(callsAfterGuard);
      });
    });
  });

  describe('nouvel essai selon le statut HTTP (L67)', () => {
    const isFixtures = (u: URL) => u.pathname === '/web/games/fixtures/';

    /** Répond `status` aux `times` premières requêtes de la page des matchs à venir ; compte ses appels. */
    function httpStatus(svc: SeasonMatchesService, status: number, times: number): { calls: () => number } {
      const real = svc.fetcher;
      let calls = 0;
      svc.fetcher = (input: unknown, init?: RequestInit) => {
        if (isFixtures(new URL(String(input)))) {
          calls++;
          if (calls <= times) return Promise.resolve(new Response('', { status }));
        }
        return real(input as string, init);
      };
      return { calls: () => calls };
    }

    it.each([503, 429])('HTTP %i sur la page des matchs à venir : réessayé une fois, saison complète', async (status) => {
      await withCwd(async () => {
        const { svc } = buildService();
        svc.retryDelayMs = 0;
        const h = httpStatus(svc, status, 1);

        const matches = await svc.getMatches({ force: true });

        expect(h.calls()).toBe(2);
        expect(matches).toHaveLength(46);
      });
    });

    it('HTTP 503 persistant : deux essais, pas plus', async () => {
      await withCwd(async () => {
        const { svc } = buildService();
        svc.retryDelayMs = 0;
        const h = httpStatus(svc, 503, 99);

        await svc.getMatches({ force: true });

        expect(h.calls()).toBe(2);
      });
    });

    it.each([404, 403])('HTTP %i : pas de nouvel essai', async (status) => {
      await withCwd(async () => {
        const { svc } = buildService();
        svc.retryDelayMs = 0;
        const h = httpStatus(svc, status, 99);

        await svc.getMatches({ force: true });

        expect(h.calls()).toBe(1);
      });
    });
  });

  describe('page des matchs à venir en HTTP 200 mais SANS match', () => {
    /**
     * Les matchs à venir de la capture, redécoupés en pages de 4 chaînées par
     * `aftergame` comme le fait 365scores depuis le curseur des résultats (il
     * y sert 3 à 5 matchs par page). Le découpage est reconstruit, les matchs
     * sont ceux de la capture ; la dernière page est l'enveloppe vide.
     */
    function pagesAfterResults(): Page[] {
      const upcoming = [
        ...(season.fixtures.games ?? []),
        ...season.forward.flatMap((p) => p.games ?? []),
      ] as { id: number }[];
      const pages: Page[] = [];
      for (let i = 0; i < upcoming.length; i += 4) {
        const games = upcoming.slice(i, i + 4);
        pages.push({
          games,
          paging: {
            nextPage: `/web/games/?langId=1&timezoneId=6&userCountryId=75&apptype=5&competitors=465&games=1&aftergame=${games[games.length - 1].id}&direction=1`,
          },
        });
      }
      return [...pages, {}];
    }

    it.each<[string, Page]>([
      ['enveloppe sans clé `games`', {}],
      ['liste `games` vide', { games: [] }],
      [
        'liste vide avec un curseur à elle',
        {
          games: [],
          paging: {
            nextPage:
              '/web/games/?langId=1&timezoneId=6&userCountryId=75&apptype=5&competitors=465&games=1&aftergame=999&direction=1',
          },
        },
      ],
    ])(
      '%s : la marche avant repart du curseur des résultats et rend toute la saison',
      async (_label, emptyFixtures) => {
        await withCwd(async () => {
          const afterResults = pagesAfterResults();
          expect(afterResults).toHaveLength(10); // 36 matchs à venir : 9 pages + la vide
          const { svc, requested } = buildService(footballDataMatches(), {
            fixtures: emptyFixtures,
            afterResults,
          });

          const matches = await svc.getMatches({ force: true });

          expect(requested).toContain(season.results.paging?.nextPage);
          // Jamais le curseur d'une page sans match.
          expect(requested.some((u) => u.includes('aftergame=999'))).toBe(false);
          // 2 appels + les 10 pages : la saison est complète, jusqu'à J34.
          expect(requested).toHaveLength(12);
          expect(matches).toHaveLength(46);
          expect(
            matches.filter((m) => m.status === 'SCHEDULED'),
          ).toHaveLength(36);
          expect(matches[matches.length - 1]).toMatchObject({
            date: '2027-05-29T17:00:00.000Z',
            matchday: 34,
          });
        });
      },
    );

    it('et sans page suivante côté résultats non plus : les matchs joués seuls, sans erreur', async () => {
      await withCwd(async () => {
        const { svc, requested } = buildService(footballDataMatches(), {
          fixtures: {},
        });

        const matches = await svc.getMatches({ force: true });

        // Le curseur des résultats est tenté (page non servie ici → 404).
        expect(requested).toHaveLength(3);
        expect(matches).toHaveLength(10);
        expect(matches.every((m) => m.status === 'FINISHED')).toBe(true);
      });
    });
  });

  describe('heure du coup d’envoi fixée ou non', () => {
    it('Ligue 1 à venir, football-data connu : il décide pour ses journées, et au-delà de J15 rien n’est dans les 14 jours', async () => {
      await withCwd(async () => {
        const { svc } = buildService();

        const matches = await svc.getMatches({ force: true });

        const upcomingL1 = matches.filter(
          (m) => m.competitionCode === 'L1' && m.status === 'SCHEDULED',
        );
        const confirmed = upcomingL1
          .filter((m) => m.timeConfirmed)
          .map((m) => m.matchday);
        const unconfirmed = upcomingL1
          .filter((m) => !m.timeConfirmed)
          .map((m) => m.matchday);
        // football-data du 03-10 : J6 à J12 et J14 en TIMED ; J13 et J15 en
        // SCHEDULED à 00:00:00Z ; au-delà de J15, il ne dit rien et J16 est
        // le 2027-01-16, bien après la fenêtre de 14 jours.
        expect(confirmed).toEqual([6, 7, 8, 9, 10, 11, 12, 14]);
        expect(unconfirmed).toEqual([
          13, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30,
          31, 32, 33, 34,
        ]);
      });
    });

    it('matchs joués et Ligue Europa : heure tenue pour fixée', async () => {
      await withCwd(async () => {
        const { svc } = buildService();

        const matches = await svc.getMatches({ force: true });

        expect(
          matches
            .filter((m) => m.status === 'FINISHED')
            .every((m) => m.timeConfirmed),
        ).toBe(true);
        expect(
          matches
            .filter((m) => m.competitionCode === 'UEL')
            .every((m) => m.timeConfirmed),
        ).toBe(true);
      });
    });

    it('sans calendrier football-data (clé absente, panne) : seul le match des 14 prochains jours garde son heure', async () => {
      await withCwd(async () => {
        const { svc } = buildService([]);

        const matches = await svc.getMatches({ force: true });

        const upcomingL1 = matches.filter(
          (m) => m.competitionCode === 'L1' && m.status === 'SCHEDULED',
        );
        expect(upcomingL1).toHaveLength(29);
        // Vu du 03-10 à 12:00Z : J6 (09-10) est à 6 jours ; J7 (18-10 à
        // 18:45Z) à 15 jours et 7 heures, hors fenêtre.
        expect(
          upcomingL1.filter((m) => m.timeConfirmed).map((m) => m.matchday),
        ).toEqual([6]);
      });
    });

    it('cache football-data réduit aux 5 matchs joués (appel des matchs à venir refusé) : le match du 09-10 garde son heure', async () => {
      await withCwd(async () => {
        const playedOnly = footballDataMatches().filter(
          (m) => m.status === 'FINISHED',
        );
        expect(playedOnly).toHaveLength(5);
        const { svc } = buildService(playedOnly);

        const matches = await svc.getMatches({ force: true });

        const lens = matches.find(
          (m) => m.competitionCode === 'L1' && m.matchday === 6,
        );
        expect(lens).toMatchObject({
          date: '2026-10-09T18:45:00.000Z',
          status: 'SCHEDULED',
          timeConfirmed: true,
        });
      });
    });

    it('l’horloge avance : une journée entre dans la fenêtre de 14 jours sans nouvelle réponse de football-data', async () => {
      await withCwd(async () => {
        const { svc } = buildService([]);
        await svc.getMatches({ force: true });
        const j7 = async () =>
          (await svc.getMatches()).find(
            (m) => m.competitionCode === 'L1' && m.matchday === 7,
          )?.timeConfirmed;

        expect(await j7()).toBe(false);
        // J7 : 2026-10-18T18:45Z. Le 04-10 à 19:00Z, il reste moins de 14 jours.
        jest.setSystemTime(new Date('2026-10-04T19:00:00Z'));
        try {
          expect(await j7()).toBe(true);
        } finally {
          jest.setSystemTime(new Date('2026-10-03T12:00:00Z'));
        }
      });
    });

    it('n’écrit pas le champ dans le cache et le recalcule à chaque lecture', async () => {
      await withCwd(async (dir) => {
        let fixtures: Match[] = [];
        const { svc } = buildService();
        (svc as unknown as { fixtures: FixturesService }).fixtures = {
          peekFixtures: () => fixtures,
        } as unknown as FixturesService;

        await svc.getMatches({ force: true });
        const cached = JSON.parse(
          fs.readFileSync(
            path.join(dir, 'data', 'season-matches-cache.json'),
            'utf-8',
          ),
        ) as { data: Record<string, unknown>[] };
        expect(cached.data).toHaveLength(46);
        expect(cached.data.some((m) => 'timeConfirmed' in m)).toBe(false);

        // football-data apprend l'heure de J7 (à plus de 14 jours) : la lecture
        // suivante (cache) le reflète.
        const before = await svc.getMatches();
        fixtures = footballDataMatches();
        const after = await svc.getMatches();
        const j7 = (list: typeof before) =>
          list.find((m) => m.competitionCode === 'L1' && m.matchday === 7);
        expect(j7(before)?.timeConfirmed).toBe(false);
        expect(j7(after)?.timeConfirmed).toBe(true);
      });
    });
  });
});
