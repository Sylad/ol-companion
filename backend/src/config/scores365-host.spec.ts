/* eslint-disable @typescript-eslint/no-require-imports */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

/**
 * L33 — l'hôte de l'API 365scores est écrit UNE fois (`SCORES365_API_BASE`,
 * config/scores365-http.ts) et tous les services passent par lui.
 *
 * Panne du 01-10-2026 : `data.365scores.com` ne répond plus (timeout, 503)
 * alors que les mêmes chemins répondent sur l'hôte du détail de match. L'hôte
 * était recopié dans six services ; ce spec empêche qu'il le redevienne.
 *
 * - Garde sur les sources : aucun fichier non-spec de backend/src ne nomme
 *   l'ancien hôte, et l'hôte de l'API n'y figure qu'une fois.
 * - Garde sur le comportement : `fetch` global remplacé, chaque service est
 *   déroulé pour de bon ; toutes les URL demandées partent sur
 *   `SCORES365_API_BASE`, pagination comprise, chemins et paramètres inchangés.
 *
 * Hors champ : le flux play-by-play (momentum), dont l'URL complète est
 * fournie par la réponse de 365scores elle-même — retiré du match servi ici.
 */

const OLD_HOST = 'data.365scores.com';
const SRC = path.resolve(__dirname, '..');

/** Liens de pagination tels que 365scores les rend : relatifs, sans hôte. */
const PREV =
  '/web/games/?langId=1&timezoneId=6&userCountryId=75&apptype=5&competitors=465&games=1&aftergame=100&direction=-1';
const NEXT =
  '/web/games/?langId=1&timezoneId=6&userCountryId=75&apptype=5&competitors=465&games=1&aftergame=200&direction=1';

const IN_SEASON = '2026-04-10T19:00:00Z';

const gameDetailFixture = JSON.parse(
  fs.readFileSync(
    path.resolve(
      __dirname,
      '../../test/fixtures/365_game_lyon_rennes_live.json',
    ),
    'utf-8',
  ),
) as { game: Record<string, unknown> };
const GAME_ID = gameDetailFixture.game.id as number;

function gameDetailPayload(): unknown {
  const game = { ...gameDetailFixture.game };
  delete game.playByPlay;
  return { ...gameDetailFixture, game };
}

function gamesPayload(): unknown {
  return {
    games: [
      {
        id: GAME_ID,
        startTime: IN_SEASON,
        competitionId: 35,
        statusGroup: 4,
        hasLineups: true,
        homeCompetitor: { id: 465, name: 'Lyon', score: 2 },
        awayCompetitor: { id: 477, name: 'Rennes', score: 1 },
      },
      {
        // Quart de Coupe de France : déclenche aussi le tableau (BracketService).
        id: 2,
        startTime: IN_SEASON,
        competitionId: 37,
        stageNum: 6,
        statusGroup: 4,
        homeCompetitor: { id: 100, name: 'Lille', score: 0 },
        awayCompetitor: { id: 465, name: 'Lyon', score: 2 },
      },
    ],
    paging: { previousPage: PREV, nextPage: NEXT },
  };
}

function standingsPayload(): unknown {
  return {
    standings: [
      {
        isCurrentStage: true,
        seasonNum: 1,
        rows: [
          {
            position: 1,
            competitor: { id: 465, name: 'Lyon' },
            gamePlayed: 7,
            points: 16,
          },
          {
            position: 2,
            competitor: { id: 477, name: 'Rennes' },
            gamePlayed: 7,
            points: 12,
          },
          // Un classement de moins de 18 lignes est refusé (L36).
          ...Array.from({ length: 16 }, (_, i) => ({
            position: i + 3,
            competitor: { id: 1000 + i, name: `Club ${i + 3}` },
            gamePlayed: 7,
            points: 10 - Math.floor(i / 2),
          })),
        ],
      },
    ],
    competitions: [{ seasons: [{ num: 1, name: '2025/2026' }] }],
  };
}

interface Call {
  url: string;
  headers: Record<string, string>;
}

let calls: Call[] = [];

function fakeFetch(input: unknown, init?: RequestInit): Promise<Response> {
  const url =
    typeof input === 'object' && input !== null && 'url' in input
      ? String((input as { url: string }).url)
      : String(input);
  calls.push({
    url,
    headers: (init?.headers ?? {}) as Record<string, string>,
  });
  const { pathname } = new URL(url);
  const body =
    pathname === '/web/standings/'
      ? standingsPayload()
      : pathname === '/web/game/'
        ? gameDetailPayload()
        : pathname.startsWith('/web/games/')
          ? gamesPayload()
          : null;
  if (body === null) return Promise.resolve(new Response('', { status: 404 }));
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }),
  );
}

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts')
      ? [full]
      : [];
  });
}

