// L261 — calcul du quinconce de la composition (la géométrie réelle se mesure dans Chromium :
// tests-navigateur/plancher-12px-L261.test.ts).
import { describe, expect, it } from 'vitest';
import { largeurQuinconce, morceaux, rangeeDecalee } from './lineup-card';

describe('L261 — quinconce de la composition', () => {
  it('morceaux : coupure à l’espace et après le tiret, jamais ailleurs', () => {
    expect(morceaux('Z. Athekame')).toEqual(['Z.', 'Athekame']);
    expect(morceaux('Maitland-Niles')).toEqual(['Maitland-', 'Niles']);
    expect(morceaux('Çalhanoğlu')).toEqual(['Çalhanoğlu']);
  });

  // Rangée de 244 px (colonne de 280 px à 1440), 5 pastilles au plus, 6 px de padding et bordure.
  it('aucun quinconce quand le morceau le plus large tient dans une pastille ordinaire', () => {
    expect(largeurQuinconce(244, 5, 6, 39)).toBeNull(); // pastille ordinaire : (244 − 16) / 5 = 45,6 px, 39,6 utiles
  });

  it('sinon, la largeur juste nécessaire, bornée par celle qui fait tenir la rangée la plus fournie en quinconce', () => {
    expect(largeurQuinconce(244, 5, 6, 66)).toBe(73); // ceil(66 + 6 + 1)
    const plafond = (2 * (244 - 20)) / 6 + 4; // 78,7 px
    expect(largeurQuinconce(244, 5, 6, 120)).toBeCloseTo(plafond, 5);
  });

  it('une rangée se décale seulement si elle ne tient pas sur une ligne', () => {
    const q = { largeur: 73, rangee: 244 };
    expect(rangeeDecalee(3, q)).toBe(false); // 3 × 73 + 8 = 227
    expect(rangeeDecalee(4, q)).toBe(true); // 4 × 73 + 12 = 304
  });

  it('au plafond, la rangée la plus fournie tient en quinconce dans la largeur du terrain', () => {
    for (const n of [3, 4, 5, 6]) {
      const largeur = largeurQuinconce(250, n, 6, 500)!;
      const colonne = (largeur - 4) / 2;
      expect((n + 1) * colonne + n * 4, `n = ${n}`).toBeLessThanOrEqual(250 + 1e-9);
    }
  });
});
