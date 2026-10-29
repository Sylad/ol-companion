import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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

type Saison = SeasonMatch[] | 'echec' | 'attente';

function serve(live: LiveMatchSummary | null, season: Saison = [NICE_A_VENIR]) {
  return vi.fn((url: string) => {
    if (url === '/api/season-matches') {
      if (season === 'attente') return new Promise(() => {});
      if (season === 'echec') return Promise.resolve({ ok: false, status: 503, json: async () => ({}) });
      return Promise.resolve(okJson(season));
    }
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

  it('R8 — le libellé « Match en direct » reste rouge : il ne porte pas `eyebrow`, dont le gris sort après `text-live` dans la feuille', async () => {
    vi.stubGlobal('fetch', serve(direct()));
    renderHero();

    const badge = await screen.findByText('Match en direct');
    expect(badge).toHaveClass('text-live');
    expect(badge).not.toHaveClass('eyebrow');
    expect(badge).toHaveClass('uppercase', 'font-semibold', 'text-[11px]');
    // la pulsation ne baisse pas l'opacité du texte (4,5:1 tenu à chaque instant du cycle)
    expect(badge).toHaveClass('animate-pulse-live-halo');
    expect(badge).not.toHaveClass('animate-pulse-live');
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

  it.each([
    ['terminé', { status: 'ended', statusGroup: 4 }],
    ['à venir', { status: 'upcoming', statusGroup: 2 }],
  ] as const)('R5 — match %s dans /live-match/current : le bandeau ne s’y fie pas', async (_nom, partial) => {
    vi.stubGlobal('fetch', serve(direct(partial)));
    renderHero();

    expect(await screen.findByText('Prochain rendez-vous')).toBeInTheDocument();
    expect(screen.queryByText('Match en direct')).not.toBeInTheDocument();
  });

  it('R9 — à la mi-temps, le statut du bandeau dit « Mi-temps » comme la carte du direct, pas « En cours »', async () => {
    vi.stubGlobal('fetch', serve(direct({ statusText: 'Mi-temps', gameTimeDisplay: '' })));
    renderHero();

    await screen.findByText('Match en direct');
    expect(screen.getByText('Statut').nextSibling).toHaveTextContent('Mi-temps');
    expect(screen.queryByText('En cours')).not.toBeInTheDocument();
  });

  it('R9 — en jeu, le statut reste « En cours »', async () => {
    vi.stubGlobal('fetch', serve(direct({ statusText: 'Deuxième mi-temps' })));
    renderHero();

    await screen.findByText('Match en direct');
    expect(screen.getByText('Statut').nextSibling).toHaveTextContent('En cours');
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

  it('R7 — le direct s’affiche aussi quand la liste de la saison est vide', async () => {
    vi.stubGlobal('fetch', serve(direct(), []));
    renderHero();

    expect(await screen.findByText('Match en direct')).toBeInTheDocument();
    expect(screen.queryByTestId('message-aucun-match')).not.toBeInTheDocument();
  });

  it('R7 — le direct s’affiche quand la liste de la saison répond 503, sans message d’erreur', async () => {
    const fetchMock = serve(direct(), 'echec');
    vi.stubGlobal('fetch', fetchMock);
    renderHero();

    expect(await screen.findByText('Match en direct')).toBeInTheDocument();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/season-matches', expect.anything()));
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByTestId('message-erreur-prochain-match')).not.toBeInTheDocument();
    expect(screen.getByText('Match en direct')).toBeInTheDocument();
  });

  it('R7 — le direct s’affiche tant que la liste de la saison est en attente, sans squelette', async () => {
    vi.stubGlobal('fetch', serve(direct(), 'attente'));
    renderHero();

    expect(await screen.findByText('Match en direct')).toBeInTheDocument();
    expect(screen.queryByTestId('squelette-prochain-match')).not.toBeInTheDocument();
  });
});
