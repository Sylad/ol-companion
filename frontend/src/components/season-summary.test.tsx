import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { TeamSeasonStats } from '@/types/api';
vi.mock('recharts', () => {
  const Null = () => null;
  return { Area: Null, AreaChart: Null, CartesianGrid: Null, ResponsiveContainer: Null, Tooltip: Null, XAxis: Null, YAxis: Null };
});

import { ChartTooltip, SeasonSummary } from './season-summary';

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

  // L102 — le nul a une seule couleur (--draw, comme au calendrier), pas le gris des textes secondaires.
  it('écrit les nuls des pastilles en --draw, comme le calendrier', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true, status: 200, json: async () => stats })));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <SeasonSummary />
      </QueryClientProvider>,
    );
    const draws = await screen.findAllByText('1N');
    expect(draws).toHaveLength(4);
    for (const el of draws) {
      expect(el).toHaveClass('text-draw');
      expect(el).not.toHaveClass('text-fg-muted');
    }
  });

  // L102 — idem dans l'infobulle du graphique : « Match nul » en --draw, jamais en gris.
  it("écrit « Match nul » de l'infobulle en --draw", () => {
    const point = { matchIndex: 3, date: '2026-09-20', goalDifference: 2, points: 7, competitionCode: 'L1', result: 'D' };
    render(<ChartTooltip active payload={[{ payload: point }] as never} />);
    const label = screen.getByText('Match nul');
    expect(label).toHaveClass('text-draw');
    expect(label).not.toHaveClass('text-fg-dim');
  });
});
