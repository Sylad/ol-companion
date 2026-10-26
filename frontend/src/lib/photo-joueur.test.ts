import { describe, expect, it } from 'vitest';
import { photoJoueurUrl } from './photo-joueur';

// L223 — 365scores met imageVersion à 1 pour un athlète sans image : l'URL répond alors 404 (mesure du 26-10 sur 9 athlètes
// en version 1, tous en 404 ; les versions ≥ 2 répondent 200). On ne demande pas la photo dans ce cas.

describe('photoJoueurUrl (L223)', () => {
  it('R1 — imageVersion 1 : pas d’URL (initiales), la photo n’est pas demandée', () => {
    expect(photoJoueurUrl(266757, 1, 180)).toBeNull();
  });

  it.each([[0], [null], [undefined]])('R2 — imageVersion %s : pas d’URL', (v) => {
    expect(photoJoueurUrl(266757, v, 180)).toBeNull();
  });

  it('R3 — athlète absent : pas d’URL', () => {
    expect(photoJoueurUrl(0, 7, 180)).toBeNull();
  });

  it('R4 — version ≥ 2 : URL du CDN 365scores à la taille demandée', () => {
    expect(photoJoueurUrl(2185, 52, 320)).toBe(
      'https://imagecache.365scores.com/image/upload/f_png,w_320,h_320,c_limit,r_max,q_auto:eco/v52/Athletes/2185',
    );
    expect(photoJoueurUrl(2185, 2, 180)).toContain('/v2/Athletes/2185');
  });
});
