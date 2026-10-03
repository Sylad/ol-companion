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
  pages: { fixtures?: Page | 'http-503' } = {},
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

      const matches = await svc.getMatches({ force: true });

      // Les 10 matchs joués sont là ; la marche avant a été tentée depuis le
      // curseur des résultats (page non capturée ici → 404 → arrêt propre).
      expect(matches.filter((m) => m.status === 'FINISHED')).toHaveLength(10);
      expect(requested[2]).toBe(season.results.paging?.nextPage);
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
