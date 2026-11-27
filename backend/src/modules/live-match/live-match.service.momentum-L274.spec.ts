import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '@nestjs/common';
import { LiveMatchService } from './live-match.service';
import { EventBusService } from '../events/event-bus.service';
import { FixturesService } from '../fixtures/fixtures.service';

/**
 * L274 (D-4) — Lyon 0-0 Lillestrøm (26/11/2026), détail du match et play-by-play réels relevés le 27/11 :
 * le détail nomme l'équipe « Lillestrom », le play-by-play « Lillestrøm ». Le momentum doit compter
 * les actions des deux équipes et dire combien n'ont pas d'équipe.
 */
const read = (f: string): unknown =>
  JSON.parse(
    fs.readFileSync(
      path.resolve(__dirname, '../../../test/fixtures/', f),
      'utf-8',
    ),
  );
const GAME = read('365_game_lyon_lillestrom_ended_L274.json');
const PBP = read('365_pbp_lyon_lillestrom_L274.json') as {
  Messages: unknown[];
};
const GAME_ID = 4828675;

describe('LiveMatchService — momentum de Lyon – Lillestrøm (L274)', () => {
  const realFetch = globalThis.fetch;
  let warns: string[];
  const json = (body: unknown) =>
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });

  const stats = (pbp: unknown) => {
    const service = new LiveMatchService(
      { emit: jest.fn() } as unknown as EventBusService,
      { peekFixtures: () => [] } as unknown as FixturesService,
    );
    globalThis.fetch = (input: unknown) => {
      const url = new URL(String(input));
      if (url.pathname === '/web/game/') return Promise.resolve(json(GAME));
      if (url.hostname === 'pbpgenerator.365scores.com')
        return Promise.resolve(json(pbp));
      return Promise.resolve(new Response('', { status: 404 }));
    };
    return service.getStats(GAME_ID, 'm1', { force: true });
  };

  beforeEach(() => {
    warns = [];
    jest.spyOn(Logger.prototype, 'warn').mockImplementation((m: unknown) => {
      warns.push(String(m));
    });
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
  });
  afterEach(() => {
    globalThis.fetch = realFetch;
    jest.restoreAllMocks();
  });

  it('les deux équipes ont leurs actions, aucune sans équipe, et le graphe va des deux côtés', async () => {
    const out = await stats(PBP);
    expect(out!.away.name).toBe('Lillestrom');
    expect(out!.momentumActions).toEqual({
      home: 44,
      away: 27,
      unattributed: 0,
    });
    expect(out!.momentum!.some((p) => p.value < -10)).toBe(true);
    expect(out!.momentum!.some((p) => p.value > 10)).toBe(true);
    expect(warns.filter((w) => w.includes('sans équipe'))).toEqual([]);
  });

  it('une action au nom inconnu est comptée sans équipe et journalisée, jamais ignorée en silence', async () => {
    const pbp = structuredClone(PBP);
    pbp.Messages.push({
      Type: 9,
      Timeline: '12',
      Period: '1',
      Comment: 'Corner, Inconnu FC. Conceded by X.',
    });
    const out = await stats(pbp);
    expect(out!.momentumActions).toEqual({
      home: 44,
      away: 27,
      unattributed: 1,
    });
    expect(
      warns.some((w) => w.includes('1 action(s) sans équipe sur 72')),
    ).toBe(true);
  });
});