/** Nombre d'occurrences de `needle` par fichier non-spec de backend/src. */
function occurrences(needle: string): Record<string, number> {
  const found: Record<string, number> = {};
  for (const file of sourceFiles(SRC)) {
    const count = fs.readFileSync(file, 'utf-8').split(needle).length - 1;
    if (count > 0) found[path.relative(SRC, file)] = count;
  }
  return found;
}

describe("365scores — hôte de l'API écrit une seule fois (L33)", () => {
  const realFetch = globalThis.fetch;
  let previousCwd: string;
  let tmpDir: string;
  let apiBase: string | undefined;

  /** Chemin + paramètres de chaque appel, hôte retiré. */
  const pathsAndQueries = () =>
    calls.map((c) => c.url.slice(new URL(c.url).origin.length));

  /** Tous les appels partent sur l'hôte de la constante, aucun sur l'ancien. */
  function expectAllOnApiBase(): void {
    expect(calls.length).toBeGreaterThan(0);
    const elsewhere = calls
      .map((c) => c.url)
      .filter((url) => !url.startsWith(`${apiBase}/web/`));
    expect(elsewhere).toEqual([]);
    expect(calls.filter((c) => c.url.includes(OLD_HOST))).toEqual([]);
    // En-têtes anti-scraping inchangés (sinon 403).
    for (const c of calls) {
      expect(c.headers['X-Domain']).toBe('fr');
      expect(c.headers['Origin']).toBe('https://www.365scores.com');
      expect(c.headers['Referer']).toMatch(
        /^https:\/\/www\.365scores\.com\/fr\/football/,
      );
    }
  }

  beforeAll(() => {
    // Saison 2025-26 figée : les matchs servis sont datés dans cette saison.
    jest.useFakeTimers({
      doNotFake: [
        'nextTick',
        'setImmediate',
        'setTimeout',
        'setInterval',
        'queueMicrotask',
      ],
      now: new Date('2026-04-15T12:00:00Z'),
    });

    // Les chemins de cache sont résolus au chargement des modules : on se
    // place dans un dossier temporaire AVANT de les charger (jamais backend/data/).
    previousCwd = process.cwd();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ol-scores365-host-'));
    fs.mkdirSync(path.join(tmpDir, 'data'));
    process.chdir(tmpDir);

    const { Logger } = require('@nestjs/common') as {
      Logger: { overrideLogger(v: boolean): void };
    };
    Logger.overrideLogger(false);

    apiBase = (require('./scores365-http') as Record<string, unknown>)
      .SCORES365_API_BASE as string | undefined;
  });

  beforeEach(() => {
    calls = [];
    globalThis.fetch = fakeFetch;
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  afterAll(() => {
    jest.useRealTimers();
    process.chdir(previousCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('sources', () => {
    it("exporte SCORES365_API_BASE, pointé sur l'hôte qui répond", () => {
      expect(apiBase).toBe('https://webws.365scores.com');
    });

    it("ne nomme plus l'ancien hôte dans backend/src (hors specs)", () => {
      expect(occurrences(OLD_HOST)).toEqual({});
    });

    it("n'écrit l'hôte de l'API qu'une fois, dans config/scores365-http.ts", () => {
      const host = new URL(apiBase ?? 'https://constante-absente.invalid').host;
      expect(occurrences(host)).toEqual({
        [path.join('config', 'scores365-http.ts')]: 1,
      });
    });
  });

  describe('URL demandées par les services', () => {
    const bus = () => ({ emit: jest.fn() }) as never;

    it('LineupService — derniers résultats puis détail du match', async () => {
      const { LineupService } =
        require('../modules/lineup/lineup.service') as typeof import('../modules/lineup/lineup.service');

      await new LineupService().getLatestLineup({ force: true });

      expect(pathsAndQueries()).toEqual([
        '/web/games/results/?appTypeId=5&langId=1&timezoneName=Europe/Paris&userCountryId=75&competitors=465&limit=10',
        `/web/game/?appTypeId=5&langId=1&timezoneName=Europe/Paris&userCountryId=75&gameId=${GAME_ID}&withLineups=true`,
      ]);
      expectAllOnApiBase();
    });

    it('StandingsService — classement Ligue 1', async () => {
      const { StandingsService } =
        require('../modules/standings/standings.service') as typeof import('../modules/standings/standings.service');

      const standings = await new StandingsService(bus()).getCurrentStandings({
        force: true,
      });

      expect(standings?.table).toHaveLength(18);
      expect(pathsAndQueries()).toEqual([
        '/web/standings/?appTypeId=5&langId=1&timezoneName=Europe/Paris&userCountryId=75&competitions=35',
      ]);
      expectAllOnApiBase();
    });

    it('CupsService + BracketService — résultats paginés, à venir, tableau', async () => {
      const { CupsService } =
        require('../modules/cups/cups.service') as typeof import('../modules/cups/cups.service');
      const { BracketService } =
        require('../modules/cups/bracket.service') as typeof import('../modules/cups/bracket.service');

      const cups = await new CupsService(
        {} as never,
        new BracketService(),
      ).getCups({ force: true });

      expect(cups.map((c) => c.competitionId)).toEqual([37]);
      expect(pathsAndQueries()).toEqual([
        '/web/games/results/?appTypeId=5&langId=1&timezoneName=Europe/Paris&userCountryId=75&competitors=465&limit=50',
        PREV,
        PREV,
        PREV,
        '/web/games/fixtures/?appTypeId=5&langId=1&timezoneName=Europe/Paris&userCountryId=75&competitors=465&limit=50',
        '/web/games/results/?appTypeId=5&langId=1&timezoneName=Europe/Paris&competitions=37&limit=200',
        '/web/games/fixtures/?appTypeId=5&langId=1&timezoneName=Europe/Paris&competitions=37&limit=200',
      ]);
      expectAllOnApiBase();
    });

    it('SeasonMatchesService — pagination arrière ET avant', async () => {
      const { SeasonMatchesService } =
        require('../modules/season-matches/season-matches.service') as typeof import('../modules/season-matches/season-matches.service');

      // football-data muet : seul l'hôte des appels 365scores est observé ici.
      const fixtures = {
        peekFixtures: () => [],
      } as unknown as import('../modules/fixtures/fixtures.service').FixturesService;
      const matches = await new SeasonMatchesService(
        bus(),
        fixtures,
      ).getMatches({
        force: true,
      });

      expect(matches.length).toBeGreaterThan(0);
      // Matchs à venir : la page `/fixtures/` puis ses pages suivantes, jusqu'au
      // plafond de 12 (la page servie ici annonce toujours une suite).
      expect(pathsAndQueries()).toEqual([
        '/web/games/results/?appTypeId=5&langId=1&timezoneName=Europe/Paris&userCountryId=75&competitors=465&limit=50',
        ...Array.from({ length: 7 }, () => PREV),
        '/web/games/fixtures/?appTypeId=5&langId=1&timezoneName=Europe/Paris&userCountryId=75&competitors=465&limit=50',
        ...Array.from({ length: 12 }, () => NEXT),
      ]);
      expectAllOnApiBase();
    });

    it('LiveMatchService — match courant (direct, résultats, à venir)', async () => {
      const { LiveMatchService } =
        require('../modules/live-match/live-match.service') as typeof import('../modules/live-match/live-match.service');

      await new LiveMatchService(bus()).getCurrent({ force: true });

      expect(pathsAndQueries()).toEqual([
        '/web/games/?appTypeId=5&langId=15&timezoneName=Europe/Paris&userCountryId=5&onlyLiveGames=true&competitors=465',
        '/web/games/results/?appTypeId=5&langId=15&timezoneName=Europe/Paris&userCountryId=5&competitors=465&limit=1',
        '/web/games/fixtures/?appTypeId=5&langId=15&timezoneName=Europe/Paris&userCountryId=5&competitors=465&limit=1',
      ]);
      expectAllOnApiBase();
    });

    it('LiveMatchService — statistiques du match (détail, mini-classement)', async () => {
      const { LiveMatchService } =
        require('../modules/live-match/live-match.service') as typeof import('../modules/live-match/live-match.service');

      const stats = await new LiveMatchService(bus()).getStats(GAME_ID, 'm1', {
        force: true,
      });

      expect(stats?.gameId).toBe(GAME_ID);
      expect(pathsAndQueries()).toEqual([
        `/web/game/?appTypeId=5&langId=15&gameId=${GAME_ID}&matchupId=m1&timezoneName=Europe/Paris&userCountryId=5`,
        '/web/standings/?appTypeId=5&langId=1&timezoneName=Europe/Paris&userCountryId=75&competitions=35',
      ]);
      expectAllOnApiBase();
    });

    it('PlayerStatsService — détail de chaque match terminé', async () => {
      const { PlayerStatsService } =
        require('../modules/players/player-stats.service') as typeof import('../modules/players/player-stats.service');
      const seasonMatches = {
        getMatches: () =>
          Promise.resolve([
            {
              id: GAME_ID,
              date: IN_SEASON,
              homeTeam: 'Lyon',
              homeTeamId: 523,
              awayTeam: 'Rennes',
              awayTeamId: 477,
              homeScore: 2,
              awayScore: 1,
              competitionCode: 'L1',
              status: 'FINISHED',
            },
          ]),
      };

      const players = await new PlayerStatsService(
        bus(),
        seasonMatches as never,
      ).getAll();

      expect(players.length).toBeGreaterThan(0);
      expect(pathsAndQueries()).toEqual([
        `/web/game/?appTypeId=5&langId=15&gameId=${GAME_ID}&timezoneName=Europe/Paris&userCountryId=5&withLineups=true`,
      ]);
      expectAllOnApiBase();
    });
  });
});
