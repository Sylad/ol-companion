import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createMemoryHistory, createRootRoute, createRouter } from '@tanstack/react-router';
import * as page from './jeux-video';

const ACCUEIL = 'https://www.footballmanager.com/';
const DATA = {
  verifieLe: '2026-10-11',
  sources: [ACCUEIL, 'https://www.footballmanager.com/news/fm26', 'https://www.footballmanager.com/news/fm24'],
  prochaineSortie: { nom: 'Football Manager 27', date: '2026-11-03' },
  editions: [{ nom: 'Football Manager 26', date: '2025-11-04' }],
  nouveautes: [{ titre: 'Nouveauté', description: 'Description.' }],
};

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => DATA })));
});
afterEach(() => vi.unstubAllGlobals());

describe('R5 — lien du site consulté', () => {
  it('R5 — plusieurs sources d’un même site : le lien garde la première adresse', async () => {
    const Comp = Object.values(page).find((v) => typeof v === 'function') as () => JSX.Element;
    const router = createRouter({
      routeTree: createRootRoute({ component: Comp }),
      history: createMemoryHistory({ initialEntries: ['/fcnoobz/jeux-video'] }),
    });
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );
    const src = await screen.findByTestId('source-verification');
    const liens = src.querySelectorAll('a');
    expect(liens).toHaveLength(1);
    expect(liens[0]).toHaveAttribute('href', ACCUEIL);
  });
});
