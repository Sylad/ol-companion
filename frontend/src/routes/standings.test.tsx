import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// L146 — WCAG 2.5.3 (Label in Name) : le bouton montre « Actualiser » (≥ sm) ; son nom
// accessible l'était « Rafraîchir », sans rapport avec le texte visible. Il doit contenir
// le texte visible et dire ce qu'il actualise.

vi.mock('@/hooks/use-standings', () => ({
  useStandings: () => ({
    data: undefined, isLoading: false, isError: false, isFetching: false, refetch: vi.fn(),
  }),
}));
vi.mock('@/components/knowledge-header', () => ({ KnowledgeHeader: () => null }));
vi.mock('@/components/position-tracker', () => ({ PositionTracker: () => null }));
vi.mock('@/components/standings-table', () => ({ StandingsTable: () => null }));

import { StandingsPage } from './standings';

describe('StandingsPage — bouton Actualiser (L146)', () => {
  it('son nom accessible est « Actualiser le classement », qui contient le texte visible', () => {
    render(<StandingsPage />);
    const bouton = screen.getByRole('button', { name: 'Actualiser le classement' });
    expect(bouton.textContent).toContain('Actualiser');
    expect(screen.queryByRole('button', { name: 'Rafraîchir' })).toBeNull();
  });
});
