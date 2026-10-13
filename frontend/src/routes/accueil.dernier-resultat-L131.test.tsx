import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Outlet, RouterProvider, createMemoryHistory, createRootRoute, createRoute, createRouter } from '@tanstack/react-router';
import { DashboardPage } from './index';
import { seasonTeamLogoUrl } from '@/lib/calendar';

// L131 — le dernier résultat de l'accueil lit /api/season-matches (toutes compétitions), comme le bandeau.

const DAY = 86_400_000;
const iso = (d: number) => new Date(Date.now() + d * DAY).toISOString();
const base = { homeTeam: 'Olympique Lyonnais', homeTeamId: 523, timeConfirmed: true, competitionId: 0 };
const NEXT = { ...base, id: 1, date: iso(6), awayTeam: 'OGC Nice', awayTeamId: 522, homeScore: null, awayScore: null, competition: 'Ligue 1', competitionCode: 'L1', status: 'TIMED', matchday: 7 };
const LENS = { ...base, id: 2, date: iso(-4), awayTeam: 'Lens', awayTeamId: 546, homeScore: 2, awayScore: 1, competition: 'Ligue 1', competitionCode: 'L1', status: 'FINISHED', matchday: 6 };
const PALACE = { ...base, id: 3, date: iso(-1), awayTeam: 'Crystal Palace', awayTeamId: 1, homeScore: 0, awayScore: 3, competition: 'Ligue Europa', competitionCode: 'C3', status: 'FINISHED', matchday: 2 };
const OL_ROW = {
  position: 2, team: 'Olympique Lyonnais', teamId: 523, played: 6, won: 3, draw: 2, lost: 1,
  goalsFor: 9, goalsAgainst: 4, goalDifference: 5, points: 11, recentForm: ['W', 'D', 'W', 'D', 'L', 'W'],
};
const json = (body: unknown) => ({ ok: true, status: 200, json: async () => body });

let season: unknown[];
let calls: string[];

beforeEach(() => {
  calls = [];
  window.scrollTo = (() => {}) as typeof window.scrollTo;
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    const u = String(url);
    calls.push(u);
    if (u === '/api/season-matches') return json(season);
    // /api/fixtures ne dit rien d'européen : si l'accueil le lisait encore, il montrerait Lens.
    if (u === '/api/fixtures') return json([NEXT, LENS]);
    if (u === '/api/standings') return json({ season: '2026', updatedAt: '2026-10-11T00:00:00Z', currentMatchday: 6, table: [OL_ROW] });
    return { ok: false, status: 404, json: async () => null };
  }));
});
afterEach(() => vi.unstubAllGlobals());

function renderPage() {
  const root = createRootRoute({ component: () => <Outlet /> });
  const index = createRoute({ getParentRoute: () => root, path: '/', component: DashboardPage });
  const router = createRouter({ routeTree: root.addChildren([index]), history: createMemoryHistory({ initialEntries: ['/'] }) });
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe('L131 — dernier résultat toutes compétitions', () => {
  it('montre le match européen plus récent que le dernier match de Ligue 1', async () => {
    season = [NEXT, LENS, PALACE];
    renderPage();
    const card = await screen.findByTestId('dernier-resultat', undefined, { timeout: 3000 });
    expect(card).toHaveTextContent('Crystal Palace');
    expect(card).toHaveTextContent('0 · 3');
    expect(card).toHaveTextContent('Ligue Europa · J2');
    expect(card).toHaveTextContent('Défaite');
    expect(card).not.toHaveTextContent('Lens');
  });
  it('prend les écussons au CDN 365scores par identifiant, pas sur wiki-image', async () => {
    season = [NEXT, LENS, PALACE];
    renderPage();
    const card = await screen.findByTestId('dernier-resultat', undefined, { timeout: 3000 });
    expect(within(card).getByAltText('Crystal Palace')).toHaveAttribute('src', seasonTeamLogoUrl(1));
    expect(within(card).getByAltText('Olympique Lyonnais')).toHaveAttribute('src', seasonTeamLogoUrl(523));
  });
  it('ne lit plus /api/fixtures', async () => {
    season = [NEXT, LENS, PALACE];
    renderPage();
    await screen.findByTestId('dernier-resultat', undefined, { timeout: 3000 });
    expect(calls).not.toContain('/api/fixtures');
  });
  it('écrit le tour à la place de la journée pour un match sans journée', async () => {
    season = [NEXT, LENS, { ...PALACE, matchday: null, round: 'Barrages · retour' }];
    renderPage();
    expect(await screen.findByTestId('dernier-resultat', undefined, { timeout: 3000 })).toHaveTextContent('Ligue Europa · Barrages · retour');
  });
  it('garde la Ligue 1 quand elle est la plus récente', async () => {
    season = [NEXT, { ...PALACE, date: iso(-10) }, LENS];
    renderPage();
    expect(await screen.findByTestId('dernier-resultat', undefined, { timeout: 3000 })).toHaveTextContent('Lens');
  });
});
