import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createMemoryHistory, createRootRoute, createRouter } from '@tanstack/react-router';
import type { Fixture } from '@/types/api';
import { DashboardHero } from './dashboard-hero';

// L90 — au téléphone (< lg), le panneau « Tableau de bord match » répétait statut,
// adversaire et lieu déjà lus dans le bandeau (180 px sur 401) : il est masqué, et la ligne
// du lieu dit « Domicile » ou « Extérieur » en fin de ligne. jsdom ne mesure rien : on
// vérifie les classes responsives ; la hauteur se mesure dans Chromium (capture de la livraison).

const okJson = (body: unknown) => ({ ok: true, status: 200, json: async () => body });

function match(partial: Partial<Fixture>): Fixture {
  return {
    id: 1,
    date: '2026-10-18T15:00:00Z',
    homeTeam: 'Olympique Lyonnais',
    homeTeamId: 523,
    awayTeam: 'OGC Nice',
    awayTeamId: 522,
    homeScore: null,
    awayScore: null,
    competition: 'Ligue 1',
    status: 'TIMED',
    matchday: 8,
    timeConfirmed: true,
    ...partial,
  };
}

function serve(matches: Fixture[]) {
  return vi.fn((url: string) => {
    if (url === '/api/season-matches') return Promise.resolve(okJson(matches));
    if (url.startsWith('/api/wiki-image')) return Promise.resolve(okJson({ imageUrl: null }));
    return Promise.resolve({ ok: false, status: 404, json: async () => ({}) });
  });
}

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

describe('<DashboardHero /> — téléphone (L90)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-10-10T12:00:00Z') });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('R1 — le panneau « Tableau de bord match » est masqué sous lg et affiché à partir de lg', async () => {
    vi.stubGlobal('fetch', serve([match({})]));
    renderHero();

    const titre = await screen.findByText('Tableau de bord match');
    const panneau = titre.closest('.backdrop-blur-md');
    expect(panneau).toHaveClass('hidden', 'lg:block');
  });

  it('R2 — à domicile : « Domicile » clôt la ligne du lieu, après le stade, et ne se voit que sous lg', async () => {
    vi.stubGlobal('fetch', serve([match({})]));
    renderHero();

    const stade = await screen.findByText(/Groupama Stadium · Décines-Charpieu/);
    const suffixe = stade.querySelector('.lg\\:hidden');
    expect(suffixe).not.toBeNull();
    expect(suffixe).toHaveTextContent('· Domicile');
    expect(stade.closest('.inline-flex')).not.toHaveClass('lg:hidden');
    // Le « · » reste collé à « Domicile » (espace insécable après) : la ligne ne peut pas se couper
    // entre les deux ; elle peut en revanche se couper avant le « · ».
    expect(stade.textContent).toBe('Groupama Stadium · Décines-Charpieu ·\u00a0Domicile');
  });

  it('R2 — à l’extérieur : « · Extérieur » après le stade de l’adversaire', async () => {
    vi.stubGlobal(
      'fetch',
      serve([match({ homeTeam: 'OGC Nice', homeTeamId: 522, awayTeam: 'Olympique Lyonnais', awayTeamId: 523 })]),
    );
    renderHero();

    const stade = await screen.findByText(/Allianz Riviera/);
    expect(stade.querySelector('.lg\\:hidden')).toHaveTextContent('· Extérieur');
  });

  it('R2 — stade inconnu : la ligne du lieu dit « Extérieur » seul, sans « · » en tête, masquée dès lg', async () => {
    vi.stubGlobal(
      'fetch',
      serve([match({ homeTeam: 'Club Inconnu FC', homeTeamId: 99999, awayTeam: 'Olympique Lyonnais', awayTeamId: 523 })]),
    );
    renderHero();

    const suffixe = await screen.findByText('Extérieur', { selector: '.lg\\:hidden' });
    expect(suffixe.textContent).toBe('Extérieur');
    // Sans stade, la ligne entière n'existe pas à partir de lg (le panneau dit déjà « Extérieur »).
    expect(suffixe.closest('.inline-flex')).toHaveClass('lg:hidden');
  });
});
