import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '@nestjs/common';
import { LiveMatchService } from './live-match.service';
import { EventBusService } from '../events/event-bus.service';

/**
 * L35 — mini-classement de la page live face aux rendus dégradés de 365scores
 * (mêmes charges réelles du 03/10/2026 que `StandingsService`, même lecture
 * partagée `readScores365Standings`) :
 *  - une ligne sans `competitor` ne fait plus disparaître le mini-classement ;
 *  - chaque absence de mini-classement dit pourquoi dans les logs.
 */
const FIXTURES = path.resolve(__dirname, '../../../test/fixtures');
const fixture = (name: string): string =>
  fs.readFileSync(path.join(FIXTURES, name), 'utf-8');

const GAME = fixture('365_game_lyon_rennes_live.json');
const GAME_ID = 4463860;

interface Payload {
  standings: Array<{ rows: Array<Record<string, unknown>> }>;
}

describe('LiveMatchService — mini-classement et rendus dégradés de 365scores (L35)', () => {
  const realFetch = globalThis.fetch;
  let warn: jest.SpyInstance;
  let standingsBody: string;
  let standingsStatus: number;

  const json = (body: string, status = 200) =>
    new Response(body, {
      status,
      headers: { 'content-type': 'application/json' },
    });

  const stats = () =>
    new LiveMatchService({
      emit: jest.fn(),
    } as unknown as EventBusService).getStats(GAME_ID, 'm1', { force: true });

  /** Logs qui parlent du classement (le play-by-play, en 404 ici, a les siens). */
  const standingsLogs = () =>
    (warn.mock.calls as unknown[][])
      .map((c) => String(c[0]))
      .filter((m) => m.includes('standings'));

  beforeEach(() => {
    standingsStatus = 200;
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    globalThis.fetch = (input: unknown) => {
      const { pathname } = new URL(String(input));
      if (pathname === '/web/game/') return Promise.resolve(json(GAME));
      if (pathname === '/web/standings/')
        return Promise.resolve(json(standingsBody, standingsStatus));
      return Promise.resolve(new Response('', { status: 404 }));
    };
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
    jest.restoreAllMocks();
  });

  it('garde OL et ses voisins quand la ligne voisine (3e) arrive sans « competitor »', async () => {
    standingsBody = fixture(
      '365_standings_ligue1_rows_without_competitor.json',
    );

    const payload = await stats();

    expect(
      payload?.standings?.map((r) => [r.position, r.teamId, r.name]),
    ).toEqual([
      [1, 471, 'Monaco'],
      [2, 465, 'Lyon'],
      [3, 6075, 'Paris FC'],
      [4, 478, 'Lille'],
      [5, 477, 'Rennes'],
    ]);
    expect(payload?.standings?.[2]).toMatchObject({
      played: 5,
      points: 11,
      goalDifference: 5,
      isOl: false,
    });
  });

  it('rend le même mini-classement que le rendu complet capturé au même moment', async () => {
    standingsBody = fixture(
      '365_standings_ligue1_rows_without_competitor.json',
    );
    const fromDegraded = (await stats())?.standings;
    standingsBody = fixture('365_standings_ligue1_complete.json');
    const fromComplete = (await stats())?.standings;

    expect(fromComplete).toHaveLength(5);
    expect(fromDegraded).toEqual(fromComplete);
  });

  it('enveloppe vide : pas de mini-classement, ET un log qui dit pourquoi', async () => {
    standingsBody = fixture('365_standings_ligue1_empty_envelope.json');

    const payload = await stats();

    expect(payload?.gameId).toBe(GAME_ID);
    expect(payload?.standings).toBeUndefined();
    expect(standingsLogs().join('\n')).toContain('no standings');
  });

  it('ligne sans club impossible à attribuer : pas de mini-classement troué, et un log', async () => {
    const body = JSON.parse(
      fixture('365_standings_ligue1_rows_without_competitor.json'),
    ) as Payload;
    delete body.standings[0].rows[2].detailedRecentForm;
    delete body.standings[0].rows[2].nextMatch;
    standingsBody = JSON.stringify(body);

    const payload = await stats();

    expect(payload?.standings).toBeUndefined();
    expect(standingsLogs().join('\n')).toContain('position 3');
  });

  it('OL absent du classement : pas de mini-classement, et un log', async () => {
    const body = JSON.parse(
      fixture('365_standings_ligue1_complete.json'),
    ) as Payload;
    body.standings[0].rows.splice(1, 1); // retire la ligne de Lyon
    standingsBody = JSON.stringify(body);

    const payload = await stats();

    expect(payload?.standings).toBeUndefined();
    expect(standingsLogs().join('\n')).toContain('465');
  });

  it.each([
    ['HTTP 504', '<html>504</html>', 504],
    ['corps non JSON', '<html>504 Gateway Time-out</html>', 200],
    [
      'forme inconnue (ligne sans position)',
      JSON.stringify({ standings: [{ rows: [{ points: 3 }] }] }),
      200,
    ],
  ])('aucune absence muette — %s', async (_label, body, status) => {
    standingsBody = body;
    standingsStatus = status;

    const payload = await stats();

    expect(payload?.standings).toBeUndefined();
    expect(standingsLogs().length).toBeGreaterThan(0);
  });
});
