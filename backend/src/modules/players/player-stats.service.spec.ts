import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { EventBusService } from '../events/event-bus.service';
import { PlayerStatsService } from './player-stats.service';

jest.mock('@nestjs/schedule', () => ({
  Cron: () => () => undefined,
}));

const fixture = JSON.parse(
  fs.readFileSync(
    path.resolve(
      __dirname,
      '../../../test/fixtures/365_game_lyon_rennes_live.json',
    ),
    'utf-8',
  ),
);

function withCwd<T>(fn: (dir: string) => Promise<T> | T): Promise<T> {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'player-stats-'));
  const original = process.cwd();
  process.chdir(tmp);
  return Promise.resolve(fn(tmp)).finally(() => {
    process.chdir(original);
    fs.rmSync(tmp, { recursive: true, force: true });
  });
}

function buildService() {
  const bus = new EventBusService();
  const seasonMatches = {
    getMatches: jest.fn(async () => [
      {
        id: 4463860,
        date: '2026-05-03T20:45:00+02:00',
        homeTeam: 'Lyon',
        homeTeamId: 523, // OL canonical id (already remapped from 365 465)
        awayTeam: 'Rennes',
        awayTeamId: 477,
        homeScore: 0,
        awayScore: 1,
        competition: 'Ligue 1',
        competitionCode: 'L1' as const,
        competitionId: 35,
        status: 'FINISHED' as const,
        matchday: null,
      },
    ]),
  } as any;

  const svc = new PlayerStatsService(bus, seasonMatches);
  svc.fetcher = jest.fn(
    async () =>
      ({
        ok: true,
        status: 200,
        json: async () => fixture,
      }) as any,
  );
  return { svc, bus, seasonMatches };
}

