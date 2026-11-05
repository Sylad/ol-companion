import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ShotMap } from '@/components/shot-map';
import type { LiveMatchShot } from '@/types/api';

// L248 — fiche page-match-fm R17 : les marqueurs gardent leur taille à l'écran quelle que soit la largeur du terrain.
const tir = (outcome: string, xg: number, side: number): LiveMatchShot =>
  ({ competitorId: 1, playerId: side, time: `${side}'`, outcome, xg, xgot: 0, side, line: 50, bodyPart: '' }) as unknown as LiveMatchShot;
const tirs = [tir('Manqué', 0, 80), tir('Manqué', 0.6, 85)];

function dessine(largeur: number) {
  vi.spyOn(SVGElement.prototype, 'getBoundingClientRect').mockReturnValue({ width: largeur } as DOMRect);
  render(<ShotMap shots={tirs} homeId={1} homeIsOl homeName="Lyon" awayName="Lens" homeSymbol="OL" awaySymbol="RCL" />);
  const echelle = largeur / 700;
  return Array.from(screen.getByRole('img', { name: 'Carte des tirs' }).querySelectorAll('circle[stroke-width]'))
    .filter((c) => c.getAttribute('fill') === 'none' && c.closest('g'))
    .map((c) => ({ rayon: Number(c.getAttribute('r')) * echelle, trait: Number(c.getAttribute('stroke-width')) * echelle }));
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('ShotMap — marqueurs de taille constante à l\'écran (L248)', () => {
  it.each([230, 316, 348])('R17 — à %i px de large, le plus petit tir manqué mesure au moins 4,9 px de diamètre et 1,5 px de trait', (largeur) => {
    const [petit] = dessine(largeur);
    expect(petit.rayon * 2).toBeGreaterThanOrEqual(4.9);
    expect(petit.trait).toBeGreaterThanOrEqual(1.5);
  });

  it('R17 — la taille à l\'écran ne dépend pas de la largeur du terrain et reste proportionnelle au xG', () => {
    const large = dessine(348);
    cleanup();
    const etroit = dessine(230);
    expect(etroit[0].rayon).toBeCloseTo(large[0].rayon, 5);
    expect(etroit[1].rayon).toBeCloseTo(large[1].rayon, 5);
    expect(etroit[0].trait).toBeCloseTo(large[0].trait, 5);
    expect(etroit[1].rayon).toBeGreaterThan(etroit[0].rayon);
  });
});
