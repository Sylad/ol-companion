import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Ligue1Map } from './ligue1-map';
import { MODES_PANNES, aucuneErreurAnnoncee, erreurAnnoncee } from '@/test/pannes';

// L194 — la carte distingue le chargement et l'erreur de l'API d'« aucun match » : sans donnée,
// ni carte ni légende (ses marqueurs « Pas encore joué » seraient faux) ; en erreur, « Réessayer ».

const etat = vi.hoisted(() => ({
  value: { data: undefined as unknown, isLoading: false, isError: false, refetch: vi.fn() },
}));
vi.mock('@/hooks/use-season-matches', () => ({ useSeasonMatches: () => etat.value }));
vi.mock('@/hooks/use-standings', () => ({ useStandings: () => ({ data: undefined }) }));

describe.each(MODES_PANNES)('<Ligue1Map /> — chargement et erreur (L194, $mode)', ({ fournisseur, wrapper }) => {
  beforeEach(() => {
    etat.value = { data: undefined, isLoading: false, isError: false, refetch: vi.fn() };
  });

  it('R1 — pendant le chargement : un role=status, ni carte ni légende « Pas encore joué »', () => {
    etat.value.isLoading = true;
    const { container } = render(<Ligue1Map />);
    expect(screen.getByRole('status').textContent).toContain('Chargement de la carte');
    expect(container.querySelector('.leaflet-container')).toBeNull();
    expect(document.body.textContent).not.toContain('Pas encore joué');
  });

  it('R2 — en erreur sans donnée : un message annoncé, « Réessayer » qui relance, ni carte ni légende', async () => {
    etat.value.isError = true;
    const { container } = render(<Ligue1Map />, { wrapper });
    const message = await erreurAnnoncee(fournisseur, 'Impossible de charger les résultats de la saison.');
    expect(message.textContent).toBe('Impossible de charger les résultats de la saison.');
    expect(container.querySelector('.leaflet-container')).toBeNull();
    expect(document.body.textContent).not.toContain('Pas encore joué');
    expect(document.body.textContent).not.toContain('Pas de match OL recensé');
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(etat.value.refetch).toHaveBeenCalledTimes(1);
  });

  it('R3 — un échec de rafraîchissement ne retire pas la carte déjà chargée', async () => {
    etat.value.isError = true;
    etat.value.data = [];
    const { container } = render(<Ligue1Map />, { wrapper });
    expect(container.querySelector('.leaflet-container')).not.toBeNull();
    await aucuneErreurAnnoncee(fournisseur);
  });

  it('R4 — une saison vraiment vide (liste vide chargée) affiche la carte et sa légende', () => {
    etat.value.data = [];
    const { container } = render(<Ligue1Map />);
    expect(container.querySelector('.leaflet-container')).not.toBeNull();
    expect(screen.getByLabelText('Légende des marqueurs')).toBeTruthy();
  });
});
