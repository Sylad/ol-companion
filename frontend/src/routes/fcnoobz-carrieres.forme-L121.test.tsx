import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createMemoryHistory, createRootRoute, createRouter } from '@tanstack/react-router';
import { FcNoobzCarrieresPage } from './fcnoobz-carrieres';
import { carrieresLisibles } from '@/lib/fcnoobz-carrieres';

// L121 (revue de code) — un fichier carrieres.json de forme partielle (édition sans `clubs`, club sans `saisons`…)
// ne fait pas planter la page au rendu : il tombe dans l'état d'erreur de la fiche (R2), avec « Réessayer ».
// Données fabriquées.

const SAISON = { saison: '2025-2026', division: 'Division Test', place: 2, provenance: 'saisie' };

const PARTIELS: [string, unknown][] = [
  ['édition sans clubs', { releveLe: null, editions: [{ edition: 26 }] }],
  ['édition sans numéro', { releveLe: null, editions: [{ clubs: [] }] }],
  ['club sans saisons', { releveLe: null, editions: [{ edition: 26, clubs: [{ club: 'Club Test' }] }] }],
  ['club sans nom', { releveLe: null, editions: [{ edition: 26, clubs: [{ saisons: [SAISON] }] }] }],
  ['saisons qui ne sont pas une liste', { releveLe: null, editions: [{ edition: 26, clubs: [{ club: 'Club Test', saisons: {} }] }] }],
  ['saison nulle', { releveLe: null, editions: [{ edition: 26, clubs: [{ club: 'Club Test', saisons: [null] }] }] }],
  ['édition nulle', { releveLe: null, editions: [null] }],
  ['tableau à la racine', []],
];

describe('carrieresLisibles', () => {
  it.each(PARTIELS)('refuse : %s', (_, body) => expect(carrieresLisibles(body)).toBe(false));
  it('accepte un fichier vide, sans éditions, ou complet', () => {
    expect(carrieresLisibles({ releveLe: null, editions: [] })).toBe(true);
    expect(carrieresLisibles({ releveLe: null })).toBe(true);
    expect(
      carrieresLisibles({ releveLe: '2026-11-25', editions: [{ edition: 26, clubs: [{ club: 'Club Test', saisons: [SAISON] }] }] }),
    ).toBe(true);
  });
});

let body: unknown;
beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) =>
      Promise.resolve(
        String(url).includes('/fcnoobz-data/carrieres.json')
          ? { ok: true, status: 200, json: () => Promise.resolve(body) }
          : { ok: false, status: 404, json: () => Promise.resolve(null) },
      ),
    ),
  );
});
afterEach(() => vi.unstubAllGlobals());

function renderPage() {
  const rootRoute = createRootRoute({ component: FcNoobzCarrieresPage });
  const router = createRouter({ routeTree: rootRoute, history: createMemoryHistory({ initialEntries: ['/fcnoobz/carrieres'] }) });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe('L121 — fichier de forme partielle : état d’erreur, pas de plantage', () => {
  it.each(PARTIELS)('%s', async (_, b) => {
    body = b;
    renderPage();
    expect(await screen.findByTestId('message-erreur')).toHaveTextContent('Impossible de charger les carrières.');
    expect(screen.getByTestId('bouton-reessayer')).toBeInTheDocument();
    expect(screen.getByTestId('titre-page')).toHaveTextContent('Mes carrières');
    expect(screen.queryByTestId('message-vide')).toBeNull();
    expect(screen.queryByTestId('edition')).toBeNull();
  });
});
