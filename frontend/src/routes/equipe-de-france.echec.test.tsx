import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query';
import { RouterProvider, createMemoryHistory, createRootRoute, createRouter } from '@tanstack/react-router';
import { EquipeDeFrancePage } from './equipe-de-france';

afterEach(() => {
  vi.unstubAllGlobals();
  onlineManager.setOnline(true);
});

const BODY = {
  nextMatch: null,
  results: [],
  squad: [
    { id: 1, name: 'Mike Maignan', position: 'Goalkeeper', age: 31 },
    { id: 2, name: 'Sans Âge', position: 'Defender', age: null },
  ],
};

async function setup(initial: () => Promise<unknown>) {
  let handler = initial;
  vi.stubGlobal('fetch', vi.fn(async () => handler()));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const root = createRootRoute({ component: EquipeDeFrancePage });
  const router = createRouter({ routeTree: root, history: createMemoryHistory({ initialEntries: ['/'] }) });
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { client, setHandler: (h: () => Promise<unknown>) => (handler = h) };
}
const ok = async () => ({ ok: true, status: 200, json: async () => BODY });

describe('L118 — échec après des blocs affichés', () => {
  it('R2 : l’erreur remplace les blocs, elle ne s’affiche pas au-dessus', async () => {
    const { client, setHandler } = await setup(ok);
    await screen.findByTestId('effectif');
    setHandler(async () => ({ ok: false, status: 500, json: async () => null }));
    await act(async () => {
      await client.refetchQueries({ queryKey: ['france'] });
    });
    expect(await screen.findByTestId('message-erreur')).toBeInTheDocument();
    expect(screen.queryByTestId('effectif')).toBeNull();
  });
  it('indicateur de chargement pendant le nouvel appel, sans erreur ni blocs', async () => {
    const { client, setHandler } = await setup(ok);
    await screen.findByTestId('effectif');
    setHandler(async () => ({ ok: false, status: 500, json: async () => null }));
    await act(async () => {
      await client.refetchQueries({ queryKey: ['france'] });
    });
    await screen.findByTestId('message-erreur');
    setHandler(() => new Promise(() => {}));
    await act(async () => {
      void client.refetchQueries({ queryKey: ['france'] });
    });
    expect(await screen.findByTestId('message-chargement')).toBeInTheDocument();
    expect(screen.queryByTestId('message-erreur')).toBeNull();
    expect(screen.queryByTestId('effectif')).toBeNull();
  });
  it('L118 — Réessayer : pendant le nouvel appel, le message de chargement remplace l’erreur', async () => {
    const { setHandler } = await setup(async () => ({ ok: false, status: 500, json: async () => null }));
    await screen.findByTestId('message-erreur');
    setHandler(() => new Promise(() => {}));
    await userEvent.setup().click(screen.getByTestId('bouton-reessayer'));
    expect(await screen.findByTestId('message-chargement')).toBeInTheDocument();
    expect(screen.queryByTestId('message-erreur')).toBeNull();
  });
  it('L118 — focus clavier : stable pendant le nouvel appel, puis sur « Réessayer » si l’erreur revient', async () => {
    const { setHandler } = await setup(async () => ({ ok: false, status: 500, json: async () => null }));
    const user = userEvent.setup();
    await screen.findByTestId('message-erreur');
    setHandler(() => new Promise((r) => setTimeout(() => r({ ok: false, status: 500, json: async () => null }), 50)));
    screen.getByTestId('bouton-reessayer').focus();
    await user.keyboard('{Enter}');
    await screen.findByTestId('message-chargement');
    expect(document.body).not.toBe(document.activeElement);
    expect(screen.getByTestId('zone-statut')).toBe(document.activeElement);
    await screen.findByTestId('message-erreur');
    await waitFor(() => expect(screen.getByTestId('bouton-reessayer')).toBe(document.activeElement));
  });
  it('L118 — focus clavier : « Réessayer » qui réussit pose le focus sur le titre de la page', async () => {
    const { setHandler } = await setup(async () => ({ ok: false, status: 500, json: async () => null }));
    const user = userEvent.setup();
    await screen.findByTestId('message-erreur');
    setHandler(() => new Promise((r) => setTimeout(() => r({ ok: true, status: 200, json: async () => BODY }), 50)));
    screen.getByTestId('bouton-reessayer').focus();
    await user.keyboard('{Enter}');
    await screen.findByTestId('effectif');
    await waitFor(() => expect(screen.getByTestId('titre-page')).toBe(document.activeElement));
  });
  it('L118 — hors ligne (requête en pause) : le message de chargement reste affiché', async () => {
    onlineManager.setOnline(false);
    await setup(ok);
    expect(await screen.findByTestId('message-chargement')).toBeInTheDocument();
    expect(screen.queryByTestId('message-erreur')).toBeNull();
  });
  it('L119 — hors ligne avec des données déjà affichées : « Réessayer » montre le chargement et garde le focus dans la page', async () => {
    const { client, setHandler } = await setup(ok);
    await screen.findByTestId('effectif');
    setHandler(async () => ({ ok: false, status: 500, json: async () => null }));
    await act(async () => {
      await client.refetchQueries({ queryKey: ['france'] });
    });
    await screen.findByTestId('message-erreur');
    act(() => onlineManager.setOnline(false));
    const user = userEvent.setup();
    screen.getByTestId('bouton-reessayer').focus();
    await user.keyboard('{Enter}');
    expect(await screen.findByTestId('message-chargement')).toBeInTheDocument();
    expect(screen.queryByTestId('message-erreur')).toBeNull();
    expect(screen.getByTestId('zone-statut')).toBe(document.activeElement);
  });
  it('âge absent : aucun « 0 ans »', async () => {
    await setup(ok);
    await screen.findByTestId('effectif');
    expect(screen.queryByText(/0 ans/)).toBeNull();
    expect(screen.getByText('31 ans')).toBeInTheDocument();
    const ligne = screen.getByText('Sans Âge').closest('[data-testid="joueur-ligne"]')!;
    expect(ligne.textContent).toBe('Sans Âge');
  });
});
