/* eslint-disable @typescript-eslint/no-require-imports */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

/**
 * L35 — `StandingsService.getCurrentStandings` face aux rendus dégradés de
 * 365scores (charges réelles du 03/10/2026, cf. `scores365-standings.spec.ts`) :
 *  - des lignes sans `competitor` ne vident plus le classement : les 18 équipes
 *    sortent, nommées, dans l'ordre ;
 *  - jamais de classement incomplet : une ligne qu'on ne sait pas attribuer
 *    rend null, rien n'est écrit en cache ;
 *  - chaque rendu null dit pourquoi dans les logs (l'enveloppe vide était muette).
 *
 * Les chemins de cache sont résolus au chargement du module : on se place dans
 * un dossier temporaire AVANT de le charger (jamais backend/data/).
 */
const FIXTURES = path.resolve(__dirname, '../../../test/fixtures');
const fixture = (name: string): string =>
  fs.readFileSync(path.join(FIXTURES, name), 'utf-8');

const NAMES_IN_ORDER = [
  'Monaco',
  'Lyon',
  'Paris FC',
  'Lille',
  'Rennes',
  'PSG',
  'Angers',
  'Strasbourg',
  'Le Mans',
  'Auxerre',
  'Brest',
  'Lorient',
  'Toulouse',
  'OGC Nice',
  'Lens',
  'Troyes',
  'Olympique de Marseille',
  'Le Havre',
];

describe('StandingsService — rendus dégradés de 365scores (L35)', () => {
  const realFetch = globalThis.fetch;
  let previousCwd: string;
  let tmpDir: string;
  let StandingsService: typeof import('./standings.service').StandingsService;
  let warn: jest.SpyInstance;
  let error: jest.SpyInstance;
  let answer: () => Response;
  let calls: string[];

  const json = (body: string) =>
    new Response(body, {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });

  const service = () => new StandingsService({ emit: jest.fn() } as never);
  const cacheFile = () => path.join(tmpDir, 'data', 'standings-cache.json');
  const logged = () =>
    [
      ...(warn.mock.calls as unknown[][]),
      ...(error.mock.calls as unknown[][]),
    ].map((c) => String(c[0]));

  beforeAll(() => {
    previousCwd = process.cwd();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ol-standings-l35-'));
    fs.mkdirSync(path.join(tmpDir, 'data'));
    process.chdir(tmpDir);

    const { Logger } =
      require('@nestjs/common') as typeof import('@nestjs/common');
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    error = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});

    ({ StandingsService } =
      require('./standings.service') as typeof import('./standings.service'));
  });

  beforeEach(() => {
    calls = [];
    warn.mockClear();
    error.mockClear();
    fs.rmSync(cacheFile(), { force: true });
    globalThis.fetch = (input: unknown) => {
      calls.push(String(input));
      return Promise.resolve(answer());
    };
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  afterAll(() => {
    jest.restoreAllMocks();
    process.chdir(previousCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('rend les 18 équipes, nommées et dans l’ordre, quand 2 lignes arrivent sans « competitor »', async () => {
    answer = () =>
      json(fixture('365_standings_ligue1_rows_without_competitor.json'));

    const standings = await service().getCurrentStandings({ force: true });

    expect(calls).toHaveLength(1);
    expect(standings?.table.map((t) => t.team)).toEqual(NAMES_IN_ORDER);
    expect(standings?.table.map((t) => t.position)).toEqual(
      Array.from({ length: 18 }, (_, i) => i + 1),
    );
    expect(standings?.table[2]).toMatchObject({
      position: 3,
      team: 'Paris FC',
      teamId: 6075,
      played: 5,
      points: 11,
      goalDifference: 5,
    });
    expect(standings?.table[15]).toMatchObject({
      position: 16,
      team: 'Troyes',
      teamId: 488,
      points: 4,
    });
    // OL garde son identifiant football-data.
    expect(standings?.table[1]).toMatchObject({ team: 'Lyon', teamId: 523 });
    expect(standings?.season).toBe('2026');
  });

  it('rend le même classement que le rendu complet capturé au même moment', async () => {
    answer = () =>
      json(fixture('365_standings_ligue1_rows_without_competitor.json'));
    const fromDegraded = await service().getCurrentStandings({ force: true });
    answer = () => json(fixture('365_standings_ligue1_complete.json'));
    const fromComplete = await service().getCurrentStandings({ force: true });

    expect(fromComplete?.table).toHaveLength(18);
    expect(fromDegraded?.table).toEqual(fromComplete?.table);
  });

  it('dit dans les logs quels clubs ont été retrouvés par les matchs', async () => {
    answer = () =>
      json(fixture('365_standings_ligue1_rows_without_competitor.json'));

    await service().getCurrentStandings({ force: true });

    expect(logged().join('\n')).toContain(
      '3 → Paris FC (#6075), 16 → Troyes (#488)',
    );
  });

  it('enveloppe vide (200, 121 octets, pas de clé standings) : null, ET un log qui dit pourquoi', async () => {
    answer = () => json(fixture('365_standings_ligue1_empty_envelope.json'));

    const standings = await service().getCurrentStandings({ force: true });

    expect(standings).toBeNull();
    expect(logged().join('\n')).toContain('no standings');
    expect(fs.existsSync(cacheFile())).toBe(false);
  });

  it('ligne sans club impossible à attribuer : null et log, jamais un classement à 17', async () => {
    const payload = JSON.parse(
      fixture('365_standings_ligue1_rows_without_competitor.json'),
    ) as { standings: Array<{ rows: Array<Record<string, unknown>> }> };
    delete payload.standings[0].rows[2].detailedRecentForm;
    delete payload.standings[0].rows[2].nextMatch;
    answer = () => json(JSON.stringify(payload));

    const standings = await service().getCurrentStandings({ force: true });

    expect(standings).toBeNull();
    expect(logged().join('\n')).toContain('position 3');
    expect(fs.existsSync(cacheFile())).toBe(false);
  });

  it.each([
    ['HTTP 504', () => new Response('<html>504</html>', { status: 504 })],
    ['corps non JSON', () => json('<html>504 Gateway Time-out</html>')],
    [
      'forme inconnue (ligne sans position)',
      () => json(JSON.stringify({ standings: [{ rows: [{ points: 3 }] }] })),
    ],
    [
      'enveloppe vide',
      () => json(fixture('365_standings_ligue1_empty_envelope.json')),
    ],
  ])('aucun rendu null muet — %s', async (_label, response) => {
    answer = response;

    const standings = await service().getCurrentStandings({ force: true });

    expect(standings).toBeNull();
    expect(logged().length).toBeGreaterThan(0);
  });
});
