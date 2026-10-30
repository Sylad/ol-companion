import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createMemoryHistory, createRootRoute, createRouter } from '@tanstack/react-router';
import type { SeasonMatch } from '@/types/api';
import { DashboardHero } from './dashboard-hero';

// L89 — le sur-titre du bandeau (« Prochain rendez-vous », « Jour de match »…) portait `eyebrow`
// ET `text-ol-red-bright` : `.eyebrow` (@layer utilities, index.css) sort après et le grisait
// (fg-dim). Sur la photo du stade, ce gris passait sous 4,5:1 : le libellé a donc aussi un fond.

const okJson = (body: unknown) => ({ ok: true, status: 200, json: async () => body });

function match(date: string): SeasonMatch {
  return {
    id: 1,
    date,
    homeTeam: 'Olympique Lyonnais',
    homeTeamId: 523,
    awayTeam: 'OGC Nice',
    awayTeamId: 470,
    homeScore: null,
    awayScore: null,
    competition: 'Ligue 1',
    status: 'SCHEDULED',
    matchday: 7,
    timeConfirmed: true,
    competitionCode: 'L1',
    competitionId: 35,
  };
}

function serve(matches: SeasonMatch[]) {
  return vi.fn((url: string) => {
    if (url === '/api/season-matches') return Promise.resolve(okJson(matches));
    if (url === '/api/live-match/current') return Promise.resolve(okJson(null));
    if (url.startsWith('/api/wiki-image')) return Promise.resolve(okJson({ imageUrl: 'https://exemple.test/stade.jpg' }));
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

describe('<DashboardHero /> — sur-titre (L89)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-10-09T10:00:00Z') });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it.each([
    ['Prochain rendez-vous', '2026-10-17T18:45:00Z'],
    ["Approche du coup d'envoi", '2026-10-10T18:45:00Z'],
    ['Jour de match', '2026-10-09T18:45:00Z'],
  ])('R1 — « %s » est rouge, sans `eyebrow` (dont le gris l\'écraserait) et sur un fond opaque', async (libelle, date) => {
    vi.stubGlobal('fetch', serve([match(date)]));
    renderHero();

    const label = await screen.findByText(libelle);
    expect(label).toHaveClass('text-ol-red-bright');
    expect(label).not.toHaveClass('eyebrow');
    expect(label).toHaveClass('uppercase', 'font-semibold', 'text-[11px]');
    expect(label).toHaveClass('bg-bg/90');
  });
});
