/* eslint-disable @typescript-eslint/no-require-imports */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

/**
 * L34 — quand 365scores est en panne, le classement périmé (TTL 1 h dépassé) reste servi, avec son âge, au
 * lieu de `null`. Les chemins de cache sont résolus au chargement du module : on se place dans un dossier
 * temporaire AVANT de le charger (jamais backend/data/).
 */
const TABLE = { season: '2026', updatedAt: '2026-10-22T08:00:00.000Z', currentMatchday: 9, table: [] };
const AGE_MS = 3 * 3600_000;

describe('StandingsService — dernier classement connu (L34)', () => {
  let previousCwd: string;
  let tmpDir: string;
  let StandingsService: typeof import('./standings.service').StandingsService;
  let fetchSpy: jest.SpyInstance;
  const cacheFile = () => path.join(tmpDir, 'data', 'standings-cache.json');
  const writeCache = (ageMs: number) => {
    fs.mkdirSync(path.dirname(cacheFile()), { recursive: true });
    fs.writeFileSync(cacheFile(), JSON.stringify({ ts: Date.now() - ageMs, data: TABLE }));
  };
  const service = () => new StandingsService({ emit: jest.fn() } as never);

  beforeAll(() => {
    previousCwd = process.cwd();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ol-standings-l34-'));
    process.chdir(tmpDir);
    const { Logger } = require('@nestjs/common') as typeof import('@nestjs/common');
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    ({ StandingsService } = require('./standings.service') as typeof import('./standings.service'));
  });

  beforeEach(() => {
    fs.rmSync(cacheFile(), { force: true });
    fetchSpy = jest.spyOn(global, 'fetch');
  });
  afterEach(() => fetchSpy.mockRestore());
  afterAll(() => {
    jest.restoreAllMocks();
    process.chdir(previousCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('R1 — 365scores en échec HTTP, cache périmé de 3 h : le classement est servi, marqué périmé avec la date de la copie', async () => {
    writeCache(AGE_MS);
    fetchSpy.mockResolvedValue({ ok: false, status: 503 } as Response);
    const standings = await service().getCurrentStandings();
    expect(standings).toMatchObject({ currentMatchday: 9, stale: true });
    const age = Date.now() - Date.parse(standings!.cachedAt!);
    expect(age).toBeGreaterThan(AGE_MS - 5_000);
    expect(age).toBeLessThan(AGE_MS + 5_000);
  });

  it('R2 — 200 sans classement exploitable (enveloppe vide) : même repli', async () => {
    writeCache(AGE_MS);
    fetchSpy.mockResolvedValue(new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }));
    expect(await service().getCurrentStandings({ force: true })).toMatchObject({ currentMatchday: 9, stale: true });
  });

  it('R3 — panne réseau (fetch qui rejette) : même repli', async () => {
    writeCache(AGE_MS);
    fetchSpy.mockRejectedValue(new Error('ECONNRESET'));
    expect(await service().getCurrentStandings()).toMatchObject({ currentMatchday: 9, stale: true });
  });

  it('R4 — sans aucune copie, une panne rend toujours null', async () => {
    fetchSpy.mockResolvedValue({ ok: false, status: 503 } as Response);
    expect(await service().getCurrentStandings()).toBeNull();
  });

  it('R5 — une copie encore fraîche est servie telle quelle, sans appel ni marque de péremption', async () => {
    writeCache(60_000);
    const standings = await service().getCurrentStandings();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(standings).toMatchObject({ currentMatchday: 9 });
    expect(standings).not.toHaveProperty('stale');
    expect(standings).not.toHaveProperty('cachedAt');
  });

  it('R6 — la copie périmée servie n\'est pas réécrite : son âge reste celui du dernier appel réussi', async () => {
    writeCache(AGE_MS);
    const before = fs.readFileSync(cacheFile(), 'utf-8');
    fetchSpy.mockResolvedValue({ ok: false, status: 503 } as Response);
    await service().getCurrentStandings();
    expect(fs.readFileSync(cacheFile(), 'utf-8')).toBe(before);
  });
});
