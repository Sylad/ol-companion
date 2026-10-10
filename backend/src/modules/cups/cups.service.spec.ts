import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const FIXTURES = /\/web\/games\/fixtures\//;

function game(id: number, statusGroup: number, startTime: string, ol: number | null, opp: number | null) {
  return {
    id, competitionId: 37, startTime, statusGroup, stageNum: 3,
    homeCompetitor: { id: 465, name: 'Lyon', score: ol ?? -1 },
    awayCompetitor: { id: 7, name: 'Autre', score: opp ?? -1 },
  };
}

describe('CupsService — appel des matchs à venir en échec', () => {
  const realFetch = global.fetch;
  const cwd = process.cwd();
  let tmp: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cups-'));
    process.chdir(tmp);
  });
  afterEach(() => {
    global.fetch = realFetch;
    process.chdir(cwd);
    fs.rmSync(tmp, { recursive: true, force: true });
    jest.resetModules();
  });

  async function load(seasonReset?: import('../scheduler/season-reset.service').SeasonResetService) {
    const { CupsService } = require('./cups.service') as typeof import('./cups.service');
    const { BracketService } = require('./bracket.service') as typeof import('./bracket.service');
    return new CupsService({} as never, new BracketService(), seasonReset);
  }

  const cacheFile = () => path.join(tmp, 'data', 'cups-cache.json');
  const MIN = 60_000;
  const upcomingMatch = {
    id: 2, date: new Date(Date.now() + 5 * 86_400_000).toISOString(), homeTeam: 'Lyon', homeTeamId: 465,
    awayTeam: 'X', awayTeamId: 8, homeScore: null, awayScore: null, status: 'SCHEDULED', stage: '', stageFr: '',
  };
  const knownCup = {
    competitionId: 37, name: 'Coupe de France', currentStageFr: '', isEliminated: false, matches: [upcomingMatch],
  };
  /** Résultats lisibles, matchs à venir en échec ; compte les appels aux matchs à venir. */
  function failingUpcoming() {
    const calls = { results: 0, fixtures: 0 };
    global.fetch = jest.fn(async (url: string | URL | Request) => {
      if (FIXTURES.test(String(url))) { calls.fixtures++; throw new Error('timeout'); }
      calls.results++;
      return new Response(JSON.stringify({ games: [game(1, 4, recent, 2, 0)] }), { status: 200 });
    }) as unknown as typeof fetch;
    return calls;
  }

  const recent = new Date(Date.now() - 3 * 86_400_000).toISOString();

  it('matchs à venir en échec : le verdict « Éliminé » du dernier résultat connu est conservé', async () => {
    const svc = await load();
    (svc as unknown as { lastKnown: unknown }).lastKnown = [{
      competitionId: 37, name: 'Coupe de France', currentStageFr: '32ème de finale', isEliminated: true, matches: [],
    }];
    global.fetch = jest.fn(async (url: string | URL | Request) => {
      if (FIXTURES.test(String(url))) throw new Error('timeout');
      return new Response(JSON.stringify({ games: [game(1, 4, recent, 0, 2)] }), { status: 200 });
    }) as unknown as typeof fetch;

    const cups = await svc.getCups({ force: true });

    expect(cups[0].isEliminated).toBe(true);
  });

  it('réessaie, puis ne conclut pas « Éliminé » et ne perd pas le dernier match à venir connu', async () => {
    const svc = await load();
    (svc as unknown as { lastKnown: unknown }).lastKnown = [{
      competitionId: 37, name: 'Coupe de France', currentStageFr: '', isEliminated: false,
      matches: [{
        id: 2, date: new Date(Date.now() + 5 * 86_400_000).toISOString(), homeTeam: 'Lyon', homeTeamId: 465,
        awayTeam: 'X', awayTeamId: 8, homeScore: null, awayScore: null, status: 'SCHEDULED', stage: '', stageFr: '',
      }],
    }];
    let fixtureCalls = 0;
    global.fetch = jest.fn(async (url: string | URL | Request) => {
      if (FIXTURES.test(String(url))) { fixtureCalls++; throw new Error('timeout'); }
      return new Response(JSON.stringify({ games: [game(1, 4, recent, 2, 0)] }), { status: 200 });
    }) as unknown as typeof fetch;

    const cups = await svc.getCups({ force: true });

    expect(fixtureCalls).toBe(3);
    expect(cups[0].matches.map((m) => m.id)).toContain(2);
    expect(cups[0].isEliminated).toBe(false);
  });

  it('défaite en coupe, matchs à venir connus et vides = éliminé', async () => {
    const svc = await load();
    global.fetch = jest.fn(async (url: string | URL | Request) =>
      new Response(JSON.stringify({ games: FIXTURES.test(String(url)) ? [] : [game(1, 4, recent, 0, 1)] }), { status: 200 }),
    ) as unknown as typeof fetch;
    const cups = await svc.getCups({ force: true });
    expect(cups[0].isEliminated).toBe(true);
  });

  describe('mode dégradé', () => {
    afterEach(() => jest.restoreAllMocks());

    it('cache écrit sans les matchs à venir : repris pendant 5 min, puis refait', async () => {
      const svc = await load();
      const calls = failingUpcoming();
      const t0 = Date.now();
      const now = jest.spyOn(Date, 'now').mockReturnValue(t0);
      await svc.getCups({ force: true });
      const afterFirst = calls.results;

      now.mockReturnValue(t0 + 4 * MIN);
      await svc.getCups();
      expect(calls.results).toBe(afterFirst);

      now.mockReturnValue(t0 + 6 * MIN);
      await svc.getCups();
      expect(calls.results).toBeGreaterThan(afterFirst);
    });

    it('cache complet : toujours valable 2 h', async () => {
      const svc = await load();
      let results = 0;
      global.fetch = jest.fn(async (url: string | URL | Request) => {
        if (!FIXTURES.test(String(url))) results++;
        return new Response(JSON.stringify({ games: FIXTURES.test(String(url)) ? [] : [game(1, 4, recent, 2, 0)] }), { status: 200 });
      }) as unknown as typeof fetch;
      const t0 = Date.now();
      const now = jest.spyOn(Date, 'now').mockReturnValue(t0);
      await svc.getCups({ force: true });
      const afterFirst = results;
      now.mockReturnValue(t0 + 100 * MIN);
      await svc.getCups();
      expect(results).toBe(afterFirst);
      now.mockReturnValue(t0 + 121 * MIN);
      await svc.getCups();
      expect(results).toBeGreaterThan(afterFirst);
    });

    it('lastKnown n\'est pas écrasé par un résultat sans matchs à venir', async () => {
      const svc = await load();
      const internal = svc as unknown as { lastKnown: unknown };
      internal.lastKnown = [knownCup];
      failingUpcoming();
      await svc.getCups({ force: true });
      expect(internal.lastKnown).toEqual([knownCup]);
    });

    it('lastKnown est mis à jour quand les matchs à venir répondent', async () => {
      const svc = await load();
      const internal = svc as unknown as { lastKnown: { matches: unknown[] }[] | null };
      internal.lastKnown = [knownCup];
      global.fetch = jest.fn(async (url: string | URL | Request) =>
        new Response(JSON.stringify({ games: FIXTURES.test(String(url)) ? [] : [game(1, 4, recent, 2, 0)] }), { status: 200 }),
      ) as unknown as typeof fetch;
      await svc.getCups({ force: true });
      expect(internal.lastKnown?.[0].matches).toHaveLength(1);
      expect((internal.lastKnown?.[0].matches[0] as { id: number }).id).toBe(1);
    });

    it('au démarrage : le cache périmé est repris dans lastKnown puis supprimé', async () => {
      fs.mkdirSync(path.join(tmp, 'data'));
      fs.writeFileSync(cacheFile(), JSON.stringify({ ts: Date.now() - 48 * 3_600_000, data: [knownCup] }));
      const svc = await load();
      const refresh = jest.spyOn(svc, 'getCups').mockResolvedValue([]);

      svc.onModuleInit();

      expect((svc as unknown as { lastKnown: unknown }).lastKnown).toEqual([knownCup]);
      expect(fs.existsSync(cacheFile())).toBe(false);
      expect(refresh).toHaveBeenCalledWith({ force: true });
    });

    it('au démarrage sans cache : lastKnown reste vide', async () => {
      const svc = await load();
      jest.spyOn(svc, 'getCups').mockResolvedValue([]);
      svc.onModuleInit();
      expect((svc as unknown as { lastKnown: unknown }).lastKnown).toBeNull();
    });
  });

  describe('remise à zéro de saison', () => {
    it('vide lastKnown comme le cache : le match à venir de la saison passée ne revient pas', async () => {
      const { SeasonResetService } = require('../scheduler/season-reset.service') as typeof import('../scheduler/season-reset.service');
      const reset = new SeasonResetService(path.join(tmp, 'data'));
      const svc = await load(reset);
      const internal = svc as unknown as { lastKnown: unknown };
      internal.lastKnown = [knownCup];

      await reset.resetSeason(new Date('2026-08-01T03:00:00'));

      expect(internal.lastKnown).toBeNull();
      failingUpcoming();
      const cups = await svc.getCups({ force: true });
      expect(cups[0].matches.map((m) => m.id)).toEqual([1]);
    });
  });

  it('lit l\'équipe qualifiée de la dernière manche (tirs au but) et la porte sur le match', async () => {
    const svc = await load();
    const shootout = {
      id: 1, competitionId: 37, startTime: recent, statusGroup: 4, stageNum: 3,
      homeCompetitor: { id: 465, name: 'Lyon', score: 1 },
      awayCompetitor: { id: 7, name: 'Autre', score: 1, isQualified: true },
    };
    global.fetch = jest.fn(async (url: string | URL | Request) =>
      new Response(JSON.stringify({ games: FIXTURES.test(String(url)) ? [] : [shootout] }), { status: 200 }),
    ) as unknown as typeof fetch;
    const cups = await svc.getCups({ force: true });
    expect(cups[0].matches[0].olQualified).toBe(false);
    expect(cups[0].isEliminated).toBe(true);
  });

  describe('Ligue Europa — phase de ligue terminée', () => {
    const STANDINGS = /\/web\/standings\//;
    const elGame = (id: number, daysAgo: number) => ({
      id, competitionId: 573, stageNum: 1, roundNum: id, statusGroup: 4,
      startTime: new Date(Date.now() - daysAgo * 86_400_000).toISOString(),
      homeCompetitor: { id: 465, name: 'Lyon', score: 1 },
      awayCompetitor: { id: 7, name: 'Autre', score: 0 },
    });
    function mockEl(standings: (() => Response) | 'fail') {
      global.fetch = jest.fn(async (url: string | URL | Request) => {
        const u = String(url);
        if (STANDINGS.test(u)) {
          if (standings === 'fail') throw new Error('timeout');
          return standings();
        }
        if (FIXTURES.test(u)) return new Response(JSON.stringify({ games: [] }), { status: 200 });
        return new Response(JSON.stringify({ games: Array.from({ length: 8 }, (_, i) => elGame(i + 1, 5 + i)) }), { status: 200 });
      }) as unknown as typeof fetch;
    }
    const table = (olRank: number) => () => new Response(JSON.stringify({
      standings: [{ isCurrentStage: true, rows: Array.from({ length: 36 }, (_, i) => ({
        position: i + 1, competitor: { id: i + 1 === olRank ? 465 : 1000 + i },
      })) }],
    }), { status: 200 });

    it('classé 28e : éliminé', async () => {
      mockEl(table(28));
      const [cup] = await (await load()).getCups({ force: true });
      expect(cup.isEliminated).toBe(true);
      expect(cup.awaitingDraw).toBeFalsy();
    });

    it('classé 12e : en lice, barrages', async () => {
      mockEl(table(12));
      const [cup] = await (await load()).getCups({ force: true });
      expect(cup.isEliminated).toBe(false);
      expect(cup.currentStageFr).toBe('Barrages');
      expect(cup.awaitingDraw).toBeFalsy();
    });

    it('classé 5e : en lice, huitièmes', async () => {
      mockEl(table(5));
      const [cup] = await (await load()).getCups({ force: true });
      expect(cup.currentStageFr).toBe('1/8 de finale');
    });

    it('classement illisible : ni éliminé ni « en lice » affirmé, en attente du tirage', async () => {
      mockEl('fail');
      const [cup] = await (await load()).getCups({ force: true });
      expect(cup.isEliminated).toBe(false);
      expect(cup.awaitingDraw).toBe(true);
    });
  });
});
