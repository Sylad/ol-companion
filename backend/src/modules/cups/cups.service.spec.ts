import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const FIXTURES = /\/web\/games\/fixtures\//;

function game(id: number, statusGroup: number, startTime: string, ol: number | null, opp: number | null) {
  return {
    id, competitionId: 37, startTime, statusGroup, stageNum: 3,
    homeCompetitor: { id: 465, name: 'Lyon', score: ol ?? -1 },
    awayCompetitor: { id: 7, name: 'Autre', score: opp ?? -1 },
  };
}

describe('CupsService — appel des matchs à venir en échec', () => {
  const realFetch = global.fetch;
  const cwd = process.cwd();
  let tmp: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cups-'));
    process.chdir(tmp);
  });
  afterEach(() => {
    global.fetch = realFetch;
    process.chdir(cwd);
    fs.rmSync(tmp, { recursive: true, force: true });
    jest.resetModules();
  });

  async function load() {
    const { CupsService } = require('./cups.service') as typeof import('./cups.service');
    const { BracketService } = require('./bracket.service') as typeof import('./bracket.service');
    return new CupsService({} as never, new BracketService());
  }

  const recent = new Date(Date.now() - 3 * 86_400_000).toISOString();

  it('réessaie, puis ne conclut pas « Éliminé » et ne perd pas le dernier match à venir connu', async () => {
    const svc = await load();
    (svc as unknown as { lastKnown: unknown }).lastKnown = [{
      competitionId: 37, name: 'Coupe de France', currentStageFr: '', isEliminated: false,
      matches: [{
        id: 2, date: new Date(Date.now() + 5 * 86_400_000).toISOString(), homeTeam: 'Lyon', homeTeamId: 465,
        awayTeam: 'X', awayTeamId: 8, homeScore: null, awayScore: null, status: 'SCHEDULED', stage: '', stageFr: '',
      }],
    }];
    let fixtureCalls = 0;
    global.fetch = jest.fn(async (url: string | URL | Request) => {
      if (FIXTURES.test(String(url))) { fixtureCalls++; throw new Error('timeout'); }
      return new Response(JSON.stringify({ games: [game(1, 4, recent, 2, 0)] }), { status: 200 });
    }) as unknown as typeof fetch;

    const cups = await svc.getCups({ force: true });

    expect(fixtureCalls).toBe(3);
    expect(cups[0].matches.map((m) => m.id)).toContain(2);
    expect(cups[0].isEliminated).toBe(false);
  });

  it('défaite en coupe, matchs à venir connus et vides = éliminé', async () => {
    const svc = await load();
    global.fetch = jest.fn(async (url: string | URL | Request) =>
      new Response(JSON.stringify({ games: FIXTURES.test(String(url)) ? [] : [game(1, 4, recent, 0, 1)] }), { status: 200 }),
    ) as unknown as typeof fetch;
    const cups = await svc.getCups({ force: true });
    expect(cups[0].isEliminated).toBe(true);
  });
});
