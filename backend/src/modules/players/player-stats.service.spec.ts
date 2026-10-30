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

    it('R8 — remise à zéro de saison du 1er août : la copie de la saison passée est vidée, une reconstruction à moins de matchs la remplace', async () => {
      await withCwd(async () => {
        const bus = new EventBusService();
        let reset: () => void = () => undefined;
        const seasonReset = { onReset: (l: () => void) => (reset = l) } as any;
        const un = (await buildService().seasonMatches.getMatches())[0];
        const getMatches = jest.fn(async () => [un, { ...un, id: 4463861 }]);
        const svc = new PlayerStatsService(bus, { getMatches } as any, seasonReset);
        svc.fetcher = jest.fn(async () => ({ ok: true, status: 200, json: async () => fixture }) as any);
        expect((await svc.getAll())[0].matchesPlayed).toBe(2);
        reset();
        getMatches.mockResolvedValue([un]);
        jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 100 * 24 * HOUR);
        expect((await svc.getAll())[0].matchesPlayed).toBe(1);
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

  describe('détail de match en échec (L53)', () => {
    const HOUR = 60 * 60 * 1000;
    const ok = () => ({ ok: true, status: 200, json: async () => fixture }) as any;
    afterEach(() => jest.restoreAllMocks());

    async function serviceADeuxMatchs(second: (n: number) => any) {
      const { svc, seasonMatches } = buildService();
      const [un] = await seasonMatches.getMatches();
      seasonMatches.getMatches.mockResolvedValue([un, { ...un, id: 4463861 }]);
      let appelsSecond = 0;
      svc.fetcher = jest.fn(async (url: any) =>
        String(url).includes('gameId=4463861') ? second(++appelsSecond) : ok(),
      );
      return svc;
    }

    it('R1 — un détail en timeout est relu une fois avant de renoncer : le match rattrapé est dans les stats', async () => {
      await withCwd(async () => {
        const svc = await serviceADeuxMatchs((n) => {
          if (n === 1) throw new DOMException('timeout', 'TimeoutError');
          return ok();
        });
        const all = await svc.getAll();
        expect(all[0].matchesPlayed).toBe(2);
      });
    });

    it('R2 — un match resté illisible après la relecture : stats bâties sur les autres, mais reprise sous 5 min (pas 1 h) et alerte nommant le match', async () => {
      await withCwd(async () => {
        const svc = await serviceADeuxMatchs(() => {
          throw new DOMException('timeout', 'TimeoutError');
        });
        const warn = jest.spyOn((svc as any).logger, 'warn');
        expect((await svc.getAll())[0].matchesPlayed).toBe(1);
        expect(warn.mock.calls.map((c) => String(c[0])).join('\n')).toContain('détails de match illisibles (4463861)');
        const fetcher = svc.fetcher as jest.Mock;
        const apres = fetcher.mock.calls.length;
        const now = Date.now();
        const clock = jest.spyOn(Date, 'now').mockReturnValue(now + 60_000);
        await svc.getAll();
        expect(fetcher.mock.calls.length).toBe(apres);
        // 6 min plus tard : le match manquant est réessayé, et, rattrapé, la copie est complète.
        svc.fetcher = jest.fn(async () => ok());
        clock.mockReturnValue(now + 6 * 60_000);
        expect((await svc.getAll())[0].matchesPlayed).toBe(2);
        clock.mockReturnValue(now + 6 * 60_000 + HOUR / 2);
        const fetcher2 = svc.fetcher as jest.Mock;
        const n2 = fetcher2.mock.calls.length;
        await svc.getAll();
        expect(fetcher2.mock.calls.length).toBe(n2);
      });
    });

    it('R3 — un HTTP non-2xx est traité comme un timeout (relu, puis reprise courte)', async () => {
      await withCwd(async () => {
        const svc = await serviceADeuxMatchs((n) => (n === 1 ? ({ ok: false, status: 503 } as any) : ok()));
        expect((await svc.getAll())[0].matchesPlayed).toBe(2);
      });
    });

    it('R3b — un HTTP non-2xx persistant : stats partielles, reprise sous 5 min et non 1 h', async () => {
      await withCwd(async () => {
        const svc = await serviceADeuxMatchs(() => ({ ok: false, status: 503 }) as any);
        expect((await svc.getAll())[0].matchesPlayed).toBe(1);
        const fetcher = svc.fetcher as jest.Mock;
        const apres = fetcher.mock.calls.length;
        const now = Date.now();
        const clock = jest.spyOn(Date, 'now').mockReturnValue(now + 60_000);
        await svc.getAll();
        expect(fetcher.mock.calls.length).toBe(apres);
        svc.fetcher = jest.fn(async () => ok());
        clock.mockReturnValue(now + 6 * 60_000);
        expect((await svc.getAll())[0].matchesPlayed).toBe(2);
      });
    });

    it('R6 — aucun détail lisible à la première passe : pas de seconde passe', async () => {
      await withCwd(async () => {
        const { svc, seasonMatches } = buildService();
        const [un] = await seasonMatches.getMatches();
        seasonMatches.getMatches.mockResolvedValue([un, { ...un, id: 4463861 }]);
        svc.fetcher = jest.fn(async () => {
          throw new DOMException('timeout', 'TimeoutError');
        });
        await svc.getAll();
        expect((svc.fetcher as jest.Mock).mock.calls.length).toBe(2);
      });
    });

    it('R4 — tous les matchs lus : TTL normal d\'une heure, aucune alerte', async () => {
      await withCwd(async () => {
        const svc = await serviceADeuxMatchs(() => ok());
        const warn = jest.spyOn((svc as any).logger, 'warn');
        await svc.getAll();
        const fetcher = svc.fetcher as jest.Mock;
        const n = fetcher.mock.calls.length;
        jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 30 * 60_000);
        await svc.getAll();
        expect(fetcher.mock.calls.length).toBe(n);
        expect(warn).not.toHaveBeenCalled();
      });
    });
  });

  describe('latence à froid (L126)', () => {
    const matchN = (n: number) =>
      Array.from({ length: n }, (_, i) => ({
        id: 5000 + i,
        date: `2026-0${(i % 9) + 1}-10T20:00:00+02:00`,
        homeTeam: 'Lyon',
        homeTeamId: 523,
        awayTeam: `Adv ${i}`,
        awayTeamId: 1000 + i,
        homeScore: 1,
        awayScore: 0,
        competition: 'Ligue 1',
        competitionCode: 'L1' as const,
        competitionId: 35,
        status: 'FINISHED' as const,
        matchday: null,
      }));
    const ok = () =>
      ({ ok: true, status: 200, json: async () => fixture }) as any;
    afterEach(() => jest.restoreAllMocks());

    it('R1 — la reconstruction lit plusieurs détails en même temps, jamais plus de 6, et plus vite que l\'un après l\'autre', async () => {
      await withCwd(async () => {
        const { svc, seasonMatches } = buildService();
        seasonMatches.getMatches.mockResolvedValue(matchN(18));
        let enVol = 0;
        let maxEnVol = 0;
        svc.fetcher = jest.fn(async () => {
          enVol++;
          maxEnVol = Math.max(maxEnVol, enVol);
          await new Promise((r) => setTimeout(r, 30));
          enVol--;
          return ok();
        });
        const t0 = Date.now();
        await svc.getAll();
        const duree = Date.now() - t0;
        expect(maxEnVol).toBeGreaterThan(1);
        expect(maxEnVol).toBeLessThanOrEqual(6);
        // 18 × 30 ms = 540 ms l'un après l'autre ; 3 vagues de 6 ≈ 90 ms.
        expect(duree).toBeLessThan(300);
        expect(svc.fetcher).toHaveBeenCalledTimes(18);
      });
    });

    it('R2 — le résultat ne dépend pas de l\'ordre d\'arrivée des détails', async () => {
      await withCwd(async () => {
        const matches = matchN(8);
        const run = async (retardDe: (i: number) => number) => {
          const { svc, seasonMatches } = buildService();
          seasonMatches.getMatches.mockResolvedValue(matches);
          svc.fetcher = jest.fn(async (url: any) => {
            const i = Number(String(url).match(/gameId=(\d+)/)![1]) - 5000;
            await new Promise((r) => setTimeout(r, retardDe(i)));
            return ok();
          });
          return svc.getAll();
        };
        const croissant = await run((i) => i * 5);
        const decroissant = await run((i) => (7 - i) * 5);
        expect(decroissant).toEqual(croissant);
      });
    });

    it('R3 — un détail en échec parmi les parallèles est relu une fois et nommé s\'il manque encore, les autres sont gardés', async () => {
      await withCwd(async () => {
        const { svc, seasonMatches } = buildService();
        seasonMatches.getMatches.mockResolvedValue(matchN(8));
        const appels: Record<string, number> = {};
        svc.fetcher = jest.fn(async (url: any) => {
          const id = String(url).match(/gameId=(\d+)/)![1];
          appels[id] = (appels[id] ?? 0) + 1;
          return id === '5003' ? ({ ok: false, status: 503 } as any) : ok();
        });
        expect(await svc.getAll()).not.toHaveLength(0);
        expect(appels['5003']).toBe(2);
        expect(appels['5000']).toBe(1);
      });
    });

    it('R4 — au démarrage, une copie absente est préchauffée en arrière-plan : la première lecture ne relit rien', async () => {
      await withCwd(async () => {
        const { svc } = buildService();
        svc.onModuleInit();
        svc.onApplicationBootstrap();
        await new Promise((r) => setTimeout(r, 50));
        const fetcher = svc.fetcher as jest.Mock;
        const apresPrechauffage = fetcher.mock.calls.length;
        expect(apresPrechauffage).toBeGreaterThan(0);
        expect(await svc.getAll()).toHaveLength(11);
        expect(fetcher.mock.calls.length).toBe(apresPrechauffage);
        svc.onModuleDestroy();
      });
    });

    it('R5 — copie fraîche lue sur le disque : aucun préchauffage ; liste des matchs en échec : journalisé, pas de rejet', async () => {
      await withCwd(async () => {
        const { svc: premier } = buildService();
        await premier.getAll();
        const { svc, seasonMatches } = buildService();
        svc.onModuleInit();
        svc.onApplicationBootstrap();
        await new Promise((r) => setTimeout(r, 20));
        expect(svc.fetcher as jest.Mock).not.toHaveBeenCalled();
        expect(seasonMatches.getMatches).not.toHaveBeenCalled();
        svc.onModuleDestroy();
      });
      await withCwd(async () => {
        const { svc, seasonMatches } = buildService();
        seasonMatches.getMatches.mockRejectedValue(new Error('503'));
        const warn = jest.spyOn((svc as any).logger, 'warn');
        const rejets: unknown[] = [];
        const ecouteur = (e: unknown) => rejets.push(e);
        process.on('unhandledRejection', ecouteur);
        svc.onApplicationBootstrap();
        await new Promise((r) => setTimeout(r, 20));
        process.off('unhandledRejection', ecouteur);
        expect(rejets).toEqual([]);
        expect(warn).toHaveBeenCalledWith(
          expect.stringContaining('préchauffage impossible'),
        );
      });
    });

    it('R6 — season-matches-changed préchauffe la copie invalidée sans attendre une lecture', async () => {
      await withCwd(async () => {
        const { svc, bus } = buildService();
        svc.onModuleInit();
        await svc.getAll();
        const fetcher = svc.fetcher as jest.Mock;
        const avant = fetcher.mock.calls.length;
        bus.emit('season-matches-changed', { count: 1 });
        await new Promise((r) => setTimeout(r, 50));
        expect(fetcher.mock.calls.length).toBeGreaterThan(avant);
        svc.onModuleDestroy();
      });
    });
  });
});
