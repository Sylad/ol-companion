import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { LiveMatchStats } from '@/types/api';

// L72 — nom de la compétition de l'en-tête passé par le glossaire.
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
    gameId: 4672325, matchupId: '523-3250-4672325', competitionId: 35, competitionName: 'France, Ligue 1', status: 'ended',
    statusGroup: 4, statusText: 'Terminé', gameTime: 90, gameTimeDisplay: "90'", startTime: '2026-10-05T20:45:00+02:00',
    home: { id: 523, name: 'Lyon', symbolicName: 'FRA', imageVersion: 1, score: 4 },
    away: { id: 3250, name: 'Nice', symbolicName: 'BEL', imageVersion: 1, score: 1 },
    teamStats: { home: {}, away: {} },
    events: [goal(523, 'Aubameyang', 12), goal(523, 'Lacazette', 30), goal(523, 'Aubameyang', 55, 'penalty_goal'), goal(523, 'Tolisso', 80), goal(3250, 'Mukiele', 64)],
    topPerformers: [], shots: [], updatedAt: '2026-10-05T23:00:00Z',
  } as unknown as LiveMatchStats;
}

afterEach(cleanup);

describe("L72 — compétition de l'en-tête du match", () => {
  it('R6 — « Ligue 1 », jamais « France, Ligue 1 »', () => {
    render(<MatchPage />);
    expect(screen.getByText('Ligue 1')).toBeInTheDocument();
    expect(screen.queryByText(/France, Ligue 1/)).toBeNull();
  });
});
