import { describe, expect, it } from 'vitest';
import { decalageDansTerrain } from './formation-field';

// L76 — le nom d'un joueur excentré est recalé dans le terrain ; la géométrie réelle est mesurée dans Chromium
// (tests-navigateur/composition-noms-bord.test.ts), ici la règle de calcul.
describe('decalageDansTerrain (L76)', () => {
  it('R1 — un nom centré qui dépasse à gauche est poussé vers la droite, juste de ce qui dépasse plus la marge', () => {
    expect(decalageDansTerrain(4, 60, 300)).toBe(2 - (12 - 30)); // gauche = 12 - 30 = -18 → +20
  });
  it('R1 — un nom qui dépasse à droite est tiré vers la gauche', () => {
    expect(decalageDansTerrain(96, 60, 300)).toBe(-20);
  });
  it('R2 — un nom qui tient, ou au centre, n\'est pas déplacé', () => {
    expect(decalageDansTerrain(50, 60, 300)).toBe(0);
    expect(decalageDansTerrain(20, 60, 300)).toBe(0);
  });
  it('R3 — un nom plus large que le terrain n\'est pas déplacé (rien à gagner)', () => {
    expect(decalageDansTerrain(4, 320, 300)).toBe(0);
  });
});
