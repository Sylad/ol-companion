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
});
