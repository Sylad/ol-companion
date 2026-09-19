import { LiveMatchService } from './live-match.service';
import { EventBusService } from '../events/event-bus.service';

/**
 * Régression du blackout au coup d'envoi (19/09/2026, Lyon-Rennes, 20:45→21:00 ;
 * déjà vu le 16/09 Anderlecht-Lyon). Deux causes :
 *  - un échec transitoire (timeout 8 s, HTTP non-2xx) écrasait le match connu par
 *    `null` et déclenchait le throttle « aucun match en vue » de 15 min ;
 *  - à l'instant du coup d'envoi, 365scores sort le match de `fixtures` avant de
 *    le passer en `statusGroup 3` dans `onlyLiveGames` : les 3 listes sont vides
 *    quelques secondes, même effet.
 */

const OL = 465;
const RENNES = 477;
const T0 = new Date('2026-09-19T18:40:00Z').getTime(); // 20:40 Paris

function game(statusGroup: number, startTime: string, id = 4735259) {
  return {
    id,
    startTime,
    competitionId: 35,
    competitionDisplayName: 'Ligue 1',
    statusGroup,
    homeCompetitor: { id: OL, name: 'Lyon', score: statusGroup === 3 ? 1 : -1 },
    awayCompetitor: {
      id: RENNES,
      name: 'Rennes',
      score: statusGroup === 3 ? 0 : -1,
    },
  };
}

type Route = 'live' | 'results' | 'fixtures';
type Answer = { games: unknown[] } | 'timeout' | number;

function routeOf(url: string): Route {
  if (url.includes('onlyLiveGames=true')) return 'live';
  if (url.includes('/results/')) return 'results';
  return 'fixtures';
}

function build(answers: () => Record<Route, Answer>) {
  const bus = { emit: jest.fn() } as unknown as EventBusService;
  const svc = new LiveMatchService(bus);
  const calls: Route[] = [];
  svc.fetcher = jest.fn((input: string | URL | Request) => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    const route = routeOf(url);
    calls.push(route);
    const a = answers()[route];
    if (a === 'timeout')
      return Promise.reject(
        new Error('The operation was aborted due to timeout'),
      );
    if (typeof a === 'number')
      return Promise.resolve(new Response('', { status: a }));
    return Promise.resolve(
      new Response(JSON.stringify(a), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
  });
  return { svc, calls };
}

describe("LiveMatchService — résilience autour du coup d'envoi", () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: T0 });
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  const KICKOFF = '2026-09-19T20:45:00+02:00';

  it('garde le match « à venir » connu quand fixtures tombe en timeout, et réessaie dans la minute', async () => {
    let fixtures: Answer = { games: [game(2, KICKOFF)] };
    const { svc, calls } = build(() => ({
      live: { games: [] },
      results: { games: [] },
      fixtures,
    }));

    expect((await svc.getCurrent({ force: true }))?.status).toBe('upcoming');

    fixtures = 'timeout';
    jest.setSystemTime(T0 + 60_000);
    const afterFailure = await svc.getCurrent({ force: true });
    expect(afterFailure?.status).toBe('upcoming'); // pas écrasé par null

    // Le prochain tick du cron (30 s) ne doit PAS être bloqué 15 min.
    calls.length = 0;
    jest.setSystemTime(T0 + 60_000 + 61_000);
    await svc.pollLiveMatch();
    expect(calls.length).toBeGreaterThan(0);
  });

  it("survit au trou de 365scores au coup d'envoi (3 listes vides) puis bascule en live", async () => {
    let phase: 'before' | 'gap' | 'live' = 'before';
    const { svc, calls } = build(() => {
      if (phase === 'before')
        return {
          live: { games: [] },
          results: { games: [] },
          fixtures: { games: [game(2, KICKOFF)] },
        };
      if (phase === 'gap')
        return {
          live: { games: [] },
          results: { games: [] },
          fixtures: { games: [game(2, '2026-10-09T20:45:00+02:00', 4735252)] },
        };
      return {
        live: { games: [game(3, KICKOFF)] },
        results: { games: [] },
        fixtures: { games: [] },
      };
    });

    expect((await svc.getCurrent({ force: true }))?.status).toBe('upcoming');

    phase = 'gap';
    jest.setSystemTime(new Date('2026-09-19T18:45:20Z').getTime()); // 20:45:20 Paris
    await svc.pollLiveMatch();
    expect((await svc.getCurrent())?.gameId).toBe(4735259); // toujours exposé

    phase = 'live';
    calls.length = 0;
    jest.setSystemTime(new Date('2026-09-19T18:46:00Z').getTime());
    await svc.pollLiveMatch();
    expect(calls).toContain('live'); // cadence 30 s conservée, pas de throttle 15 min
    expect((await svc.getCurrent())?.status).toBe('live');
  });

  it('traite une réponse HTTP non-2xx comme un échec transitoire (pas comme « aucun match »)', async () => {
    let fail = false;
    const { svc } = build(() => ({
      live: fail ? 403 : { games: [] },
      results: fail ? 403 : { games: [] },
      fixtures: fail ? 403 : { games: [game(2, KICKOFF)] },
    }));
    expect((await svc.getCurrent({ force: true }))?.status).toBe('upcoming');

    fail = true;
    jest.setSystemTime(T0 + 60_000);
    expect((await svc.getCurrent({ force: true }))?.status).toBe('upcoming');
  });

  it('sans match connu ni en vue, renvoie null et throttle 15 min (comportement conservé)', async () => {
    const { svc, calls } = build(() => ({
      live: { games: [] },
      results: { games: [] },
      fixtures: { games: [] },
    }));
    expect(await svc.getCurrent({ force: true })).toBeNull();

    calls.length = 0;
    jest.setSystemTime(T0 + 5 * 60_000);
    await svc.pollLiveMatch();
    expect(calls).toHaveLength(0);

    jest.setSystemTime(T0 + 16 * 60_000);
    await svc.pollLiveMatch();
    expect(calls.length).toBeGreaterThan(0);
  });

  it("oublie un match « à venir » périmé (coup d'envoi + 3 h dépassé) quand plus rien ne le confirme", async () => {
    let known = true;
    const { svc } = build(() => ({
      live: { games: [] },
      results: { games: [] },
      fixtures: { games: known ? [game(2, KICKOFF)] : [] },
    }));
    expect((await svc.getCurrent({ force: true }))?.status).toBe('upcoming');

    known = false;
    jest.setSystemTime(new Date('2026-09-19T22:30:00Z').getTime()); // 00:30 Paris, kickoff + 3 h 45
    expect(await svc.getCurrent({ force: true })).toBeNull();
  });
});
