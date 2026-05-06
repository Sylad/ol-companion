import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { SeasonMatchesService } from './season-matches.service';
import { EventBusService } from '../events/event-bus.service';

jest.mock('@nestjs/schedule', () => ({
  Cron: () => () => undefined,
}));

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
  const svc = new SeasonMatchesService(bus);
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

  it('keeps Ligue 1 + Coupe de France + Europa League and tags competitionCode', async () => {
    await withCwd(async () => {
      const svc = buildService([
        [
          game({ id: 1, competitionId: 35, startTime: inSeasonIso }),
          game({ id: 2, competitionId: 37, startTime: inSeasonIso }),
          game({ id: 3, competitionId: 573, startTime: inSeasonIso }),
          game({ id: 4, competitionId: 99, startTime: inSeasonIso }), // unknown comp → dropped
        ],
        [], // upcoming page
      ]);
      const result = await svc.getMatches({ force: true });
      const codes = result.map((m) => m.competitionCode).sort();
      expect(codes).toEqual(['CDF', 'L1', 'UEL']);
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
});
