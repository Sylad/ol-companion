import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createMemoryHistory, createRootRoute, createRouter } from '@tanstack/react-router';
import { EquipeDeFrancePage } from './equipe-de-france';

afterEach(() => vi.unstubAllGlobals());

describe('Équipe de France — groupes de l’effectif', () => {
  it('R8 — seuls les quatre postes de la fiche forment des groupes (pas de « Autres »)', async () => {
    const body = {
      nextMatch: null,
      results: [],
      squad: [
        { id: 1, name: 'Mike Maignan', position: 'Goalkeeper', age: 31 },
        { id: 2, name: 'Sans Poste', position: '', age: 40 },
      ],
    };
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => body })));
    const root = createRootRoute({ component: EquipeDeFrancePage });
    const router = createRouter({ routeTree: root, history: createMemoryHistory({ initialEntries: ['/'] }) });
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );
    const titres = (await screen.findAllByTestId('groupe-poste-titre')).map((t) => t.textContent);
    expect(titres).toEqual(['Gardiens (1)']);
    expect(screen.queryByText(/Autres/)).toBeNull();
  });
});
