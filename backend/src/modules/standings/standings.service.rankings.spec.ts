import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

/**
 * L241 — `StandingsService` écrit `season-rankings.json` depuis les résultats de
 * toute la Ligue 1 (résultats réels J1–J9 2026-27), plus depuis une photo du
 * classement du moment. Cwd temporaire avant de charger le module : jamais backend/data/.
 */
const FIXTURES = path.resolve(__dirname, '../../../test/fixtures');
const fixture = (name: string): string => fs.readFileSync(path.join(FIXTURES, name), 'utf-8');

describe('StandingsService — tracker de classement recalculé (L241)', () => {
  const realFetch = globalThis.fetch;
  let previousCwd: string;
  let tmpDir: string;
  let StandingsService: typeof import('./standings.service').StandingsService;
  let resultsAnswer: () => Response;
  let emit: jest.Mock;

  const json = (body: string, status = 200) =>
    new Response(body, { status, headers: { 'content-type': 'application/json' } });
  const rankingsFile = () => path.join(tmpDir, 'data', 'season-rankings.json');
  const written = () => JSON.parse(fs.readFileSync(rankingsFile(), 'utf-8')) as { matchday: number; position: number }[];
  const refresh = () => new StandingsService({ emit } as never).getCurrentStandings({ force: true });

  beforeAll(() => {
    previousCwd = process.cwd();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ol-standings-l241-'));
    fs.mkdirSync(path.join(tmpDir, 'data'));
    process.chdir(tmpDir);
    const { Logger } = require('@nestjs/common') as typeof import('@nestjs/common'); // eslint-disable-line @typescript-eslint/no-require-imports
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    ({ StandingsService } = require('./standings.service') as typeof import('./standings.service')); // eslint-disable-line @typescript-eslint/no-require-imports
  });

  beforeEach(() => {
    emit = jest.fn();
    fs.rmSync(rankingsFile(), { force: true });
    resultsAnswer = () => json(fixture('ligue1-2026-results-j1-j9.json'));
    globalThis.fetch = ((input: unknown) =>
      Promise.resolve(
        String(input).includes('/web/games/results/')
          ? resultsAnswer()
          : json(fixture('365_standings_ligue1_complete.json')),
      )) as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  afterAll(() => {
    jest.restoreAllMocks();
    process.chdir(previousCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("écrit une entrée par journée, OL 1er à l'issue de la J7, et le dit sur le flux d'événements", async () => {
    await refresh();
    expect(written().map((r) => [r.matchday, r.position])).toEqual([
      [1, 3], [2, 3], [3, 2], [4, 4], [5, 2], [6, 4], [7, 1], [8, 5], [9, 3],
    ]);
    expect(emit).toHaveBeenCalledWith('season-rankings-changed', { matchdays: 9 });
  });

  it("remplace un ancien fichier faux (photo en cours de journée : J7 en 4e) sans rien garder", async () => {
    fs.writeFileSync(rankingsFile(), JSON.stringify([{ matchday: 7, position: 4, points: 14 }, { matchday: 40, position: 9, points: 1 }]));
    await refresh();
    expect(written().find((r) => r.matchday === 7)?.position).toBe(1);
    expect(written().some((r) => r.matchday === 40)).toBe(false);
  });

  it("ne réécrit ni n'émet rien quand le tracé est inchangé", async () => {
    await refresh();
    emit.mockClear();
    await refresh();
    expect(emit).not.toHaveBeenCalledWith('season-rankings-changed', expect.anything());
  });

  it("résultats de la ligue en échec (HTTP 503) : le tracé existant est conservé", async () => {
    await refresh();
    const before = fs.readFileSync(rankingsFile(), 'utf-8');
    resultsAnswer = () => json('', 503);
    await refresh();
    expect(fs.readFileSync(rankingsFile(), 'utf-8')).toBe(before);
  });
});
