import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { SeasonMatchesService, stageLabel, legLabel } from './season-matches.service';
import { EventBusService } from '../events/event-bus.service';
import type { FixturesService } from '../fixtures/fixtures.service';

jest.mock('@nestjs/schedule', () => ({
  Cron: () => () => undefined,
}));

// Horloge figée en saison 2025-26 : les fixtures sont datées relativement à
// cette saison — sans fake timers, le spec pourrissait au changement de
// saison (cassé le 2026-08-01, découvert en review 2026-08-14).
beforeAll(() => {
  jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'setTimeout', 'setInterval', 'queueMicrotask', 'setUTCHours'] as never, now: new Date('2026-04-15T12:00:00Z') });
});
afterAll(() => jest.useRealTimers());

const seasonStartIso = '2025-08-15T19:00:00Z';
const inSeasonIso = '2026-04-10T19:00:00Z';
const outOfSeasonIso = '2025-04-10T19:00:00Z';

function game(overrides: Partial<any> = {}) {
  return {
    id: overrides.id ?? Math.floor(Math.random() * 1_000_000),
    startTime: overrides.startTime ?? seasonStartIso,
    competitionId: overrides.competitionId ?? 35, // L1
    statusGroup: overrides.statusGroup ?? 4, // FINISHED
    homeCompetitor: overrides.homeCompetitor ?? { id: 465, name: 'Lyon', score: 2 },
    awayCompetitor: overrides.awayCompetitor ?? { id: 493, name: 'Angers', score: 1 },
    ...overrides,
  };
}

function withCwd<T>(fn: (dir: string) => Promise<T> | T): Promise<T> {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'season-matches-'));
  const original = process.cwd();
  process.chdir(tmp);
  return Promise.resolve(fn(tmp)).finally(() => {
    process.chdir(original);
    fs.rmSync(tmp, { recursive: true, force: true });
  });
}

function buildService(games: any[][], statuses: number[] = [200, 200]): SeasonMatchesService {
  const bus = new EventBusService();
  // football-data muet : ces specs portent sur la lecture de 365scores.
  const fixtures = { peekFixtures: () => [] } as unknown as FixturesService;
  const svc = new SeasonMatchesService(bus, fixtures);
  let call = 0;
  svc.fetcher = jest.fn(async () => {
    const idx = Math.min(call, games.length - 1);
    const status = statuses[Math.min(call, statuses.length - 1)] ?? 200;
    call++;
    return {
      ok: status === 200,
      status,
      json: async () => ({ games: games[idx] }),
    } as any;
  }) as any;
  return svc;
}

