import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// L241 — l'info-bulle (i) dit ce que montre la courbe : la place à la fin de chaque
// journée, recalculée depuis les résultats, pas la place en cours de journée.

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
    data: [{ matchday: 7, position: 1, points: 14 }],
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));

import { PositionTracker } from './position-tracker';

describe('PositionTracker — info-bulle (L241)', () => {
  it("dit que la place est celle de la fin de chaque journée, recalculée depuis les résultats, et que l'OL peut avoir été plus haut entre deux matchs", () => {
    render(<PositionTracker />);
    const bulle = screen.getByRole('tooltip', { hidden: true }).textContent ?? '';
    expect(bulle).toMatch(/fin de chaque journée/);
    expect(bulle).toMatch(/résultats/);
    expect(bulle).toMatch(/entre deux matchs/i);
  });
});
