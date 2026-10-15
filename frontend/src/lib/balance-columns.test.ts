import { describe, expect, it } from 'vitest';
import { balanceColumns, spread } from './balance-columns';

describe('balanceColumns (L159)', () => {
  it('garde la répartition par défaut tant que les hauteurs sont inconnues', () => {
    expect(balanceColumns([0, 0, 0], [0, 1, 2], 16)).toEqual([0, 1, 2]);
  });

  it('déplace les blocs pour rapprocher les bas de colonnes (cas mesuré Paris FC–Lyon)', () => {
    // gauche 700, centre 600 + 350, droite 580 + 372 + 216 : la droite dépasse de ~420 px
    const heights = [300, 400, 600, 350, 580, 372, 216];
    const def = [0, 0, 1, 1, 2, 2, 2];
    const res = balanceColumns(heights, def, 16);
    expect(spread(heights, res, 16)).toBeLessThan(150);
    expect(spread(heights, res, 16)).toBeLessThan(spread(heights, def, 16));
  });

  it('ne sépare pas un bloc : chaque bloc reçoit une colonne valide', () => {
    const res = balanceColumns([100, 200, 300], [0, 1, 2], 16);
    expect(res).toHaveLength(3);
    for (const c of res) expect([0, 1, 2]).toContain(c);
  });

  it('ne range jamais tout dans une seule colonne (colonne vide = bas à 0)', () => {
    const heights = [300, 400, 600, 350, 580, 372, 216, 100];
    const res = balanceColumns(heights, [0, 0, 1, 1, 2, 2, 2, 0], 16);
    expect(new Set(res).size).toBe(3);
  });

  it('garde la disposition par défaut quand elle tient déjà la cible (même place d\'un match à l\'autre)', () => {
    // Lyon – Crystal Palace mesuré : défaut à 109 px d'écart (< 150), rien ne doit bouger
    const heights = [789, 257, 192, 344, 420, 565, 372];
    const def = [0, 0, 1, 1, 1, 2, 2];
    expect(spread(heights, def, 16)).toBeLessThan(150);
    expect(balanceColumns(heights, def, 16)).toEqual(def);
  });

  it('au-delà de la cible, déplace le moins de blocs possible parmi les solutions < 150 px', () => {
    const heights = [300, 400, 600, 350, 580, 372, 216];
    const def = [0, 0, 1, 1, 2, 2, 2];
    const res = balanceColumns(heights, def, 16);
    const moves = res.filter((c, i) => c !== def[i]).length;
    expect(spread(heights, res, 16)).toBeLessThan(150);
    // aucune solution < 150 px avec moins de déplacements
    let fewer = false;
    for (let k = 0; k < 3 ** 7; k++) {
      const a = Array.from({ length: 7 }, (_, i) => Math.floor(k / 3 ** i) % 3);
      if (spread(heights, a, 16) < 150 && a.filter((c, i) => c !== def[i]).length < moves) fewer = true;
    }
    expect(fewer).toBe(false);
  });
});
