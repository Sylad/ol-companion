import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Outlet, RouterProvider, createMemoryHistory, createRootRoute, createRoute, createRouter } from '@tanstack/react-router';
import { DashboardPage } from './index';

// L135 — un match de coupe nul décidé aux tirs au but ne se lit plus « Match nul ».

const DAY = 86_400_000;
const iso = (d: number) => new Date(Date.now() + d * DAY).toISOString();
const CDF = {
  id: 3, date: iso(-1), homeTeam: 'Olympique Lyonnais', homeTeamId: 523, awayTeam: 'Rennes', awayTeamId: 800,
  homeScore: 1, awayScore: 1, competition: 'Coupe de France', competitionCode: 'CDF', competitionId: 37,
  status: 'FINISHED', matchday: null, round: null, timeConfirmed: true,
};
const json = (body: unknown) => ({ ok: true, status: 200, json: async () => body });
let season: unknown[];

beforeEach(() => {
  window.scrollTo = (() => {}) as typeof window.scrollTo;
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (String(url) === '/api/season-matches') return json(season);
    return { ok: false, status: 404, json: async () => null };
  }));
});
afterEach(() => vi.unstubAllGlobals());

async function card() {
  const root = createRootRoute({ component: () => <Outlet /> });
  const index = createRoute({ getParentRoute: () => root, path: '/', component: DashboardPage });
  const router = createRouter({ routeTree: root.addChildren([index]), history: createMemoryHistory({ initialEntries: ['/'] }) });
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return screen.findByTestId('dernier-resultat', undefined, { timeout: 3000 });
}

describe('L135 — dernier résultat aux tirs au but', () => {
  it('OL qualifié : « Victoire aux tirs au but » sous le score 1 · 1', async () => {
    season = [{ ...CDF, shootoutWinnerId: 523 }];
    const c = await card();
    expect(c).toHaveTextContent('Victoire aux tirs au but');
    expect(c).not.toHaveTextContent('Match nul');
    expect(c).toHaveTextContent('1 · 1');
    expect(c).toHaveTextContent('Qualifié aux tirs au but');
  });
  it('OL éliminé : « Défaite aux tirs au but »', async () => {
    season = [{ ...CDF, shootoutWinnerId: 800 }];
    const c = await card();
    expect(c).toHaveTextContent('Défaite aux tirs au but');
    expect(c).toHaveTextContent('Éliminé aux tirs au but');
  });
  it('sans qualifié désigné, un nul reste « Match nul »', async () => {
    season = [{ ...CDF, shootoutWinnerId: null }];
    const c = await card();
    expect(c).toHaveTextContent('Match nul');
    expect(c).not.toHaveTextContent('tirs au but');
  });
});
