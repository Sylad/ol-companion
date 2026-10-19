import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { RouterProvider, createMemoryHistory, createRouter } from '@tanstack/react-router';

// L188 — /match/<id>?matchupId=… ouvert directement (lien copié, F5) : l'URL suffit, jamais « Lien incomplet ».

const appels: Array<[number | null, string | null]> = [];
vi.mock('./components/layout/app-shell', async () => {
  const { Outlet } = await import('@tanstack/react-router');
  return { AppShell: () => <Outlet /> };
});
vi.mock('@/hooks/use-live-match', () => ({
  useLiveMatchStats: (gameId: number | null, matchupId: string | null) => {
    appels.push([gameId, matchupId]);
    return { isLoading: true, isError: false, data: undefined, error: null, fetchStatus: 'fetching', refetch: () => {} };
  },
}));

import { router as routeurApplication } from './router';

beforeEach(() => {
  appels.length = 0;
  window.scrollTo = (() => {}) as typeof window.scrollTo;
});

async function ouvrir(chemin: string) {
  const router = createRouter({
    routeTree: routeurApplication.routeTree,
    history: createMemoryHistory({ initialEntries: [chemin] }),
  });
  await router.load();
  render(<RouterProvider router={router} />);
}

describe('Page match — lien direct (L188)', () => {
  it('Match des Bleus ouvert par son URL seule : matchupId transmis, pas « Lien incomplet »', async () => {
    await ouvrir('/match/4672325?matchupId=5061-2373-4672325');
    await waitFor(() => expect(document.querySelector('h1')).not.toBeNull(), { timeout: 3000 });
    expect(document.querySelector('h1')?.textContent).not.toMatch(/Lien incomplet/);
    expect(appels.at(-1)).toEqual([4672325, '5061-2373-4672325']);
  }, 15_000);

  // Les cinq liens que la page Équipe de France produit (mesure du 19-10) : chacun, ouvert seul, doit suffire.
  it.each([
    ['4672344', '5061-2375-4672344'],
    ['4672369', '2373-5061-4672369'],
    ['4672066', '5047-5061-4672066'],
    ['4773214', '5061-5054-4773214'],
  ])('match %s ouvert par son URL seule : matchupId %s transmis', async (gameId, matchupId) => {
    await ouvrir(`/match/${gameId}?matchupId=${matchupId}`);
    await waitFor(() => expect(document.querySelector('h1')).not.toBeNull(), { timeout: 3000 });
    expect(document.querySelector('h1')?.textContent).not.toMatch(/Lien incomplet/);
    expect(appels.at(-1)).toEqual([Number(gameId), matchupId]);
  }, 15_000);

  it('lien dont le tiret est encodé (%2D, copié depuis certains clients) : même résultat', async () => {
    await ouvrir('/match/4672325?matchupId=5061%2D2373%2D4672325');
    await waitFor(() => expect(document.querySelector('h1')).not.toBeNull(), { timeout: 3000 });
    expect(appels.at(-1)).toEqual([4672325, '5061-2373-4672325']);
  }, 15_000);

  it('sans matchupId, « Lien incomplet » reste affiché (le backend l\'exige)', async () => {
    await ouvrir('/match/4672325');
    await waitFor(() => expect(document.querySelector('h1')?.textContent).toMatch(/Lien incomplet/), { timeout: 3000 });
  }, 15_000);
});
