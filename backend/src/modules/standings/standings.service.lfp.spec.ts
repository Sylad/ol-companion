import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

/**
 * L243 — branchement de `sortByLfpRules` dans `StandingsService.getCurrentStandings` :
 * résultats de la Ligue 1 passés au tri, OL (teamId 523) lu sous son identifiant 365scores
 * (465) dans ces résultats, repli sans résultats. Cwd temporaire avant de charger le module.
 */
const FIXTURES = path.resolve(__dirname, '../../../test/fixtures');

const LYON_365 = 465;
const PARIS_FC = 6075;

/**
 * Lyon et le Paris FC : 11 points et +8 chacun, mais le Paris FC a marqué 12 buts contre 10.
 * Aux buts marqués seuls, le Paris FC passe devant ; avec la confrontation directe (critère 3,
 * avant les buts marqués), c'est Lyon, vainqueur 2-0 de leur match.
 */
function standingsBody(): string {
  const body = JSON.parse(
    fs.readFileSync(
      path.join(FIXTURES, '365_standings_ligue1_complete.json'),
      'utf-8',
    ),
  ) as {
    standings: {
      rows: {
        competitor: { id: number };
        ratio: number;
        for: number;
        against: number;
      }[];
    }[];
  };
  const rows = body.standings[0].rows;
  const parisFc = rows.find((r) => r.competitor.id === PARIS_FC);
  if (!parisFc) throw new Error('Paris FC absent de la fixture');
  Object.assign(parisFc, { ratio: 8, for: 12, against: 4 });
  return JSON.stringify(body);
}

const lyonBeatParisFc = JSON.stringify({
  games: [
    {
      id: 1,
      seasonNum: 94,
      roundNum: 1,
      statusGroup: 4,
      homeCompetitor: { id: LYON_365, score: 2 },
      awayCompetitor: { id: PARIS_FC, score: 0 },
    },
  ],
});

describe('StandingsService — départage LFP du classement du moment (L243)', () => {
  const realFetch = globalThis.fetch;
  let previousCwd: string;
  let tmpDir: string;
  let StandingsService: typeof import('./standings.service').StandingsService;
  let resultsAnswer: () => Response;

  const json = (body: string, status = 200) =>
    new Response(body, {
      status,
      headers: { 'content-type': 'application/json' },
    });
  const teams = async () => {
    const standings = await new StandingsService({
      emit: jest.fn(),
    } as never).getCurrentStandings({ force: true });
    return standings?.table.map((t) => t.teamId) ?? [];
  };

  beforeAll(() => {
    previousCwd = process.cwd();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ol-standings-l243-'));
    fs.mkdirSync(path.join(tmpDir, 'data'));
    process.chdir(tmpDir);
    const { Logger } =
      require('@nestjs/common') as typeof import('@nestjs/common'); // eslint-disable-line @typescript-eslint/no-require-imports
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    ({ StandingsService } =
      require('./standings.service') as typeof import('./standings.service')); // eslint-disable-line @typescript-eslint/no-require-imports
  });

  beforeEach(() => {
    resultsAnswer = () => json(lyonBeatParisFc);
    globalThis.fetch = ((input: unknown) =>
      Promise.resolve(
        String(input).includes('/web/games/results/')
          ? resultsAnswer()
          : json(standingsBody()),
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

  it("confrontation directe avant les buts marqués : l'OL (523, lu 465 dans les résultats) devant le Paris FC", async () => {
    const order = await teams();
    expect(order.indexOf(523)).toBeLessThan(order.indexOf(PARIS_FC));
  });

  it('résultats de la ligue en échec (HTTP 503) : classement rendu quand même, départage aux buts marqués', async () => {
    resultsAnswer = () => json('', 503);
    const order = await teams();
    expect(order).toHaveLength(18);
    expect(order.indexOf(PARIS_FC)).toBeLessThan(order.indexOf(523));
  });
});
