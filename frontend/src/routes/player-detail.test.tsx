import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { PlayerSeasonStats } from '@/types/api';

// L49 — la page joueur nomme les compétitions avec le glossaire commun : sigles
// dans le tableau (nom long lisible), légende visible sous le tableau.

vi.mock('@tanstack/react-router', () => ({
  useParams: () => ({ athleteId: '7' }),
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

const byMatch = (gameId: number, competitionCode: 'L1' | 'UCL' | 'UEL' | 'CDF') => ({
  gameId, date: '2026-09-20T18:00:00Z', opponent: 'Nice', isHome: true, olScore: 2, opponentScore: 1,
  result: 'W' as const, competitionCode, minutes: 90, goals: 1, assists: 0, shots: 2, shotsOnTarget: 1,
  yellowCards: 0, redCards: 0, rating: 7, isStarter: true,
});

const player: PlayerSeasonStats = {
  athleteId: 7, memberId: 7, name: 'Joueur Test', shortName: 'J. Test', jerseyNumber: 9,
  position: 'Attaquant', positionShort: 'ATT', imageVersion: null, matchesPlayed: 4, matchesStarted: 4,
  minutesPlayed: 360, goals: 4, assists: 0, goalContributions: 4, shots: 8, shotsOnTarget: 4,
  shotAccuracy: 50, yellowCards: 0, redCards: 0, averageRating: 7,
  byMatch: [byMatch(1, 'L1'), byMatch(2, 'UCL'), byMatch(3, 'UEL'), byMatch(4, 'CDF')],
};

describe('<PlayerDetailPage /> — noms de compétitions (L49)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('tableau : sigle du glossaire avec le nom long lisible ; légende visible sous le tableau', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true, status: 200, json: async () => player })));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <PlayerDetailPage />
      </QueryClientProvider>,
    );
    const table = await screen.findByRole('table');
    const rows = within(table).getAllByRole('row').slice(1);
    // Ordre inversé : CdF, C3, C1, L1 ; nom long annoncé, sigle affiché.
    expect(rows.map((r) => within(r).getAllByRole('cell')[3].textContent)).toEqual([
      'CdFCoupe de France', 'C3Ligue Europa', 'C1Ligue des champions', 'L1Ligue 1',
    ]);
    const legend = screen.getByText(/^Comp\. :/);
    expect(legend).toHaveTextContent(
      'Comp. : L1 = Ligue 1 · C1 = Ligue des champions · C3 = Ligue Europa · CdF = Coupe de France',
    );
    expect(legend).not.toHaveClass('sr-only');
  });
});
