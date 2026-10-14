import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';

// L152 — WCAG 1.1.1 / 2.1.1 : le graphique a une alternative texte (tableau lisible),
// l'info-bulle « i » est un bouton focusable, nommé.

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

describe('PositionTracker — accessibilité (L152)', () => {
  it('le graphique est caché aux lecteurs d\'écran et remplacé par un tableau journée / place / points', () => {
    render(<PositionTracker />);
    expect(screen.getByTestId('graphique').closest('[aria-hidden="true"]')).not.toBeNull();
    const table = screen.getByRole('table', { name: /évolution.*classement/i });
    const lignes = within(table).getAllByRole('row');
    expect(lignes).toHaveLength(3);
    expect(lignes[1].textContent).toMatch(/1.*5.*3/);
    expect(lignes[2].textContent).toMatch(/2.*1.*6/);
  });

  it('L156 : la table est dans un div.sr-only (une table sr-only seule garde sa largeur de contenu et fait défiler la page)', () => {
    render(<PositionTracker />);
    const table = screen.getByRole('table', { name: /évolution.*classement/i });
    expect(table.className).not.toMatch(/sr-only/);
    expect(table.parentElement?.tagName).toBe('DIV');
    expect(table.parentElement?.className).toMatch(/\bsr-only\b/);
  });

  it('un résumé texte dit la place actuelle', () => {
    render(<PositionTracker />);
    expect(screen.getByTestId('resume-position-tracker').textContent).toMatch(/1er.*6 pts/);
  });

  it('l\'info-bulle « i » est un bouton focusable avec un nom accessible', () => {
    render(<PositionTracker />);
    const bouton = screen.getByRole('button', { name: /position de l'OL au fil des journées/i });
    expect(bouton.tabIndex).toBeGreaterThanOrEqual(0);
  });
});
