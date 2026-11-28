import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MapLegend } from './ligue1-map';
import { clubMarkerSvg, olMarkerHtml } from '@/lib/ligue1-map-marker';
import { CLUB_MARKER_PX, OL_MARKER_PX } from '@/lib/ligue1-map-hit';
import { OL_RED, RESULT_COLORS, RESULT_OUTLINE, RESULT_OUTLINE_DARK, resultGlyph } from '@/lib/ligue1-map-colors';

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

  // L275 — règle des cartes : la légende correspond au rendu. Comparée ici à la SOURCE des couleurs des marqueurs
  // (constantes de ligue1-map-colors), pas à la fonction qui la dessine : un changement de couleur ou de motif qui
  // n'irait qu'à la carte (ou qu'à la légende) échoue.
  it('chaque pastille porte la couleur, le motif et le contour double de la source des marqueurs (L275)', () => {
    render(<MapLegend />);
    const legende = screen.getByLabelText('Légende des marqueurs');
    const attendu = [
      ['Victoire OL', 'W'],
      ['Match nul', 'D'],
      ['Défaite OL', 'L'],
      ['Pas encore joué', 'FUTURE'],
    ] as const;
    const libelles = [...legende.querySelectorAll('span.text-petite')].map((e) => e.textContent);
    for (const [libelle, resultat] of attendu) {
      const svg = legende.querySelectorAll('svg')[libelles.indexOf(libelle)]!;
      expect(svg, libelle).toBeTruthy();
      const moities = [...svg.querySelectorAll('path')].map((p) => p.getAttribute('fill'));
      expect(moities, libelle).toEqual([RESULT_COLORS[resultat], RESULT_COLORS[resultat]]);
      const anneaux = [...svg.querySelectorAll('circle[fill="none"]')].map((c) => c.getAttribute('stroke'));
      expect(anneaux, libelle).toEqual([RESULT_OUTLINE_DARK, RESULT_OUTLINE]);
      const motif = document.createElement('div');
      motif.innerHTML = `<svg>${resultGlyph(resultat, 9)}${resultGlyph(resultat, 19)}</svg>`;
      const motifs = [...svg.children].filter((e) => e.getAttribute('stroke') === '#fff' || e.getAttribute('fill') === '#fff');
      expect(motifs.map((e) => e.outerHTML).join(''), libelle).toBe(motif.firstElementChild!.innerHTML);
    }
    const ol = legende.querySelectorAll('span[aria-hidden]')[4].firstElementChild as HTMLElement;
    expect(libelles[4]).toBe('Lyon (OL)');
    const ref = document.createElement('span');
    ref.style.background = OL_RED;
    ref.style.boxShadow = `0 0 0 2px ${RESULT_OUTLINE_DARK}`;
    expect(ol.style.background).toBe(ref.style.background);
    expect(ol.style.boxShadow.startsWith(ref.style.boxShadow), ol.style.boxShadow).toBe(true);
  });
});
