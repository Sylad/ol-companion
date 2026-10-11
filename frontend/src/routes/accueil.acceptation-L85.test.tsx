import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Outlet, RouterProvider, createMemoryHistory, createRootRoute, createRoute, createRouter } from '@tanstack/react-router';
import { DashboardPage } from './index';

// Acceptation L85 — écran « Accueil » (/), écrit d'après la fiche et la maquette.
// Sources : GET /api/fixtures (tableau de Fixture), GET /api/standings ({ table: StandingEntry[] }),
// GET /api/standings/season-rankings (facultatif, jamais une erreur affichée).

type Res = { ok: boolean; status: number; json: () => Promise<unknown> };
const okJson = (body: unknown): Res => ({ ok: true, status: 200, json: async () => body });
const fail = (): Res => ({ ok: false, status: 500, json: async () => null });
const pending = (): Promise<Res> => new Promise(() => {});

let calls: string[] = [];
let fixturesHandler: () => Promise<Res>;
let standingsHandler: () => Promise<Res>;

const DAY = 86_400_000;
const iso = (offsetDays: number) => new Date(Date.now() + offsetDays * DAY).toISOString();

const NEXT = {
  id: 1, date: iso(6), homeTeam: 'Olympique Lyonnais', homeTeamId: 523, awayTeam: 'OGC Nice', awayTeamId: 522,
  homeScore: null, awayScore: null, competition: 'Ligue 1', status: 'TIMED', matchday: 7, timeConfirmed: true,
};
const LAST = {
  id: 2, date: iso(-7), homeTeam: 'Olympique Lyonnais', homeTeamId: 523, awayTeam: 'Lens', awayTeamId: 546,
  homeScore: 2, awayScore: 1, competition: 'Ligue 1', status: 'FINISHED', matchday: 6, timeConfirmed: true,
};
const OL_ROW = {
  position: 2, team: 'Olympique Lyonnais', teamId: 523, played: 6, won: 3, draw: 2, lost: 1,
  goalsFor: 9, goalsAgainst: 4, goalDifference: 5, points: 11, recentForm: ['W', 'D', 'W', 'D', 'L', 'W'],
};
const OTHER_ROW = { ...OL_ROW, position: 1, team: 'Paris Saint-Germain', teamId: 524, points: 15 };
const standings = (table: unknown[]) => okJson({ season: '2026', updatedAt: '2026-10-11T00:00:00Z', currentMatchday: 6, table });

beforeEach(() => {
  calls = [];
  fixturesHandler = async () => okJson([NEXT, LAST]);
  standingsHandler = async () => standings([OTHER_ROW, OL_ROW]);
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const u = String(url);
      calls.push(u);
      if (u === '/api/fixtures') return fixturesHandler();
      if (u === '/api/standings') return standingsHandler();
      return { ok: false, status: 404, json: async () => null };
    }),
  );
});
beforeEach(() => {
  window.scrollTo = (() => {}) as typeof window.scrollTo;
});
afterEach(() => vi.unstubAllGlobals());

const count = (path: string) => calls.filter((u) => u === path).length;

