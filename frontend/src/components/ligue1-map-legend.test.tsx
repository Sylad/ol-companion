import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MapLegend } from './ligue1-map';
import { clubMarkerSvg, olMarkerHtml } from '@/lib/ligue1-map-marker';
import { CLUB_MARKER_PX, OL_MARKER_PX } from '@/lib/ligue1-map-hit';

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

  // L272 — règle des cartes : la légende suit le rendu. Chaque pastille est le dessin même d'un marqueur, à sa taille.
  it('chaque pastille est dessinée par la fonction du marqueur, à la taille du marqueur (L272)', () => {
    render(<MapLegend />);
    const legende = screen.getByLabelText('Légende des marqueurs');
    const pastilles = [...legende.querySelectorAll('[aria-hidden]')].filter((e) => e.tagName === 'SPAN');
    const attendu = [
      ['Victoire OL', clubMarkerSvg('W', 'W')],
      ['Match nul', clubMarkerSvg('D', 'D')],
      ['Défaite OL', clubMarkerSvg('L', 'L')],
      ['Pas encore joué', clubMarkerSvg('FUTURE', 'FUTURE')],
      ['Lyon (OL)', olMarkerHtml()],
    ];
    expect(pastilles).toHaveLength(attendu.length);
    attendu.forEach(([libelle, html], i) => {
      const modele = document.createElement('span');
      modele.innerHTML = html;
      expect(pastilles[i].innerHTML, libelle).toBe(modele.innerHTML);
      expect(pastilles[i].nextElementSibling?.textContent).toBe(libelle);
    });
    expect(pastilles.slice(0, 4).map((p) => p.querySelector('svg')!.getAttribute('width'))).toEqual(Array(4).fill(String(CLUB_MARKER_PX)));
    expect((pastilles[4].firstElementChild as HTMLElement).style.width).toBe(`${OL_MARKER_PX}px`);
  });
});
