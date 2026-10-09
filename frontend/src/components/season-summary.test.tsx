import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { TeamSeasonStats } from '@/types/api';
vi.mock('recharts', () => {
  const Null = () => null;
  return { Area: Null, AreaChart: Null, CartesianGrid: Null, ResponsiveContainer: Null, Tooltip: Null, XAxis: Null, YAxis: Null };
});

import { SeasonSummary } from './season-summary';

// L49 — le bilan de saison nomme chaque compétition en long, via le glossaire.

const comp = (competitionCode: 'L1' | 'UCL' | 'UEL' | 'CDF') => ({
  competitionCode, played: 3, won: 2, draw: 1, lost: 0, goalsFor: 5, goalsAgainst: 2, cleanSheets: 1, points: 7,
});

const stats: TeamSeasonStats = {
  played: 12, won: 8, draw: 2, lost: 2, goalsFor: 20, goalsAgainst: 9, goalDifference: 11,
  goalsForPerMatch: 1.67, goalsAgainstPerMatch: 0.75, cleanSheets: 5, cleanSheetRate: 42, winRate: 67,
  perCompetition: [comp('L1'), comp('UCL'), comp('UEL'), comp('CDF')],
  chart: [],
};

describe('<SeasonSummary /> — noms de compétitions (L49)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('écrit Ligue des champions et Ligue Europa en long, jamais C1 / C3', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true, status: 200, json: async () => stats })));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <SeasonSummary />
      </QueryClientProvider>,
    );
    for (const name of ['Ligue 1', 'Ligue des champions', 'Ligue Europa', 'Coupe de France']) {
      expect(await screen.findByText(name)).toBeInTheDocument();
    }
    expect(screen.queryByText(/^(C1|C3|CdF)$/)).not.toBeInTheDocument();
  });

  // L83 — « 0D » à 12 px en --loss = 3,85:1 (WCAG 1.4.3 : 4,5) ; --ol-red-bright = 4,95:1.
  it('écrit les défaites des pastilles en --ol-red-bright, jamais en --loss', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true, status: 200, json: async () => stats })));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <SeasonSummary />
      </QueryClientProvider>,
    );
    const defeats = await screen.findAllByText('0D');
    expect(defeats).toHaveLength(4);
    for (const el of defeats) {
      expect(el).toHaveClass('text-ol-red-bright');
      expect(el).not.toHaveClass('text-loss');
    }
  });
});
