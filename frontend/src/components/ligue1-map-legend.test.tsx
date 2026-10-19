import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MapLegend } from './ligue1-map';

// L81 puis L195 — la légende « Aller / Retour » ne se pose sur la carte à aucune largeur : au téléphone (L81) elle
// masquait l'en-tête des bulles, à partir de sm (L195) elle cachait le × de la fiche de six clubs à 768 px et de
// Strasbourg à 1440 px (WCAG 2.4.11). Sous la carte, dans le flux.

describe('<MapLegend />', () => {
  it('dans le flux à toute largeur : jamais en absolute, ni avec un préfixe de largeur', () => {
    render(<MapLegend />);
    const classes = screen.getByLabelText('Légende des marqueurs').className.split(/\s+/);
    for (const c of classes) {
      expect(c).not.toMatch(/(^|:)(absolute|fixed|sticky)$/);
      expect(c).not.toMatch(/(^|:)z-\[/);
    }
  });
});
