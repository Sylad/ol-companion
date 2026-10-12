import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Outlet, RouterProvider, createMemoryHistory, createRootRoute, createRoute, createRouter } from '@tanstack/react-router';
import { DashboardPage } from './index';

// L85 — R2 (2e phrase), R3, R4 : une erreur de rafraîchissement avec des données déjà là n'efface rien.
// use-event-stream relance ['fixtures'] à chaque fixtures-changed : on rejoue ce cas.

const DAY = 86_400_000;
const iso = (d: number) => new Date(Date.now() + d * DAY).toISOString();
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
const json = (body: unknown) => ({ ok: true, status: 200, json: async () => body });
const fail = () => ({ ok: false, status: 500, json: async () => null });

let failing = false;
let calls: string[] = [];

beforeEach(() => {
  failing = false;
  calls = [];
  window.scrollTo = (() => {}) as typeof window.scrollTo;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const u = String(url);
      calls.push(u);
      if (failing) return fail();
      if (u === '/api/fixtures' || u === '/api/season-matches') return json([NEXT, LAST]);
      if (u === '/api/standings') return json({ season: '2026', updatedAt: '2026-10-11T00:00:00Z', currentMatchday: 6, table: [OL_ROW] });
      return { ok: false, status: 404, json: async () => null };
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

describe('L85 — rafraîchissement en échec', () => {
  it('R2 — une erreur de rafraîchissement avec des données déjà là n\'efface rien', async () => {
    const root = createRootRoute({ component: () => <Outlet /> });
    const index = createRoute({ getParentRoute: () => root, path: '/', component: DashboardPage });
    const router = createRouter({ routeTree: root.addChildren([index]), history: createMemoryHistory({ initialEntries: ['/'] }) });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );
    await screen.findByTestId('carte-prochain-match', undefined, { timeout: 3000 });
    await screen.findByTestId('dernier-resultat', undefined, { timeout: 3000 });
    expect(screen.getByTestId('stat-points')).toHaveTextContent('11');

    failing = true;
    const before = calls.filter((u) => u === '/api/fixtures' || u === '/api/season-matches' || u === '/api/standings').length;
    await act(async () => {
      await client.invalidateQueries({ queryKey: ['fixtures'] });
      await client.invalidateQueries({ queryKey: ['season-matches'] });
      await client.invalidateQueries({ queryKey: ['standings'] });
    });
    await waitFor(() => expect(calls.filter((u) => u === '/api/fixtures' || u === '/api/season-matches' || u === '/api/standings').length).toBeGreaterThan(before));
    await waitFor(() => expect(client.getQueryState(['fixtures'])?.status).toBe('error'));
    await waitFor(() => expect(client.getQueryState(['season-matches'])?.status).toBe('error'));

    expect(screen.getByTestId('carte-prochain-match')).toBeInTheDocument();
    expect(screen.getByTestId('dernier-resultat')).toBeInTheDocument();
    expect(screen.getByTestId('stat-points')).toHaveTextContent('11');
    for (const id of ['message-erreur-prochain-match', 'message-erreur-dernier-resultat', 'message-erreur-stats', 'squelette-prochain-match', 'message-aucun-match']) {
      expect(screen.queryByTestId(id)).toBeNull();
    }
  });
});
