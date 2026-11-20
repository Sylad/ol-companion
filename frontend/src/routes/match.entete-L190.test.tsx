import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { LiveMatchStats } from '@/types/api';

// L190 — colonnes de l'en-tête bornées en minmax(0,1fr) sur un match de l'OL. (Gabarit de L189 : buteurs compactés pour que la rangée Statistiques | Momentum tienne au-dessus du pli à 1366 × 768
// avec 4 buteurs d'un côté (France 4-1 Belgique). jsdom ne mesure rien : la hauteur est mesurée dans Chromium (voir le
// rapport).) jsdom ne mesure rien : le décentrage du score est mesuré dans Chromium ; ici, ce que le DOM déclare.

vi.mock('@tanstack/react-router', () => ({
  useParams: () => ({ gameId: '4672325' }),
  useSearch: () => ({ matchupId: '523-3250-4672325' }),
  Link: ({ children }: { children: React.ReactNode }) => <a href="/">{children}</a>,
}));
vi.mock('@/hooks/use-match-event-burst', () => ({ useMatchEventBurst: () => null }));
vi.mock('@/components/match-event-burst', () => ({ MatchEventBurst: () => null }));
vi.mock('@/hooks/use-live-match', () => ({ useLiveMatchStats: () => ({ isLoading: false, isError: false, data: stats() }) }));

import { MatchPage } from './match';

(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };

const goal = (competitorId: number, name: string, min: number, type = 'goal') => ({
  competitorId, gameTime: min, gameTimeDisplay: `${min}'`, type, isMajor: true, playerId: 1, extraPlayerId: null,
  playerName: name, playerShortName: null, extraPlayerName: null, description: 'But',
});

function stats(): LiveMatchStats {
  return {
    gameId: 4672325, matchupId: '523-3250-4672325', competitionId: 7016, competitionName: 'Ligue des nations', status: 'ended',
    statusGroup: 4, statusText: 'Terminé', gameTime: 90, gameTimeDisplay: "90'", startTime: '2026-10-05T20:45:00+02:00',
    home: { id: 523, name: 'Lyon', symbolicName: 'FRA', imageVersion: 1, score: 4 },
    away: { id: 3250, name: 'Nice', symbolicName: 'BEL', imageVersion: 1, score: 1 },
    teamStats: { home: {}, away: {} },
    events: [goal(523, 'Aubameyang', 12), goal(523, 'Lacazette', 30), goal(523, 'Aubameyang', 55, 'penalty_goal'), goal(523, 'Tolisso', 80), goal(3250, 'Mukiele', 64)],
    topPerformers: [], shots: [], updatedAt: '2026-10-05T23:00:00Z',
  } as unknown as LiveMatchStats;
}

afterEach(cleanup);

describe('L190 — en-tête du match de l\'OL', () => {
  it('colonnes de l\'en-tête en minmax(0,1fr) auto minmax(0,1fr) : un buteur insécable n\'impose pas sa largeur et le score reste centré', () => {
    render(<MatchPage />);
    const colonne = screen.getByText('Lyon').closest('.text-right')?.parentElement as HTMLElement;
    expect(colonne.className).toContain('grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]');
    expect(colonne.className).not.toContain('grid-cols-[1fr_auto_1fr]');
  });
});
