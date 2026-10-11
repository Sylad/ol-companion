import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
vi.mock('recharts', () => {
  const Null = () => null;
  return {
    Area: Null, AreaChart: Null, CartesianGrid: Null, ResponsiveContainer: Null, Tooltip: Null, XAxis: Null, YAxis: Null,
    LineChart: Null, Line: Null, ReferenceDot: Null,
  };
});

import { SeasonSummary } from './season-summary';
import { PositionTracker } from './position-tracker';

// L85 (finding M2 de la revue UX L2) — « Erreur de chargement. » de l'accueil a son « Réessayer ».
// R9 (à ajouter à la fiche par le lead) : ces deux blocs en erreur sans cache ont message + « Réessayer » ;
// une erreur de rafraîchissement avec des données déjà là n'efface rien.

function renderWith(ui: JSX.Element) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return { client, ...render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>) };
}

describe.each([
  ['OL en chiffres', <SeasonSummary />, { played: 0 }],
  ['tracker de classement', <PositionTracker />, []],
])('R9 — %s en erreur', (_nom, ui, ok) => {
  afterEach(() => vi.unstubAllGlobals());

  it('affiche un message et « Réessayer », qui relance l’appel', async () => {
    let fail = true;
    const fetchMock = vi.fn(() =>
      Promise.resolve(fail
        ? { ok: false, status: 500, json: async () => ({}) }
        : { ok: true, status: 200, json: async () => ok }),
    );
    vi.stubGlobal('fetch', fetchMock);
    renderWith(ui);
    const bouton = await screen.findByRole('button', { name: 'Réessayer' });
    expect(screen.getByRole('alert')).toHaveTextContent('Impossible de charger');
    expect(screen.queryByText('Erreur de chargement.')).not.toBeInTheDocument();
    const appels = fetchMock.mock.calls.length;
    fail = false;
    fireEvent.click(bouton);
    await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThan(appels));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Réessayer' })).not.toBeInTheDocument());
  });

  it('R9 — le message porte l’id de champ de la fiche', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: false, status: 500, json: async () => ({}) })));
    renderWith(ui);
    await screen.findByRole('alert');
    const id = _nom === 'OL en chiffres' ? 'message-erreur-season-summary' : 'message-erreur-position-tracker';
    expect(screen.getByTestId(id)).toBe(screen.getByRole('alert'));
  });

  it('R9 — données en cache puis échec du refetch : rien n’est effacé, aucun message', async () => {
    let fail = false;
    const fetchMock = vi.fn(() =>
      Promise.resolve(fail
        ? { ok: false, status: 500, json: async () => ({}) }
        : { ok: true, status: 200, json: async () => ok }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const { client } = renderWith(ui);
    await waitFor(() => expect(client.getQueryCache().getAll().some((q) => q.state.data !== undefined)).toBe(true));
    await waitFor(() => expect(client.isFetching()).toBe(0));
    const appels = fetchMock.mock.calls.length;
    fail = true;
    await act(async () => {
      await client.refetchQueries();
      await new Promise((r) => setTimeout(r, 20)); // TanStack notifie les composants au tick suivant
    });
    expect(fetchMock.mock.calls.length).toBeGreaterThan(appels);
    expect(client.getQueryCache().getAll().some((q) => q.state.status === 'error')).toBe(true);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Réessayer' })).not.toBeInTheDocument();
  });
});
