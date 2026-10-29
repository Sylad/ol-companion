import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createMemoryHistory, createRootRoute, createRouter } from '@tanstack/react-router';
import type { LiveMatchSummary, SeasonMatch } from '@/types/api';
import { DashboardHero } from './dashboard-hero';

// L84 — pendant Lens – Lyon (09-10, 56'), le bandeau disait « Prochain rendez-vous · Nice ·
// dans 8 jours » : 365scores retire le match en cours de ses matchs à venir, la liste de la
// saison ne le porte donc pas. C'est /api/live-match/current qui dit qu'un match est en direct.

const okJson = (body: unknown) => ({ ok: true, status: 200, json: async () => body });

const NICE_A_VENIR: SeasonMatch = {
  id: 1,
  date: '2026-10-17T18:45:00Z',
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

function direct(partial: Partial<LiveMatchSummary> = {}): LiveMatchSummary {
  return {
    gameId: 4321,
    matchupId: '481-465-35',
    competitionId: 35,
    competitionName: 'France, Ligue 1',
    status: 'live',
    statusGroup: 3,
    statusText: '2e mi-temps',
    gameTime: 56,
    gameTimeDisplay: "56'",
    startTime: '2026-10-09T18:45:00Z',
    home: { id: 481, name: 'Lens', symbolicName: 'LEN', imageVersion: 1, score: 1 },
    away: { id: 465, name: 'Lyon', symbolicName: 'LYO', imageVersion: 1, score: 0 },
    ...partial,
  };
}

function serve(live: LiveMatchSummary | null, season: SeasonMatch[] = [NICE_A_VENIR]) {
  return vi.fn((url: string) => {
    if (url === '/api/season-matches') return Promise.resolve(okJson(season));
    if (url === '/api/live-match/current') return Promise.resolve(okJson(live));
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

describe('<DashboardHero /> — match en direct (L84)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-10-09T19:41:00Z') });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('R1 — un match en direct absent de la liste de la saison : le bandeau le montre, pas le prochain match', async () => {
    vi.stubGlobal('fetch', serve(direct()));
    const { container } = renderHero();

    expect(await screen.findByText('Match en direct')).toBeInTheDocument();
    expect(screen.getByText('1 : 0')).toBeInTheDocument();
    expect(screen.getAllByText('Lens').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Olympique Lyonnais').length).toBeGreaterThan(0);
    expect(screen.getByText(/Ligue 1/)).toBeInTheDocument();
    expect(container).not.toHaveTextContent('Prochain rendez-vous');
    expect(container).not.toHaveTextContent('Nice');
    expect(container).not.toHaveTextContent(/dans \d+ jours?/);
  });

  it('R2 — OL à l’extérieur : le score reste dans le sens domicile / extérieur et le lieu est « Extérieur »', async () => {
    vi.stubGlobal('fetch', serve(direct()));
    renderHero();

    await screen.findByText('Match en direct');
    expect(screen.getByText('Extérieur')).toBeInTheDocument();
    expect(screen.getByText('Adversaire').nextSibling).toHaveTextContent('Lens');
  });

  it('R3 — OL à domicile : le lieu est « Domicile » et le score garde son sens', async () => {
    vi.stubGlobal(
      'fetch',
      serve(
        direct({
          home: { id: 465, name: 'Lyon', symbolicName: 'LYO', imageVersion: 1, score: 2 },
          away: { id: 481, name: 'Lens', symbolicName: 'LEN', imageVersion: 1, score: 3 },
        }),
      ),
    );
    renderHero();

    expect(await screen.findByText('2 : 3')).toBeInTheDocument();
    expect(screen.getByText('Domicile')).toBeInTheDocument();
  });

  it('R4 — aucun match en direct (null) : le bandeau montre le prochain match', async () => {
    vi.stubGlobal('fetch', serve(null));
    renderHero();

    expect(await screen.findByText('Prochain rendez-vous')).toBeInTheDocument();
    expect(screen.queryByText('Match en direct')).not.toBeInTheDocument();
  });

  it('R5 — match à venir ou terminé dans /live-match/current : le bandeau ne s’y fie pas', async () => {
    vi.stubGlobal('fetch', serve(direct({ status: 'ended', statusGroup: 4 })));
    renderHero();

    expect(await screen.findByText('Prochain rendez-vous')).toBeInTheDocument();
    expect(screen.queryByText('Match en direct')).not.toBeInTheDocument();
  });

  it('R6 — /live-match/current en échec : le bandeau garde le prochain match', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      if (url === '/api/live-match/current') return Promise.resolve({ ok: false, status: 503, json: async () => ({}) });
      if (url === '/api/season-matches') return Promise.resolve(okJson([NICE_A_VENIR]));
      return Promise.resolve(okJson({ imageUrl: null }));
    }));
    renderHero();

    expect(await screen.findByText('Prochain rendez-vous')).toBeInTheDocument();
  });

  it('R7 — le direct s’affiche aussi quand la liste de la saison est vide ou en échec', async () => {
    vi.stubGlobal('fetch', serve(direct(), []));
    renderHero();

    expect(await screen.findByText('Match en direct')).toBeInTheDocument();
    expect(screen.queryByTestId('message-aucun-match')).not.toBeInTheDocument();
  });
});