describe('PlayerStatsService', () => {
  it('rebuilds cache from finished season matches', async () => {
    await withCwd(async () => {
      const { svc } = buildService();
      const all = await svc.getAll();
      // Lyon-Rennes fixture has 11 OL starters who logged minutes.
      expect(all).toHaveLength(11);
      // Sorted by goalContributions desc → first entry should not have negative
      // contributions and array should be sorted.
      for (let i = 1; i < all.length; i++) {
        expect(all[i - 1].goalContributions).toBeGreaterThanOrEqual(
          all[i].goalContributions,
        );
      }
    });
  });

  it('serves a single player by athleteId', async () => {
    await withCwd(async () => {
      const { svc } = buildService();
      const all = await svc.getAll();
      const sample = all[0];
      const one = await svc.getOne(sample.athleteId);
      expect(one).toEqual(sample);
    });
  });

  it('returns null for an unknown athleteId', async () => {
    await withCwd(async () => {
      const { svc } = buildService();
      await svc.getAll();
      const missing = await svc.getOne(999_999);
      expect(missing).toBeNull();
    });
  });

  it('reuses cache on subsequent calls (no extra fetches within TTL)', async () => {
    await withCwd(async () => {
      const { svc } = buildService();
      const fetcher = svc.fetcher as jest.Mock;
      await svc.getAll();
      const callsAfterFirst = fetcher.mock.calls.length;
      await svc.getAll();
      await svc.getAll();
      expect(fetcher.mock.calls.length).toBe(callsAfterFirst);
    });
  });

  it('invalidates cache on season-matches-changed', async () => {
    await withCwd(async () => {
      const { svc, bus } = buildService();
      svc.onModuleInit();
      const fetcher = svc.fetcher as jest.Mock;
      await svc.getAll();
      const callsBefore = fetcher.mock.calls.length;
      bus.emit('season-matches-changed', { count: 1 });
      // After invalidation, next getAll should refetch.
      await svc.getAll();
      expect(fetcher.mock.calls.length).toBeGreaterThan(callsBefore);
      svc.onModuleDestroy();
    });
  });

  it('persists cache to disk and rehydrates on init', async () => {
    await withCwd(async (dir) => {
      const { svc } = buildService();
      await svc.getAll();
      const cacheFile = path.join(dir, 'data', 'player-stats-cache.json');
      expect(fs.existsSync(cacheFile)).toBe(true);

      // Fresh service instance, same cwd → should rehydrate from disk
      // without calling the fetcher.
      const { svc: svc2 } = buildService();
      svc2.onModuleInit();
      const fetcher2 = svc2.fetcher as jest.Mock;
      const all = await svc2.getAll();
      expect(all.length).toBeGreaterThan(0);
      expect(fetcher2.mock.calls.length).toBe(0);
      svc2.onModuleDestroy();
    });
  });

  describe('panne de 365scores (L34)', () => {
    const HOUR = 60 * 60 * 1000;
    const down = () => ({ ok: false, status: 503 }) as any;
    afterEach(() => jest.restoreAllMocks());

    it('R1 — TTL expiré et chaque match en échec : la dernière copie reste servie (fiche et liste), pas un cache vide', async () => {
      await withCwd(async () => {
        const { svc } = buildService();
        const all = await svc.getAll();
        const now = Date.now();
        jest.spyOn(Date, 'now').mockReturnValue(now + 2 * HOUR);
        svc.fetcher = jest.fn(async () => down());
        expect(await svc.getAll()).toEqual(all);
        expect(await svc.getOne(all[0].athleteId)).toEqual(all[0]);
      });
    });

    it('R2 — saison sans match terminé (liste vide) : la copie est bien remplacée, ce n\'est pas une panne', async () => {
      await withCwd(async () => {
        const { svc, seasonMatches } = buildService();
        expect(await svc.getAll()).not.toHaveLength(0);
        jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 2 * HOUR);
        seasonMatches.getMatches.mockResolvedValue([]);
        expect(await svc.getAll()).toEqual([]);
      });
    });

    it('R3 — la liste des matchs qui échoue ne vide pas la copie ; sans copie, l\'erreur remonte', async () => {
      await withCwd(async () => {
        const { svc, seasonMatches } = buildService();
        const all = await svc.getAll();
        const now = Date.now();
        jest.spyOn(Date, 'now').mockReturnValue(now + 2 * HOUR);
        seasonMatches.getMatches.mockRejectedValue(new Error('503'));
        expect(await svc.getAll()).toEqual(all);
        const { svc: vide, seasonMatches: sm2 } = buildService();
        sm2.getMatches.mockRejectedValue(new Error('503'));
        await expect(vide.getAll()).rejects.toThrow('503');
      });
    });

    it('R4 — invalidation sur season-matches-changed puis panne : la copie est gardée', async () => {
      await withCwd(async () => {
        const { svc, bus } = buildService();
        svc.onModuleInit();
        const all = await svc.getAll();
        svc.fetcher = jest.fn(async () => down());
        bus.emit('season-matches-changed', { count: 1 });
        expect(await svc.getAll()).toEqual(all);
        svc.onModuleDestroy();
      });
    });

    it('R5 — après un échec, pas de nouvelle salve d\'appels avant le délai de reprise (5 min), puis on réessaie', async () => {
      await withCwd(async () => {
        const { svc } = buildService();
        await svc.getAll();
        const now = Date.now();
        const clock = jest.spyOn(Date, 'now').mockReturnValue(now + 2 * HOUR);
        const fetcher = jest.fn(async () => down());
        svc.fetcher = fetcher;
        await svc.getAll();
        const apresEchec = fetcher.mock.calls.length;
        expect(apresEchec).toBeGreaterThan(0);
        clock.mockReturnValue(now + 2 * HOUR + 60_000);
        await svc.getAll();
        expect(fetcher.mock.calls.length).toBe(apresEchec);
        clock.mockReturnValue(now + 2 * HOUR + 6 * 60_000);
        await svc.getAll();
        expect(fetcher.mock.calls.length).toBeGreaterThan(apresEchec);
      });
    });

    it('R7 — panne partielle : moins de matchs lus que lors de la copie gardée, la copie reste servie et sur disque', async () => {
      await withCwd(async (dir) => {
        const { svc, seasonMatches } = buildService();
        const [un] = await seasonMatches.getMatches();
        seasonMatches.getMatches.mockResolvedValue([
          un,
          { ...un, id: 4463861 },
        ]);
        const all = await svc.getAll();
        const file = path.join(dir, 'data', 'player-stats-cache.json');
        const before = fs.readFileSync(file, 'utf-8');
        jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 2 * HOUR);
        svc.fetcher = jest.fn(async (url: any) =>
          String(url).includes('gameId=4463861')
            ? ({ ok: true, status: 200, json: async () => fixture } as any)
            : down(),
        );
        expect(await svc.getAll()).toEqual(all);
        expect(fs.readFileSync(file, 'utf-8')).toBe(before);
      });
    });

    it('R6 — la copie gardée n\'est pas réécrite sur disque (son âge reste celui du dernier succès)', async () => {
      await withCwd(async (dir) => {
        const { svc } = buildService();
        await svc.getAll();
        const file = path.join(dir, 'data', 'player-stats-cache.json');
        const before = fs.readFileSync(file, 'utf-8');
        jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 2 * HOUR);
        svc.fetcher = jest.fn(async () => down());
        await svc.getAll();
        expect(fs.readFileSync(file, 'utf-8')).toBe(before);
      });
    });
  });
});
