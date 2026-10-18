import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ApiError } from '@/lib/api';
import type { LiveMatchStats } from '@/types/api';

// L181 — page match : « introuvable » (404) distinct d'une panne (réseau, 5xx), Réessayer, h1 sur chaque état.

let hook: Record<string, unknown>;
let search: { matchupId?: string };
const refetch = vi.fn();

vi.mock('@tanstack/react-router', () => ({
  useParams: () => ({ gameId: '10' }),
  useSearch: () => search,
  Link: ({ children }: { children: React.ReactNode }) => <a href="/">{children}</a>,
}));
vi.mock('@/hooks/use-match-event-burst', () => ({ useMatchEventBurst: () => null }));
vi.mock('@/hooks/use-live-match', () => ({ useLiveMatchStats: () => hook }));
vi.mock('@/components/shot-map', () => ({ ShotMap: () => null }));
vi.mock('@/components/momentum-chart', () => ({ MomentumChart: () => null }));
vi.mock('@/components/lineup-card', () => ({ LineupCard: () => null }));
vi.mock('@/components/mini-standings', () => ({ MiniStandings: () => null }));
vi.mock('@/components/match-event-burst', () => ({ MatchEventBurst: () => null }));

import { MatchPage } from './match';

(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };

beforeEach(() => {
  refetch.mockReset();
  search = { matchupId: '465-1-10' };
});

const erreur = (error: unknown) => {
  hook = { isLoading: false, isError: true, data: undefined, error, refetch };
};

describe('Page match — erreurs (L181)', () => {
  it('R1 — un 404 dit « Match introuvable », sans bouton Réessayer', () => {
    erreur(new ApiError(404, 'GET → 404'));
    render(<MatchPage />);
    expect(screen.getByTestId('message-erreur')).toHaveTextContent('Match introuvable');
    expect(screen.queryByRole('button', { name: 'Réessayer' })).toBeNull();
  });

  it('R2 — une panne (5xx) ne dit pas « introuvable » et propose Réessayer', () => {
    erreur(new ApiError(503, 'GET → 503'));
    render(<MatchPage />);
    const msg = screen.getByTestId('message-erreur');
    expect(msg).not.toHaveTextContent('introuvable');
    expect(msg).toHaveTextContent('Impossible de charger le match');
    expect(screen.getByRole('link')).toBeInTheDocument();
  });

  it('R3 — une panne réseau (TypeError) est une panne, pas un 404', () => {
    erreur(new TypeError('Failed to fetch'));
    render(<MatchPage />);
    expect(screen.getByTestId('message-erreur')).toHaveTextContent('Impossible de charger le match');
  });

  it('R4 — Réessayer relance la requête (refetch)', () => {
    erreur(new ApiError(500, 'GET → 500'));
    render(<MatchPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('R5 — un h1 sur l\'état erreur (404 et panne)', () => {
    erreur(new ApiError(404, 'x'));
    const a = render(<MatchPage />);
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    a.unmount();
    erreur(new ApiError(503, 'x'));
    render(<MatchPage />);
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  });

  it('R6 — un h1 sur l\'état chargement', () => {
    hook = { isLoading: true, isError: false, data: undefined, refetch };
    render(<MatchPage />);
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  });

  it('R7 — un h1 sur l\'état « lien incomplet »', () => {
    search = {};
    hook = { isLoading: false, isError: false, data: undefined, refetch };
    render(<MatchPage />);
    expect(screen.getByText(/Lien incomplet/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  });

  it('R8 — un échec de rafraîchissement avec le match déjà affiché n\'efface rien', () => {
    const data = {
      gameId: 10, matchupId: '465-1-10', competitionId: 35, competitionName: 'Ligue 1',
      status: 'live', statusGroup: 3, statusText: 'x', gameTime: 30, gameTimeDisplay: "30'",
      startTime: '2026-10-17T19:00:00Z',
      home: { id: 465, name: 'Lyon', symbolicName: 'LYO', imageVersion: 1, score: 1 },
      away: { id: 1, name: 'Lens', symbolicName: 'LEN', imageVersion: 1, score: 0 },
      teamStats: { home: {}, away: {} }, events: [], topPerformers: [], shots: [], updatedAt: '2026-10-17T19:30:00Z',
    } as unknown as LiveMatchStats;
    hook = { isLoading: false, isError: true, data, error: new ApiError(503, 'GET → 503'), refetch };
    render(<MatchPage />);
    expect(screen.queryByTestId('message-erreur')).toBeNull();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Lyon – Lens');
  });
});
