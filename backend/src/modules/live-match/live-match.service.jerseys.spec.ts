import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '@nestjs/common';
import { LiveMatchService } from './live-match.service';
import { EventBusService } from '../events/event-bus.service';

/**
 * L133 — avant le match, 365scores envoie 0 comme numéro de maillot pour une partie
 * des joueurs : on reprend celui du dernier match joué par le club.
 */
const PREVIOUS = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../../../test/fixtures/365_game_lyon_rennes_live.json'), 'utf-8'),
);
const PREVIOUS_ID = 4463860;
const UPCOMING_ID = 5000001;

interface Member { id: number; jerseyNumber?: number }

describe('LiveMatchService — numéros de maillot de la composition probable (L133)', () => {
  const realFetch = globalThis.fetch;
  let resultsCalls: string[];

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

  /** Le même match, présenté « à venir » : composition non confirmée, tous les numéros à 0 sauf `keep`. */
  const upcoming = (keep: number[]) => {
    const g = JSON.parse(JSON.stringify(PREVIOUS));
    g.game.id = UPCOMING_ID;
    g.game.statusGroup = 2;
    g.game.homeCompetitor.lineups.status = 'Probable';
    g.game.awayCompetitor.lineups.status = 'Probable';
    for (const m of g.game.members as Member[]) if (!keep.includes(m.id)) m.jerseyNumber = 0;
    return g;
  };

  const stats = () =>
    new LiveMatchService({ emit: jest.fn() } as unknown as EventBusService).getStats(UPCOMING_ID, 'm1', { force: true });

  beforeEach(() => {
    resultsCalls = [];
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    globalThis.fetch = (input: unknown) => {
      const url = new URL(String(input));
      if (url.pathname === '/web/game/') {
        const id = Number(url.searchParams.get('gameId'));
        return Promise.resolve(json(id === UPCOMING_ID ? upcoming([844534]) : PREVIOUS));
      }
      if (url.pathname === '/web/games/results/') {
        resultsCalls.push(url.searchParams.get('competitors') ?? '');
        return Promise.resolve(json({ games: [{ id: PREVIOUS_ID, startTime: PREVIOUS.game.startTime, statusGroup: 4, hasLineups: true }] }));
      }
      return Promise.resolve(new Response('', { status: 404 }));
    };
  });
  afterEach(() => {
    globalThis.fetch = realFetch;
    jest.restoreAllMocks();
  });

  it('un joueur sans numéro chez 365scores reprend celui de son dernier match, pour les deux clubs', async () => {
    const out = await stats();
    const all = [out!.lineups!.home, out!.lineups!.away].flatMap((l) => [...l.starters, ...l.bench]);
    expect(out!.lineups!.home.probable).toBe(true);
    expect(all.length).toBeGreaterThan(20);
    expect(all.filter((p) => p.jerseyNumber === null)).toEqual([]);
    expect(all.find((p) => p.id === 12759586)?.jerseyNumber).toBe(16); // Abner : 0 → 16
    expect(resultsCalls.sort()).toEqual(['465', '477']);
  });

  it('match précédent introuvable : le joueur reste sans numéro, la page ne casse pas', async () => {
    const f = globalThis.fetch;
    globalThis.fetch = (input: unknown, init?: RequestInit) =>
      new URL(String(input)).pathname === '/web/games/results/'
        ? Promise.resolve(new Response('', { status: 500 }))
        : f(input as string, init);
    const out = await stats();
    const home = [...out!.lineups!.home.starters, ...out!.lineups!.home.bench];
    expect(home.find((p) => p.id === 844534)?.jerseyNumber).toBe(1);
    expect(home.find((p) => p.id === 12759586)?.jerseyNumber).toBeNull();
  });
});
