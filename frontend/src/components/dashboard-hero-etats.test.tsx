import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createMemoryHistory, createRootRoute, createRouter } from '@tanstack/react-router';
import { DashboardHero } from './dashboard-hero';

function renderHero() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const root = createRootRoute({ component: DashboardHero });
  const router = createRouter({ routeTree: root, history: createMemoryHistory({ initialEntries: ['/'] }) });
  return render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe('<DashboardHero /> — gabarit des états (L85)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('R2 — erreur : la carte garde la hauteur du squelette et « Réessayer » a le style bleu de la maquette', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: false, status: 500, json: async () => ({}) })));
    renderHero();
    const bouton = await screen.findByTestId('bouton-reessayer-prochain-match');
    expect(bouton.className).toContain('border-ol-blue-bright');
    expect(bouton.closest('section')?.className).toContain('min-h-[260px]');
  });

  it('R5 — vide : la carte garde la hauteur du squelette', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve({ ok: true, status: 200, json: async () => [] })),
    );
    renderHero();
    const message = await screen.findByTestId('message-aucun-match');
    expect(message.closest('section')?.className).toContain('min-h-[260px]');
  });
});
