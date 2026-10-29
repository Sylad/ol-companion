import { describe, expect, it } from 'vitest';
import { decalageDansTerrain, placerJoueurDeBord } from './formation-field';

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
  it('R4 — un élément qui dépasse à droite du bloc (pastille de note) compte dans ce qui doit rester dans le terrain', () => {
    // bloc 60 px à 96 % de 300 px : droite = 288 + 30 = 318 ; avec 6 px de pastille, 324 → recalage de 324 - 298 = 26
    expect(decalageDansTerrain(96, 60, 300, 6)).toBe(-26);
    expect(decalageDansTerrain(50, 60, 300, 6)).toBe(0);
  });
});

describe('placerJoueurDeBord (L76)', () => {
  const base = { largeurTerrain: 300, rond: 36, debord: 0, voisinGauche: null, voisinDroite: null };
  it('R5 — sans voisin gênant, le décalage est celui du recalage et le nom n\'est pas tronqué', () => {
    expect(placerJoueurDeBord({ ...base, x: 96, nom: 60, voisinGauche: 100 })).toEqual({ decalage: -20, nomMax: null });
    expect(placerJoueurDeBord({ ...base, x: 50, nom: 60 })).toEqual({ decalage: 0, nomMax: null });
  });
  it('R5 — un voisin à gauche trop proche : le nom du joueur de bord droit est tronqué, 4 px d\'écart gardés', () => {
    // nom 60 px recalé à droite : bord gauche 238 ; voisin finissant à 200 → 38 px d'écart voulus 4 : tient (pas de troncature)
    expect(placerJoueurDeBord({ ...base, x: 96, nom: 60, voisinGauche: 200 }).nomMax).toBeNull();
    // voisin finissant à 250 : il ne reste que 300 - 2 - 250 - 4 = 44 px
    const r = placerJoueurDeBord({ ...base, x: 96, nom: 60, voisinGauche: 250 });
    expect(r.nomMax).toBe(44);
    expect(288 + r.decalage + 44 / 2).toBe(298); // bord droit du nom collé à la marge du terrain
  });
  it('R5 — de même à gauche : voisin à droite trop proche', () => {
    const r = placerJoueurDeBord({ ...base, x: 4, nom: 60, voisinDroite: 50 });
    expect(r.nomMax).toBe(44);
    expect(12 + r.decalage - 44 / 2).toBe(2);
  });
  it('R5 — place plus étroite que le rond mais lisible : le rond reste dans le terrain, le nom (centré sous lui) garde 4 px avec le voisin', () => {
    // voisin finissant à 256, rond de 44 px : place = 300 - 2 - 256 - 4 = 38 < 44
    const r = placerJoueurDeBord({ ...base, rond: 44, x: 96, nom: 60, voisinGauche: 256 });
    const centre = 288 + r.decalage;
    expect(centre + 22).toBe(298); // rond collé à la marge
    expect(r.nomMax).toBe(2 * (276 - 256 - 4));
    expect(centre - r.nomMax! / 2).toBeGreaterThanOrEqual(256 + 4);
  });
  it('R5 — de même à gauche : le nom garde 4 px avec le voisin de droite', () => {
    // place = 46 - 4 - 2 = 40 < 44
    const r = placerJoueurDeBord({ ...base, rond: 44, x: 4, nom: 60, voisinDroite: 46 });
    const centre = 12 + r.decalage;
    expect(centre - 22).toBe(2);
    expect(centre + r.nomMax! / 2).toBeLessThanOrEqual(46 - 4);
  });
  it('R5 — place trop étroite pour se lire (< 24 px) : nom masqué (nomMax 0), jamais un plancher qui recouvre le voisin', () => {
    expect(placerJoueurDeBord({ ...base, x: 96, nom: 60, voisinGauche: 270 }).nomMax).toBe(0);
    expect(placerJoueurDeBord({ ...base, x: 96, nom: 60, voisinGauche: 290 }).nomMax).toBe(0);
  });
});