function renderPage() {
  const root = createRootRoute({ component: () => <Outlet /> });
  const index = createRoute({ getParentRoute: () => root, path: '/', component: DashboardPage });
  const fixtures = createRoute({ getParentRoute: () => root, path: '/fixtures', component: () => <div data-testid="page-calendrier">Calendrier</div> });
  const router = createRouter({ routeTree: root.addChildren([index, fixtures]), history: createMemoryHistory({ initialEntries: ['/'] }) });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

const tid = (id: string) => screen.getByTestId(id);
const absent = (id: string) => expect(screen.queryByTestId(id)).toBeNull();
const STATS = ['stat-position', 'stat-points', 'stat-diff', 'stat-forme'];
const SLOW = { timeout: 3000 };

function expectDashes() {
  for (const id of STATS) {
    const el = tid(id);
    expect(el).toHaveTextContent('—');
    expect(el.textContent ?? '').not.toMatch(/\d/);
    expect(el.textContent ?? '').not.toContain('Ligue 1');
  }
}

describe('R1 — chargement', () => {
  beforeEach(() => {
    fixturesHandler = pending;
    standingsHandler = pending;
  });
  it('R1 — chargement : squelettes et « — », aucune valeur factice', async () => {
    renderPage();
    const hero = await screen.findByTestId('squelette-prochain-match');
    expect(hero).toHaveAttribute('role', 'status');
    expect(hero).toHaveAttribute('aria-busy', 'true');
    expect(hero).toHaveTextContent('Chargement');
    const last = tid('squelette-dernier-resultat');
    expect(last).toHaveAttribute('role', 'status');
    expect(last).toHaveAttribute('aria-busy', 'true');
    expect(last).toHaveTextContent('Chargement');
    expectDashes();
    absent('carte-prochain-match');
    absent('dernier-resultat');
  });
  it('R1 — chargement : ni « Aucun match programmé. » ni « 0V »', async () => {
    renderPage();
    await screen.findByTestId('squelette-prochain-match');
    absent('message-aucun-match');
    absent('lien-calendrier');
    absent('message-erreur-prochain-match');
    absent('message-erreur-stats');
    expect(screen.queryByText('Aucun match programmé.')).toBeNull();
    expect(document.body.textContent ?? '').not.toMatch(/0V/);
    expect(document.body.textContent ?? '').not.toMatch(/Points\s*0/);
  });
});

describe('R2 — erreur des matchs', () => {
  beforeEach(() => {
    fixturesHandler = async () => fail();
  });
  it('R2 — erreur : message et bouton Réessayer du prochain match', async () => {
    renderPage();
    expect(await screen.findByTestId('message-erreur-prochain-match', undefined, SLOW)).toHaveTextContent('Impossible de charger le prochain match.');
    expect(tid('bouton-reessayer-prochain-match')).toHaveTextContent('Réessayer');
    absent('carte-prochain-match');
    absent('squelette-prochain-match');
    absent('message-aucun-match');
  });
  it("R2 — Réessayer relance l'appel des matchs", async () => {
    const user = userEvent.setup();
    renderPage();
    const btn = await screen.findByTestId('bouton-reessayer-prochain-match', undefined, SLOW);
    const before = count('/api/fixtures');
    await user.click(btn);
    await waitFor(() => expect(count('/api/fixtures')).toBeGreaterThan(before));
  });
});

describe('R3 — erreur du classement', () => {
  beforeEach(() => {
    standingsHandler = async () => fail();
  });
  it('R3 — erreur : tuiles « — », message et bouton Réessayer', async () => {
    renderPage();
    expect(await screen.findByTestId('message-erreur-stats', undefined, SLOW)).toHaveTextContent('Impossible de charger le classement.');
    expect(tid('bouton-reessayer-stats')).toHaveTextContent('Réessayer');
    expectDashes();
    // les rankings (404 ici) restent facultatifs : pas d'autre message d'erreur du classement
    expect(screen.getAllByTestId('message-erreur-stats')).toHaveLength(1);
  });
  it("R3 — Réessayer relance l'appel du classement", async () => {
    const user = userEvent.setup();
    renderPage();
    const btn = await screen.findByTestId('bouton-reessayer-stats', undefined, SLOW);
    const before = count('/api/standings');
    await user.click(btn);
    await waitFor(() => expect(count('/api/standings')).toBeGreaterThan(before));
  });
});

describe('R4 — erreur du dernier résultat', () => {
  beforeEach(() => {
    fixturesHandler = async () => fail();
  });
  it('R4 — erreur : message et bouton Réessayer du dernier résultat', async () => {
    renderPage();
    expect(await screen.findByTestId('message-erreur-dernier-resultat', undefined, SLOW)).toHaveTextContent('Impossible de charger le dernier résultat.');
    expect(tid('bouton-reessayer-dernier-resultat')).toHaveTextContent('Réessayer');
    absent('dernier-resultat');
  });
  it("R4 — Réessayer relance l'appel et repasse en chargement", async () => {
    const user = userEvent.setup();
    renderPage();
    const btn = await screen.findByTestId('bouton-reessayer-dernier-resultat', undefined, SLOW);
    const before = count('/api/fixtures');
    fixturesHandler = pending;
    await user.click(btn);
    await waitFor(() => expect(count('/api/fixtures')).toBeGreaterThan(before));
    await screen.findByTestId('squelette-dernier-resultat');
    expect(tid('squelette-prochain-match')).toBeInTheDocument();
    absent('message-erreur-dernier-resultat');
    absent('message-erreur-prochain-match');
  });
});

describe('R5 — aucun match à venir', () => {
  beforeEach(() => {
    fixturesHandler = async () => okJson([LAST]);
  });
  it('R5 — vide : message et lien vers le calendrier', async () => {
    renderPage();
    expect(await screen.findByTestId('message-aucun-match', undefined, SLOW)).toHaveTextContent('Aucun match programmé.');
    expect(tid('lien-calendrier')).toHaveTextContent('Voir le calendrier');
    absent('carte-prochain-match');
    absent('squelette-prochain-match');
    absent('message-erreur-prochain-match');
  });
  it('R5 — le lien mène à /fixtures', async () => {
    const user = userEvent.setup();
    renderPage();
    const link = await screen.findByTestId('lien-calendrier', undefined, SLOW);
    expect(link).toHaveAttribute('href', '/fixtures');
    await user.click(link);
    expect(await screen.findByTestId('page-calendrier')).toBeInTheDocument();
  });
});

describe('R6 — classement sans l’OL', () => {
  it('R6 — vide : « — » sur les quatre tuiles, pas de 0', async () => {
    standingsHandler = async () => standings([OTHER_ROW]);
    renderPage();
    await screen.findByTestId('carte-prochain-match', undefined, SLOW);
    await waitFor(() => expect(count('/api/standings')).toBeGreaterThan(0));
    expectDashes();
    expect(tid('tuiles-stats').textContent ?? '').not.toMatch(/Points\s*0/);
  });
  it('R6 — vide : pas de « 0V »', async () => {
    standingsHandler = async () => okJson(null);
    renderPage();
    await screen.findByTestId('carte-prochain-match', undefined, SLOW);
    await waitFor(() => expect(count('/api/standings')).toBeGreaterThan(0));
    expectDashes();
    expect(tid('tuiles-stats').textContent ?? '').not.toMatch(/0V/);
    absent('message-erreur-stats');
  });
});

describe('R7 — aucun match terminé', () => {
  it('R7 — vide : pas de bloc Dernier résultat', async () => {
    fixturesHandler = async () => okJson([NEXT]);
    renderPage();
    await screen.findByTestId('carte-prochain-match', undefined, SLOW);
    absent('dernier-resultat');
    absent('squelette-dernier-resultat');
    absent('message-erreur-dernier-resultat');
  });
});

describe('R8 — chargé', () => {
  it('R8 — chargé : les trois blocs affichent les données', async () => {
    renderPage();
    const hero = await screen.findByTestId('carte-prochain-match', undefined, SLOW);
    expect(hero).toHaveTextContent('OGC Nice');
    await waitFor(() => expect(tid('stat-points')).toHaveTextContent('11'));
    expect(tid('stat-position')).toHaveTextContent('2');
    expect(tid('stat-diff')).toHaveTextContent('+5');
    expect(tid('stat-forme')).toHaveTextContent('3V');
    const last = await screen.findByTestId('dernier-resultat');
    expect(within(last).getByText(/Lens/)).toBeInTheDocument();
    expect(last).toHaveTextContent(/2\D+1/);
    for (const id of ['squelette-prochain-match', 'squelette-dernier-resultat', 'message-aucun-match', 'message-erreur-prochain-match', 'message-erreur-stats', 'message-erreur-dernier-resultat'])
      absent(id);
  });
});
