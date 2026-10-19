import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { LiveMatchStats } from '@/types/api';

// L65 — noms de l'en-tête d'un match de l'OL lisibles à 320 px (mesure réelle : tests-navigateur/match-geometrie.test.ts).
// jsdom ne mesure rien : ici, ce que le DOM déclare.
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

describe('L65 — noms de club de l\'en-tête du match de l\'OL', () => {
  it('R1 — 24 px, 18 px sous 600 px, 16 px sous 390 px, coupure dans le mot', () => {
    render(<MatchPage />);
    for (const nom of ['Lyon', 'Nice']) {
      const cls = screen.getByText(nom, { selector: '.font-display' }).className;
      expect(cls).toContain('[overflow-wrap:anywhere]');
      expect(cls).toContain('max-[599px]:text-lg');
      expect(cls).toContain('max-[389px]:text-base');
      expect(cls).toContain('text-2xl');
    }
  });

  it('R1 — sous 360 px, marge latérale 6 px et écart 4 px comme l\'en-tête des Bleus', () => {
    render(<MatchPage />);
    const grille = screen.getByText('Lyon', { selector: '.font-display' }).closest('.grid') as HTMLElement;
    expect(grille.className).toContain('max-[599px]:px-3');
    expect(grille.className).toContain('max-[599px]:gap-x-2');
    expect(grille.className).toContain('max-[359px]:px-[6px]');
    expect(grille.className).toContain('max-[359px]:gap-x-1');
  });
});
