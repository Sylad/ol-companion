import { describe, expect, it } from 'vitest';
import { plafondNom } from './formation-field';

// L258 : noms du terrain à 12 px (plancher de l'échelle) : à 320 px quatre joueurs d'une ligne ont 67 px chacun,
// « Niakhaté » et « Tagliafico » en mesurent 68 et 72. Partage équitable de la place entre voisins, écart de 4 px.
describe('plafondNom (L258)', () => {
  it('aucun plafond quand les deux noms tiennent', () => {
    expect(plafondNom(30, 40, [{ x: 70, nom: 40 }], 300)).toBeNull(); // 120 px entre les centres
  });

  it('deux noms longs : chacun la moitié de la place, moins l’écart', () => {
    // centres à 67 px : place 63 ; chacun 31,5 de demi-largeur → 63 px
    expect(plafondNom(36, 68, [{ x: 64, nom: 72 }], 238)).toBeCloseTo(2 * ((0.28 * 238 - 4) / 2));
  });

  it('un voisin court laisse sa place au nom long', () => {
    // place 63 ; voisin de 30 px garde 15, le nom long a 48 de demi-largeur → 96
    const p = plafondNom(36, 100, [{ x: 64, nom: 30 }], 238);
    expect(p).toBeCloseTo(2 * (0.28 * 238 - 4 - 15));
  });

  it('les deux voisins comptent : le plus proche décide', () => {
    const p = plafondNom(50, 90, [{ x: 20, nom: 90 }, { x: 70, nom: 90 }], 300)!;
    expect(p).toBeCloseTo(2 * ((0.2 * 300 - 4) / 2));
  });

  it('seuls les voisins immédiats comptent', () => {
    // le voisin à 90 % est derrière celui à 70 % (80 px de centre à centre : 60 + 60 tiennent)
    expect(plafondNom(50, 60, [{ x: 70, nom: 60 }, { x: 90, nom: 400 }], 400)).toBeNull();
  });

  it('jamais négatif', () => {
    expect(plafondNom(50, 60, [{ x: 51, nom: 60 }], 300)).toBe(0);
  });
});
