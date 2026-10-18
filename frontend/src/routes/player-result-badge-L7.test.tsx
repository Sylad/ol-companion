import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { PlayerSeasonStats } from '@/types/api';

// L7/t5 — la fiche joueur écrit les résultats V / N / D comme la page Coupes (cup-match-row) :
// D = défaite, N = nul (« D » veut dire défaite partout), chaque badge porte son aria-label.

vi.mock('@tanstack/react-router', () => ({
  useParams: () => ({ athleteId: '7' }),
  useSearch: () => ({}),
  Link: ({ children }: { children: React.ReactNode }) => <a href="/">{children}</a>,
}));
vi.mock('recharts', () => {
  const Null = () => null;
  return {
    LineChart: Null, Line: Null, XAxis: Null, YAxis: Null, CartesianGrid: Null, Tooltip: Null,
    ResponsiveContainer: Null,
  };
});

import { PlayerDetailPage } from './player.$athleteId';

const byMatch = (gameId: number, result: 'W' | 'L' | 'D' | null) => ({
  gameId, date: '2026-09-20T18:00:00Z', opponent: 'Nice', isHome: true, olScore: 2, opponentScore: 1,
  result, competitionCode: 'L1' as const, minutes: 90, goals: 0, assists: 0, shots: 0, shotsOnTarget: 0,
  yellowCards: 0, redCards: 0, rating: 7, isStarter: true,
});

const player: PlayerSeasonStats = {
  athleteId: 7, memberId: 7, name: 'Joueur Test', shortName: 'J. Test', jerseyNumber: 9,
  position: 'Attaquant', positionShort: 'ATT', imageVersion: null, matchesPlayed: 3, matchesStarted: 3,
  minutesPlayed: 270, goals: 0, assists: 0, goalContributions: 0, shots: 0, shotsOnTarget: 0,
  shotAccuracy: 0, yellowCards: 0, redCards: 0, averageRating: 7,
  byMatch: [byMatch(1, 'W'), byMatch(2, 'D'), byMatch(3, 'L')],
};

describe('<PlayerDetailPage /> — badges de résultat (L7/t5)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('W/D/L s’écrivent V/N/D avec Victoire / Match nul / Défaite en aria-label', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true, status: 200, json: async () => player })));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><PlayerDetailPage /></QueryClientProvider>);
    const table = await screen.findByRole('table');
    const rows = within(table).getAllByRole('row').slice(1); // ordre inversé : L, D, W
    const badge = (i: number) => {
      const el = within(rows[i]).getByRole('img', { name: /Victoire|Match nul|Défaite/ });
      return [el.textContent, el.getAttribute('aria-label')];
    };
    expect(badge(0)).toEqual(['D', 'Défaite']);
    expect(badge(1)).toEqual(['N', 'Match nul']);
    expect(badge(2)).toEqual(['V', 'Victoire']);
  });
});
