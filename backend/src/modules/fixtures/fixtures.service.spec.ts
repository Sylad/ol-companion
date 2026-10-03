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