describe('SeasonMatchesService', () => {
  it('returns empty when fetch returns non-ok', async () => {
    await withCwd(async () => {
      const svc = buildService([[]], [503]);
      const result = await svc.getMatches({ force: true });
      expect(result).toEqual([]);
    });
  });

  it('keeps Ligue 1 + Coupe de France + Europa League + Champions League (proper and qualifiers) and tags competitionCode', async () => {
    await withCwd(async () => {
      const svc = buildService([
        [
          game({ id: 1, competitionId: 35, startTime: inSeasonIso }),
          game({ id: 2, competitionId: 37, startTime: inSeasonIso }),
          game({ id: 3, competitionId: 573, startTime: inSeasonIso }),
          game({ id: 4, competitionId: 99, startTime: inSeasonIso }), // unknown comp → dropped
          game({ id: 5, competitionId: 572, startTime: inSeasonIso, roundNum: 3 }),
          game({ id: 6, competitionId: 332, startTime: inSeasonIso }),
        ],
        [], // upcoming page
      ]);
      const result = await svc.getMatches({ force: true });
      expect(
        result.map((m) => [m.id, m.competitionCode, m.competition]).sort(),
      ).toEqual([
        [1, 'L1', 'Ligue 1'],
        [2, 'CDF', 'Coupe de France'],
        [3, 'UEL', 'Ligue Europa'],
        [5, 'UCL', 'Ligue des champions'],
        [6, 'UCL', 'Ligue des champions'],
      ]);
    });
  });

  it('round : seulement sans journée, à partir du tour (stageName) et de la manche (legNum) ; un tour inconnu n’est pas affiché en anglais', async () => {
    await withCwd(async () => {
      const svc = buildService([
        [
          // Journée connue : pas de tour, même si un tour est donné.
          game({ id: 1, competitionId: 572, startTime: inSeasonIso, roundNum: 3, stageName: 'League Phase' }),
          game({ id: 2, competitionId: 332, startTime: inSeasonIso, stageName: '2nd Round', legNum: 1 }),
          game({ id: 3, competitionId: 332, startTime: inSeasonIso, stageName: 'Playoffs', legNum: 2 }),
          // Tour sans traduction connue : la manche seule.
          game({ id: 4, competitionId: 572, startTime: inSeasonIso, stageName: 'Round of 16', legNum: 2 }),
          // Coupe de France : ni tour traduit ni manche → rien.
          game({ id: 5, competitionId: 37, startTime: inSeasonIso, stageName: 'Round of 64' }),
        ],
        [],
      ]);
      const result = await svc.getMatches({ force: true });
      expect(result.map((m) => [m.id, m.matchday, m.round]).sort()).toEqual([
        [1, 3, null],
        [2, null, '2e tour de qualification · aller'],
        [3, null, 'Barrages · retour'],
        [4, null, 'retour'],
        [5, null, null],
      ]);
    });
  });

  it('round : « 1er tour » (singulier ordinal), les autres « Ne tour » ; la journée l’emporte sur le tour ET sur la manche', async () => {
    await withCwd(async () => {
      const svc = buildService([
        [
          game({ id: 1, competitionId: 332, startTime: inSeasonIso, stageName: '1st Round', legNum: 1 }),
          game({ id: 2, competitionId: 332, startTime: inSeasonIso, stageName: '3rd Round' }),
          // Journée connue : ni le tour ni la manche ne sont repris.
          game({ id: 3, competitionId: 332, startTime: inSeasonIso, roundNum: 2, stageName: '2nd Round', legNum: 2 }),
          // Tour traduit ailleurs que dans les qualifications : non affiché.
          game({ id: 4, competitionId: 572, startTime: inSeasonIso, stageName: '1st Round', legNum: 1 }),
        ],
        [],
      ]);
      const result = await svc.getMatches({ force: true });
      expect(result.map((m) => [m.id, m.matchday, m.round]).sort()).toEqual([
        [1, null, '1er tour de qualification · aller'],
        [2, null, '3e tour de qualification'],
        [3, 2, null],
        [4, null, 'aller'],
      ]);
    });
  });

  describe('stageLabel et legLabel', () => {
    it('stageLabel : qualifications seules, tour absent ou inconnu → null', () => {
      expect(stageLabel(332, '1st Round')).toBe('1er tour de qualification');
      expect(stageLabel(332, '2nd Round')).toBe('2e tour de qualification');
      expect(stageLabel(332, 'Playoffs')).toBe('Barrages');
      expect(stageLabel(332, 'Final')).toBeNull();
      expect(stageLabel(332, undefined)).toBeNull();
      expect(stageLabel(572, '1st Round')).toBeNull();
    });
    it('legLabel : 1 aller, 2 retour, le reste null', () => {
      expect(legLabel(1)).toBe('aller');
      expect(legLabel(2)).toBe('retour');
      expect(legLabel(3)).toBeNull();
      expect(legLabel(undefined)).toBeNull();
    });
  });

  it('journalise les compétitions non suivies de la saison au lieu de les écarter en silence', async () => {
    await withCwd(async () => {
      const svc = buildService([
        [
          game({ id: 1, competitionId: 35, startTime: inSeasonIso }),
          game({ id: 2, competitionId: 99, competitionDisplayName: 'Trophée X', startTime: inSeasonIso }),
          game({ id: 3, competitionId: 99, competitionDisplayName: 'Trophée X', startTime: inSeasonIso }),
          game({ id: 4, competitionId: 98, startTime: outOfSeasonIso }), // hors saison : pas signalé
        ],
        [],
      ]);
      const warn = jest
        .spyOn((svc as unknown as { logger: { warn: (m: string) => void } }).logger, 'warn')
        .mockImplementation(() => undefined);
      await svc.getMatches({ force: true });
      const untracked = warn.mock.calls.map(([m]) => m).filter((m) => m.includes('non suivie'));
      expect(untracked).toHaveLength(1);
      expect(untracked[0]).toContain('#99');
      expect(untracked[0]).toContain('Trophée X');
      expect(untracked[0]).toContain('2 match');
      expect(untracked[0]).not.toContain('#98');
    });
  });

  it('drops events before season start', async () => {
    await withCwd(async () => {
      const svc = buildService([
        [
          game({ id: 1, competitionId: 35, startTime: outOfSeasonIso }),
          game({ id: 2, competitionId: 35, startTime: inSeasonIso }),
        ],
        [],
      ]);
      const result = await svc.getMatches({ force: true });
      expect(result.map((m) => m.id)).toEqual([2]);
    });
  });

  it('remaps OL 365scores id (465) to football-data id (523) on the boundary', async () => {
    await withCwd(async () => {
      const svc = buildService([
        [
          game({
            id: 10,
            competitionId: 35,
            startTime: inSeasonIso,
            homeCompetitor: { id: 465, name: 'Lyon', score: 2 },
            awayCompetitor: { id: 493, name: 'Angers', score: 1 },
          }),
        ],
        [],
      ]);
      const result = await svc.getMatches({ force: true });
      expect(result).toHaveLength(1);
      expect(result[0].homeTeamId).toBe(523);
      expect(result[0].awayTeamId).toBe(493);
    });
  });

  it('marks SCHEDULED matches without scores', async () => {
    await withCwd(async () => {
      const svc = buildService([
        [],
        [
          game({
            id: 99,
            competitionId: 35,
            startTime: inSeasonIso,
            statusGroup: 1, // SCHEDULED
            homeCompetitor: { id: 482, name: 'Toulouse' },
            awayCompetitor: { id: 465, name: 'Lyon' },
          }),
        ],
      ]);
      const result = await svc.getMatches({ force: true });
      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('SCHEDULED');
      expect(result[0].homeScore).toBeNull();
      expect(result[0].awayScore).toBeNull();
    });
  });

  it('dedupes events appearing in both the results and upcoming endpoints', async () => {
    await withCwd(async () => {
      const svc = buildService([
        [game({ id: 42, competitionId: 35, startTime: inSeasonIso })],
        [game({ id: 42, competitionId: 35, startTime: inSeasonIso })],
      ]);
      const result = await svc.getMatches({ force: true });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(42);
    });
  });

  describe('score cumulé du match retour (L51)', () => {
    const ol = (score: number) => ({ id: 465, name: 'Lyon', score });
    const adv = (score: number) => ({ id: 800, name: 'Sparta', score });
    const run = async (games: any[]) => {
      let out: any[] = [];
      await withCwd(async () => {
        out = await buildService([games]).getMatches({ force: true });
      });
      return out;
    };
    const first = game({ id: 10, competitionId: 332, legNum: 1, startTime: '2026-08-06T19:00:00Z', homeCompetitor: adv(2), awayCompetitor: ol(1) });

    it('retour joué : cumul des deux manches, dans le sens domicile / extérieur du retour', async () => {
      const second = game({ id: 11, competitionId: 332, legNum: 2, startTime: inSeasonIso, homeCompetitor: ol(3), awayCompetitor: adv(0) });
      const result = await run([first, second]);
      expect(result.find((m) => m.id === 11)!.aggregateScore).toEqual({ home: 4, away: 2 });
    });

    it('la manche aller, un match sans manche et un retour introuvable aller n’ont pas de cumul', async () => {
      const alone = game({ id: 12, competitionId: 332, legNum: 2, startTime: inSeasonIso, homeCompetitor: ol(1), awayCompetitor: { id: 900, name: 'Autre', score: 1 } });
      const league = game({ id: 13, competitionId: 35, startTime: inSeasonIso, homeCompetitor: ol(1), awayCompetitor: adv(1) });
      const result = await run([first, alone, league]);
      expect([10, 12, 13].map((id) => result.find((m) => m.id === id)!.aggregateScore)).toEqual([null, null, null]);
    });

    it('retour pas encore joué : pas de cumul', async () => {
      const upcoming = game({ id: 14, competitionId: 332, legNum: 2, statusGroup: 2, startTime: inSeasonIso, homeCompetitor: ol(0), awayCompetitor: adv(0) });
      const result = await run([first, upcoming]);
      expect(result.find((m) => m.id === 14)!.aggregateScore).toBeNull();
    });
  });

  describe('tirs au but (L135)', () => {
    const ol = (score: number, isQualified?: boolean) => ({ id: 465, name: 'Lyon', score, ...(isQualified === undefined ? {} : { isQualified }) });
    const adv = (score: number, isQualified?: boolean) => ({ id: 800, name: 'Rennes', score, ...(isQualified === undefined ? {} : { isQualified }) });
    const run = async (games: any[]) => {
      let out: any[] = [];
      await withCwd(async () => {
        out = await buildService([games]).getMatches({ force: true });
      });
      return out;
    };

    it('match de coupe nul sans manche retour : le qualifié désigné par 365scores gagne aux tirs au but', async () => {
      const [m] = await run([
        game({ id: 1, competitionId: 37, startTime: inSeasonIso, homeCompetitor: ol(1, true), awayCompetitor: adv(1, false) }),
      ]);
      expect(m.shootoutWinnerId).toBe(523); // identifiant football-data de l'OL
    });

    it('l’adversaire qualifié : son identifiant', async () => {
      const [m] = await run([
        game({ id: 1, competitionId: 37, startTime: inSeasonIso, homeCompetitor: ol(1, false), awayCompetitor: adv(1, true) }),
      ]);
      expect(m.shootoutWinnerId).toBe(800);
    });

    it('un nul de championnat, ou sans qualifié désigné, n’a pas de tirs au but', async () => {
      const result = await run([
        game({ id: 1, competitionId: 35, startTime: inSeasonIso, homeCompetitor: ol(1), awayCompetitor: adv(1) }),
        game({ id: 2, competitionId: 37, startTime: inSeasonIso, homeCompetitor: ol(1, false), awayCompetitor: adv(1, false) }),
        game({ id: 3, competitionId: 37, startTime: inSeasonIso, homeCompetitor: ol(2, true), awayCompetitor: adv(1, false) }),
      ]);
      expect(result.map((m) => m.shootoutWinnerId)).toEqual([null, null, null]);
    });

    it('manche retour nulle : tirs au but seulement si le cumul des deux manches est nul', async () => {
      const first = (a: number, b: number) => game({ id: 10, competitionId: 573, legNum: 1, startTime: '2026-04-01T19:00:00Z', homeCompetitor: adv(a), awayCompetitor: ol(b) });
      const second = game({ id: 11, competitionId: 573, legNum: 2, startTime: inSeasonIso, homeCompetitor: ol(1, true), awayCompetitor: adv(1, false) });
      const aggregateWin = await run([first(0, 1), second]); // 1-0 puis 1-1 : qualifié sur le cumul
      expect(aggregateWin.find((m) => m.id === 11)!.shootoutWinnerId).toBeNull();
      const shootout = await run([first(1, 1), second]); // cumul 2-2
      expect(shootout.find((m) => m.id === 11)!.shootoutWinnerId).toBe(523);
    });

    it('manche retour nulle dont l’aller est introuvable : null, jamais un tir au but supposé', async () => {
      const second = game({ id: 11, competitionId: 573, legNum: 2, startTime: inSeasonIso, homeCompetitor: ol(1, true), awayCompetitor: adv(1, false) });
      const [m] = await run([second]);
      expect(m.shootoutWinnerId).toBeNull();
    });

    it('manche aller nulle : jamais de tirs au but, même si un côté porte isQualified', async () => {
      const first = game({ id: 10, competitionId: 573, legNum: 1, startTime: inSeasonIso, homeCompetitor: ol(1, true), awayCompetitor: adv(1, false) });
      const [m] = await run([first]);
      expect(m.shootoutWinnerId).toBeNull();
    });

    it('match à journée (phase de ligue européenne) : jamais de tirs au but, même nul avec un isQualified', async () => {
      const [m] = await run([
        game({ id: 1, competitionId: 573, roundNum: 4, startTime: inSeasonIso, homeCompetitor: ol(1, true), awayCompetitor: adv(1, false) }),
      ]);
      expect(m.shootoutWinnerId).toBeNull();
    });

    it('matchesChanged : un qualifié aux tirs au but qui arrive après le score est un changement', () => {
      const svc = buildService([[]]) as any;
      const base = { id: 1, status: 'FINISHED', homeScore: 1, awayScore: 1, date: inSeasonIso, shootoutWinnerId: null };
      expect(svc.matchesChanged([base], [{ ...base }])).toBe(false);
      expect(svc.matchesChanged([base], [{ ...base, shootoutWinnerId: 523 }])).toBe(true);
    });
  });
});
