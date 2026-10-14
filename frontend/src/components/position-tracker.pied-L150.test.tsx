import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// L150 — le pied « Journée x → y / Actuellement » ne doit pas vivre dans le bloc h-[280px]
// (le graphique seul a cette hauteur fixe) : il y était tronqué de 7 px par overflow-hidden.

vi.mock('recharts', () => {
  const Vide = () => null;
  return {
    LineChart: Vide, Line: Vide, XAxis: Vide, YAxis: Vide, CartesianGrid: Vide, Tooltip: Vide,
    ReferenceDot: Vide,
    ResponsiveContainer: () => <div data-testid="graphique" />,
  };
});
vi.mock('@/hooks/use-season-rankings', () => ({
  useSeasonRankings: () => ({
    data: [
      { matchday: 1, position: 5, points: 3 },
      { matchday: 2, position: 1, points: 6 },
    ],
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));

import { PositionTracker } from './position-tracker';

describe('PositionTracker — pied (L150)', () => {
  it('le pied n\'est pas descendant du bloc à hauteur fixe du graphique', () => {
    render(<PositionTracker />);
    const pied = screen.getByText(/Actuellement/);
    expect(pied.closest('[class*="h-[280px]"]')).toBeNull();
    const bloc = screen.getByTestId('graphique').closest('[class*="h-[280px]"]');
    expect(bloc).not.toBeNull();
    expect(bloc!.contains(pied)).toBe(false);
  });
});
