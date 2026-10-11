import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DashboardStats } from './dashboard-stats';

const standings = vi.hoisted(() => ({ value: { data: undefined, isError: false, refetch: () => {} } as any }));
vi.mock('@/hooks/use-standings', () => ({ useStandings: () => standings.value }));
vi.mock('@/hooks/use-season-rankings', () => ({
  useSeasonRankings: () => ({
    data: [
      { matchday: 1, position: 3 },
      { matchday: 2, position: 5 },
    ],
  }),
}));

describe('DashboardStats', () => {
  it('R1 — chargement : pas de flèche de tendance sans l’OL, même si les rankings sont là', () => {
    standings.value = { data: undefined, isError: false, refetch: () => {} };
    render(<DashboardStats />);
    expect(screen.getByTestId('stat-position').textContent).not.toMatch(/[↑↓]/);
  });

  it('R6 — vide : pas de flèche de tendance quand le classement ne contient pas l’OL', () => {
    standings.value = { data: { table: [], currentMatchday: 7 }, isError: false, refetch: () => {} };
    render(<DashboardStats />);
    expect(screen.getByTestId('stat-position').textContent).not.toMatch(/[↑↓]/);
  });
});
