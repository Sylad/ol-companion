import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
// La fiche ne couvre pas ces deux blocs : aucune règle Rn citée.

function renderWith(ui: JSX.Element) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe.each([
  ['OL en chiffres', <SeasonSummary />, { played: 0 }],
  ['tracker de classement', <PositionTracker />, []],
])('L85 — %s en erreur', (_nom, ui, ok) => {
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
});
