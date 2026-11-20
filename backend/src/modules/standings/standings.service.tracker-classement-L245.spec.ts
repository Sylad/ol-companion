import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

/**
 * L245 — attendu QA de / et /standings : le tracker de saison (`season-rankings.json`,
 * `GET /api/standings/season-rankings`) commence à la journée 1, et sa dernière entrée
 * (place, points) égale la ligne de l'OL de `GET /api/standings` quand tous les clubs ont
 * joué autant de matchs.
 *
 * Données : résultats réels J1–J9 2026-27 (`ligue1-2026-results-j1-j9.json`), coupés à la
 * journée N ; le classement 365scores bouchonné est bâti à partir des mêmes matchs par simple
 * décompte (points, victoires, buts), ses lignes dans l'ordre des identifiants : c'est le
 * service qui doit les ordonner. J1 à J8 sont complètes (18 clubs à N matchs) ; la J9 n'a que
 * 7 matchs sur 9 et sert de cas où l'égalité n'est PAS exigée.
 */
const FIXTURES = path.resolve(__dirname, '../../../test/fixtures');
const OL = 465; // 365scores
const OL_FOOTBALL_DATA = 523; // identifiant de l'OL dans /api/standings

interface RawGame {
  roundNum: number;
  statusGroup: number;
  homeCompetitor: { id: number; name?: string; score: number };
  awayCompetitor: { id: number; name?: string; score: number };
  [k: string]: unknown;
}

const allGames: RawGame[] = JSON.parse(
  fs.readFileSync(path.join(FIXTURES, 'ligue1-2026-results-j1-j9.json'), 'utf-8'),
).games;
const standingsTemplate = JSON.parse(
  fs.readFileSync(path.join(FIXTURES, '365_standings_ligue1_complete.json'), 'utf-8'),
);

/** Réponse `/web/standings/` de 365scores pour les matchs terminés donnés (décompte brut, sans départage). */
function standingsFrom(games: RawGame[]) {
  const rows = new Map<number, { id: number; name?: string; played: number; won: number; even: number; lost: number; for: number; against: number }>();
  for (const g of games.filter((x) => x.statusGroup === 4)) {
    for (const [me, other] of [[g.homeCompetitor, g.awayCompetitor], [g.awayCompetitor, g.homeCompetitor]]) {
      const r = rows.get(me.id) ?? { id: me.id, name: me.name, played: 0, won: 0, even: 0, lost: 0, for: 0, against: 0 };
      r.played++;
      r.for += me.score;
      r.against += other.score;
      if (me.score > other.score) r.won++;
      else if (me.score === other.score) r.even++;
      else r.lost++;
      rows.set(me.id, r);
    }
  }
  const body = structuredClone(standingsTemplate);
  body.standings[0].rows = [...rows.values()]
    .sort((a, b) => a.id - b.id)
    .map((r, i) => ({
      competitor: { id: r.id, name: r.name ?? `club ${r.id}` },
      position: i + 1, // ordre volontairement faux : le service reclasse
      gamePlayed: r.played,
      gamesWon: r.won,
      gamesEven: r.even,
      gamesLost: r.lost,
      for: r.for,
      against: r.against,
      ratio: r.for - r.against,
      points: 3 * r.won + r.even,
    }));
  return body;
}

describe('Tracker de saison = classement à la dernière journée (L245)', () => {
  const realFetch = globalThis.fetch;
  let previousCwd: string;
  let tmpDir: string;
  let StandingsService: typeof import('./standings.service').StandingsService;

  const json = (body: unknown) =>
    new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });

  beforeAll(() => {
    previousCwd = process.cwd();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ol-standings-l245-'));
    fs.mkdirSync(path.join(tmpDir, 'data'));
    process.chdir(tmpDir);
    const { Logger } = require('@nestjs/common') as typeof import('@nestjs/common'); // eslint-disable-line @typescript-eslint/no-require-imports
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    ({ StandingsService } = require('./standings.service') as typeof import('./standings.service')); // eslint-disable-line @typescript-eslint/no-require-imports
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
    fs.rmSync(path.join(tmpDir, 'data'), { recursive: true, force: true });
    fs.mkdirSync(path.join(tmpDir, 'data'));
  });

  afterAll(() => {
    jest.restoreAllMocks();
    process.chdir(previousCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  /** Les deux réponses de l'API après un rafraîchissement sur les matchs des journées 1 à `round`. */
  async function apiAfter(round: number) {
    const games = allGames.filter((g) => g.roundNum <= round);
    globalThis.fetch = ((input: unknown) =>
      Promise.resolve(
        String(input).includes('/web/games/results/') ? json({ games }) : json(standingsFrom(games)),
      )) as typeof fetch;
    const service = new StandingsService({ emit: jest.fn() } as never);
    const standings = await service.getCurrentStandings({ force: true });
    return { standings, tracker: service.getSeasonRankings(), games };
  }

  it.each([1, 2, 3, 4, 5, 6, 7, 8])(
    'après la J%i (18 clubs à autant de matchs) : le tracker commence à J1 et finit sur la place et les points de /api/standings',
    async (round) => {
      const { standings, tracker } = await apiAfter(round);
      const table = standings!.table;
      expect(new Set(table.map((r) => r.played))).toEqual(new Set([round])); // précondition de l'attendu
      expect(tracker[0].matchday).toBe(1);
      expect(tracker.map((t) => t.matchday)).toEqual(Array.from({ length: round }, (_, i) => i + 1));
      const ol = table.find((r) => r.teamId === OL_FOOTBALL_DATA)!;
      const last = tracker[tracker.length - 1];
      expect({ matchday: last.matchday, position: last.position, points: last.points }).toEqual({
        matchday: standings!.currentMatchday,
        position: ol.position,
        points: ol.points,
      });
    },
  );

  it("J9 incomplète (7 matchs sur 9) : l'attendu ne s'applique pas — les clubs n'ont pas tous joué autant de matchs", async () => {
    const { standings, tracker, games } = await apiAfter(9);
    expect(new Set(standings!.table.map((r) => r.played)).size).toBeGreaterThan(1);
    // l'OL a joué sa J9 : le tracker trace la J9 même si la journée n'est pas finie
    expect(games.some((g) => g.roundNum === 9 && (g.homeCompetitor.id === OL || g.awayCompetitor.id === OL))).toBe(true);
    expect(tracker[tracker.length - 1].matchday).toBe(9);
  });
});
