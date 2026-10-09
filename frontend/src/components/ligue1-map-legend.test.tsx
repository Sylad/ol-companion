import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MapLegend } from './ligue1-map';

// L81 — à 390 px la légende « Aller / Retour » ne se pose plus sur la carte
// (elle masquait l'en-tête des bulles) : sous la carte, dans le flux. Elle ne
// flotte au-dessus de la carte qu'à partir de sm.

describe('<MapLegend />', () => {
  it('au téléphone : dans le flux, jamais en absolute sans préfixe de largeur', () => {
    render(<MapLegend />);
    const classes = screen.getByLabelText('Légende des marqueurs').className.split(/\s+/);
    expect(classes).not.toContain('absolute');
    expect(classes).not.toContain('z-[500]');
    expect(classes).toContain('sm:absolute');
    expect(classes).toContain('sm:z-[500]');
  });
});
