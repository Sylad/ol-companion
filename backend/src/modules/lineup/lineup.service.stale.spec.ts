/* eslint-disable @typescript-eslint/no-require-imports */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

/**
 * L34 — quand 365scores est en panne, la composition périmée (TTL 6 h dépassé) reste servie, avec son âge,
 * au lieu de `null`. Le chemin du cache est résolu au chargement du module : on se place dans un dossier
 * temporaire AVANT de le charger (jamais backend/data/).
 */
const SIX_HOURS = 6 * 3600_000;
const LINEUP = { gameId: 9, date: '2026-10-10T19:00:00Z', starters: [], bench: [], injured: [] };

describe('LineupService — dernière composition connue (L34)', () => {
  let previousCwd: string;
  let tmpDir: string;
  let LineupService: typeof import('./lineup.service').LineupService;
  let fetchSpy: jest.SpyInstance;
  const cacheFile = () => path.join(tmpDir, 'data', 'lineup-cache.json');
  const writeCache = (ageMs: number) => {
    fs.mkdirSync(path.dirname(cacheFile()), { recursive: true });
    fs.writeFileSync(cacheFile(), JSON.stringify({ ts: Date.now() - ageMs, data: LINEUP }));
  };

  beforeAll(() => {
    previousCwd = process.cwd();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ol-lineup-l34-'));
    process.chdir(tmpDir);
    const { Logger } = require('@nestjs/common') as typeof import('@nestjs/common');
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    ({ LineupService } = require('./lineup.service') as typeof import('./lineup.service'));
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

  it('R1 — 365scores en échec HTTP, cache périmé de 7 h : la composition est servie, marquée périmée avec la date de la copie', async () => {
    writeCache(7 * 3600_000);
    fetchSpy.mockResolvedValue({ ok: false, status: 503 } as Response);
    const lineup = await new LineupService().getLatestLineup();
    expect(lineup).toMatchObject({ gameId: 9, stale: true });
    const age = Date.now() - Date.parse(lineup!.cachedAt!);
    expect(age).toBeGreaterThan(7 * 3600_000 - 5_000);
    expect(age).toBeLessThan(7 * 3600_000 + 5_000);
  });

  it('R2 — panne réseau (fetch qui rejette) avec cache périmé : même repli, aussi en rafraîchissement forcé', async () => {
    writeCache(SIX_HOURS * 2);
    fetchSpy.mockRejectedValue(new Error('ECONNRESET'));
    const lineup = await new LineupService().getLatestLineup({ force: true });
    expect(lineup).toMatchObject({ gameId: 9, stale: true });
  });

  it('R3 — sans aucune copie, une panne rend toujours null', async () => {
    fetchSpy.mockResolvedValue({ ok: false, status: 503 } as Response);
    expect(await new LineupService().getLatestLineup()).toBeNull();
  });

  it('R4 — une copie encore fraîche est servie telle quelle, sans appel et sans marque de péremption', async () => {
    writeCache(60_000);
    const lineup = await new LineupService().getLatestLineup();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(lineup).toMatchObject({ gameId: 9 });
    expect(lineup).not.toHaveProperty('stale');
    expect(lineup).not.toHaveProperty('cachedAt');
  });

  it('R5 — la copie périmée servie n\'est pas réécrite : son âge reste celui du dernier appel réussi', async () => {
    writeCache(7 * 3600_000);
    const before = fs.readFileSync(cacheFile(), 'utf-8');
    fetchSpy.mockResolvedValue({ ok: false, status: 503 } as Response);
    await new LineupService().getLatestLineup();
    expect(fs.readFileSync(cacheFile(), 'utf-8')).toBe(before);
  });
});
