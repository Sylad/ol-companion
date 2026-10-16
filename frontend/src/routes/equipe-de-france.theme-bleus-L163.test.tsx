import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createMemoryHistory, createRootRoute, createRouter } from '@tanstack/react-router';
import { EquipeDeFrancePage } from './equipe-de-france';

afterEach(() => vi.unstubAllGlobals());

describe('Équipe de France — thème de la barre de défilement (L163, R4)', () => {
  it('pose body.theme-bleus à l’affichage de la page, même sans données, et le retire quand on la quitte', async () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
    const root = createRootRoute({ component: EquipeDeFrancePage });
    const router = createRouter({ routeTree: root, history: createMemoryHistory({ initialEntries: ['/'] }) });
    expect(document.body.classList.contains('theme-bleus')).toBe(false);
    const { unmount } = render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );
    await waitFor(() => expect(document.body.classList.contains('theme-bleus')).toBe(true));
    unmount();
    expect(document.body.classList.contains('theme-bleus')).toBe(false);
  });
});
