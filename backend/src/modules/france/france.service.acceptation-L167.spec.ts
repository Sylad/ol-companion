// L167 — acceptation, R1 côté back (docs/specs/page-match-equipe-de-france/fiche.yaml) : le prochain match des Bleus
// est gardé pendant le direct. Ces trois tests étaient dans frontend/src/routes/match.equipe-de-france.complement-L167.test.tsx ;
// ils vivent ici parce que le build Docker du frontend (contexte frontend/ seul) ne peut pas importer backend/.
// Le service est lu tel quel, avec un fetcher simulé (A2 : GET /api/france) et une horloge simulée.

import { FranceService } from './france.service';

const FR = { id: 5061, name: 'France' };
const MIN = 60 * 1000;
const T = new Date('2026-11-12T20:00:00Z').getTime(); // coup d'envoi de M
type Competitor = Record<string, unknown>;
const game = (
  id: number,
  start: number,
  home: Competitor,
  away: Competitor,
) => ({
  id,
  startTime: new Date(start).toISOString(),
  competitionDisplayName: 'UEFA WC Qualification',
  homeCompetitor: home,
  awayCompetitor: away,
});
const M = game(
  100,
  T,
  { ...FR, score: -1 },
  { id: 8, name: 'Iceland', score: -1 },
);
const N = game(
  101,
  T + 3 * 24 * 60 * MIN,
  { ...FR, score: -1 },
  { id: 9, name: 'Wales', score: -1 },
);
const PLAYED = game(
  1,
  T - 40 * 24 * 60 * MIN,
  { ...FR, score: 4 },
  { id: 2373, name: 'Belgium', score: 1 },
);
const SQUAD = {
  squads: [
    {
      competitorId: 5061,
      athletes: [
        {
          id: 1,
          name: 'Mike Maignan',
          age: 31,
          position: { id: 1, name: 'Goalkeeper' },
        },
      ],
    },
  ],
};

function franceService(state: { fixtures: unknown[]; results: unknown[] }) {
  const svc = new FranceService();
  svc.fetcher = ((url: string) => {
    const kind = String(url).includes('/results/')
      ? 'results'
      : String(url).includes('/fixtures/')
        ? 'fixtures'
        : 'squads';
    const body = kind === 'squads' ? SQUAD : { games: state[kind] };
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve(body),
    });
  }) as never;
  svc.retryDelayMs = 0;
  return svc;
}
const at = (ms: number) => jest.setSystemTime(new Date(ms));

describe('R1 — back : le prochain match est gardé pendant le direct', () => {
  beforeEach(() =>
    jest.useFakeTimers({
      doNotFake: [
        'nextTick',
        'setImmediate',
        'setTimeout',
        'setInterval',
        'queueMicrotask',
      ] as never,
    }),
  );
  afterEach(() => jest.useRealTimers());

  it('R1 — back, scénario à deux lectures (horloge simulée) : lecture 1, fixtures contient le match M (coup d’envoi T) ; lecture 2 à T + 5 min, cache expiré, fixtures SANS M (avec le match suivant N) et results sans M → nextMatch.id = M (échoue avec le code actuel, qui sert N)', async () => {
    const state = { fixtures: [M, N], results: [PLAYED] };
    const svc = franceService(state);
    at(T - 20 * MIN);
    // (témoin de la lecture 1) M est le prochain match
    expect((await svc.getFrance()).nextMatch?.id).toBe(100);
    state.fixtures = [N];
    at(T + 5 * MIN);
    const lecture2 = await svc.getFrance();
    // R1 — « FranceService garde donc le nextMatch connu (copie en mémoire) jusqu’à son coup d’envoi + 3 h même s’il a disparu de fixtures, à chaque relecture »
    expect(lecture2.nextMatch?.id).toBe(100);
    // R1 — « le match gardé est servi tel quel (même id, date, équipes, aucun champ nouveau) »
    expect(lecture2.nextMatch).toMatchObject({
      id: 100,
      away: { id: 8, name: 'Iceland' },
    });
  });

  it('R1 — back : à T + 2 h 59 min, M est encore gardé ; à T + 3 h 01 min, nextMatch = N', async () => {
    const state = { fixtures: [M, N], results: [PLAYED] };
    const svc = franceService(state);
    at(T - 20 * MIN);
    await svc.getFrance();
    state.fixtures = [N];
    at(T + 2 * 60 * MIN + 59 * MIN);
    // R1 — « jusqu’à son coup d’envoi + 3 h »
    expect((await svc.getFrance()).nextMatch?.id).toBe(100);
    at(T + 3 * 60 * MIN + MIN);
    // R1 — « il cède la place au match suivant … au-delà de +3 h »
    expect((await svc.getFrance()).nextMatch?.id).toBe(101);
  });

  it('R1 — back : à T + 2 h, results contient M (match terminé) → nextMatch = N et la ligne de résultat de M est un lien', async () => {
    const state = { fixtures: [M, N], results: [PLAYED] };
    const svc = franceService(state);
    at(T - 20 * MIN);
    await svc.getFrance();
    const fini = game(
      100,
      T,
      { ...FR, score: 2 },
      { id: 8, name: 'Iceland', score: 0 },
    );
    state.fixtures = [N];
    at(T + 60 * MIN);
    // R1 — « Cas : fixtures sans le match, heure entre le coup d’envoi et +3 h, id absent de results → nextMatch est ce match »
    expect((await svc.getFrance()).nextMatch?.id).toBe(100);
    state.results = [fini, PLAYED];
    at(T + 2 * 60 * MIN);
    const res = await svc.getFrance();
    // R1 — « il cède la place au match suivant dès que son id apparaît dans results (match terminé : la ligne de résultat prend le relais) »
    expect(res.nextMatch?.id).toBe(101);
    expect(res.results.map((r) => r.id)).toContain(100);
    // « la ligne de résultat de M est un lien » : la donnée (id, home.id, away.id) qui permet le lien est servie (R2)
    expect(res.results.find((r) => r.id === 100)).toMatchObject({
      id: 100,
      home: { id: 5061 },
      away: { id: 8 },
    });
  });
});
