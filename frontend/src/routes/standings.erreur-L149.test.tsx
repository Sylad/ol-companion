import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MODES_PANNES, aucuneErreurAnnoncee, erreurAnnoncee } from '@/test/pannes';

// L149 — l'erreur du classement : message en français sans jargon de source, « Réessayer »
// (RetryMessage : role=alert bloc seul, région annoncée dans l'app, L260/t2) ; le chargement annonce son état (role=status).

const etat = vi.hoisted(() => ({
  value: { data: undefined as unknown, isLoading: false, isError: false, isFetching: false, refetch: vi.fn() },
}));
vi.mock('@/hooks/use-standings', () => ({ useStandings: () => etat.value }));
vi.mock('@/components/knowledge-header', () => ({ KnowledgeHeader: () => null }));
vi.mock('@/components/position-tracker', () => ({ PositionTracker: () => null }));
vi.mock('@/components/standings-table', () => ({ StandingsTable: () => <div data-testid="table" /> }));

import { StandingsPage } from './standings';

describe.each(MODES_PANNES)('StandingsPage — erreur et chargement (L149, $mode)', ({ fournisseur, wrapper }) => {
  beforeEach(() => {
    etat.value = { data: undefined, isLoading: false, isError: false, isFetching: false, refetch: vi.fn() };
  });

  it('sans donnée, l\'erreur est annoncée avec « Réessayer » qui relance le chargement', async () => {
    etat.value.isError = true;
    render(<StandingsPage />, { wrapper });
    const alerte = await erreurAnnoncee(fournisseur, 'Impossible de charger le classement.');
    expect(alerte.textContent).toBe('Impossible de charger le classement.');
    expect(document.body.textContent).not.toContain('365scores');
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(etat.value.refetch).toHaveBeenCalledTimes(1);
  });

  it('le chargement est annoncé par un role=status', () => {
    etat.value.isLoading = true;
    render(<StandingsPage />);
    expect(screen.getByRole('status').textContent).toContain('Chargement du classement');
  });

  it('avec des données déjà là, un échec de rafraîchissement n\'efface pas le tableau', async () => {
    etat.value.isError = true;
    etat.value.data = { table: [{ position: 1 }] };
    render(<StandingsPage />, { wrapper });
    expect(screen.getByTestId('table')).toBeTruthy();
    await aucuneErreurAnnoncee(fournisseur);
  });
});
