import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
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

// L73 — docs/qa/expectations.md (section `/`) nomme les tuiles telles que l'écran les écrit.
describe('DashboardStats — L73', () => {
  it('R2 — l’attente QA de / cite le libellé « Différence buts » de la tuile, pas « Différence de buts »', () => {
    standings.value = { data: { table: [], currentMatchday: 7 }, isError: false, refetch: () => {} };
    render(<DashboardStats />);
    const libelle = screen.getByTestId('stat-diff').textContent ?? '';
    expect(libelle.toLowerCase()).toContain('différence buts');
    const attentes = readFileSync(resolve(__dirname, '../../../docs/qa/expectations.md'), 'utf8');
    const ligneTuiles = attentes.split('\n').find((l) => l.includes('les tuiles Position')) ?? '';
    expect(ligneTuiles).toContain('Différence buts');
    expect(ligneTuiles).not.toContain('Différence de buts');
  });
});
