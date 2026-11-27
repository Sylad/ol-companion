import { describe, expect, it } from 'vitest';
import { LIGUE1_CLUBS_COORDS } from '@/lib/ligue1-clubs-coords';
import { CLUB_MARKER_PX, HIT_SIZE_MAX_PX, HIT_SIZE_PX, OL_MARKER_PX, hitSizesAtZoom, markerCentre, markerNudge } from '@/lib/ligue1-map-hit';
import { MAX_ZOOM } from '@/lib/ligue1-map-view';

// L193 — la zone cliquable de 24 px d'un club ne recouvre jamais celle d'un voisin, à aucun zoom de la carte.

/** Zoom d'ouverture de la carte à 320 px de large (260 px de carte), mesuré dans Chromium : le plus bas qu'un visiteur du /map voie (390 px : 4,75). */
const ZOOM_OUVERTURE_320 = 4;

const centre = markerCentre;

describe('markerNudge (L193)', () => {
  it('R2 — deux zones cliquables de 24 px ne se recouvrent du zoom d’ouverture à 320 px de large (4) au zoom maximal (Paris, Nice/Monaco, Lens/Lille, Le Havre/Le Mans, Rennes/Lorient, Auxerre/Troyes, Brest…)', () => {
    for (let zoom = ZOOM_OUVERTURE_320; zoom <= MAX_ZOOM; zoom += 0.25) {
      const centres = LIGUE1_CLUBS_COORDS.map((c) => ({ nom: c.name, ...centre(c, zoom) }));
      for (let i = 0; i < centres.length; i++) {
        for (let j = i + 1; j < centres.length; j++) {
          const ecart = Math.max(Math.abs(centres[i].x - centres[j].x), Math.abs(centres[i].y - centres[j].y));
          expect(ecart, `${centres[i].nom} / ${centres[j].nom} au zoom ${zoom}`).toBeGreaterThanOrEqual(HIT_SIZE_PX);
        }
      }
    }
  });

  it('R3 — un club isolé n’est pas décalé : le marqueur reste sur son stade', () => {
    const lyon = LIGUE1_CLUBS_COORDS.find((c) => c.name === 'Lyon')!;
    expect(markerNudge(lyon.id365)).toEqual([0, 0]);
  });
});

// L272 (D-2) — ronds plus gros (22 px, OL 26 px) et zone cliquable de 24 à 44 px selon la place, à chaque zoom.
describe('hitSizesAtZoom (L272)', () => {
  const zooms: number[] = [];
  for (let z = ZOOM_OUVERTURE_320; z <= MAX_ZOOM; z += 0.25) zooms.push(z);
  const rayon = (id: number) => (id === 465 ? OL_MARKER_PX : CLUB_MARKER_PX) / 2;

  it('les ronds dessinés ne se recouvrent à aucun zoom, de 320 px de large au zoom maximal (Paris, Nice/Monaco, Lens/Lille…)', () => {
    for (const zoom of zooms) {
      const c = LIGUE1_CLUBS_COORDS.map((club) => ({ nom: club.name, id: club.id365, ...centre(club, zoom) }));
      for (let i = 0; i < c.length; i++) {
        for (let j = i + 1; j < c.length; j++) {
          expect(Math.hypot(c[i].x - c[j].x, c[i].y - c[j].y), `${c[i].nom} / ${c[j].nom} au zoom ${zoom}`).toBeGreaterThanOrEqual(rayon(c[i].id) + rayon(c[j].id));
        }
      }
    }
  });

  it('chaque zone fait 24 à 44 px, contient son rond, et deux zones voisines ne se recouvrent jamais', () => {
    for (const zoom of zooms) {
      const tailles = hitSizesAtZoom(zoom);
      const c = LIGUE1_CLUBS_COORDS.map((club) => ({ nom: club.name, id: club.id365, cote: tailles.get(club.id365)!, ...centre(club, zoom) }));
      for (const a of c) {
        expect(a.cote, `${a.nom} au zoom ${zoom}`).toBeGreaterThanOrEqual(Math.max(HIT_SIZE_PX, 2 * rayon(a.id)));
        expect(a.cote).toBeLessThanOrEqual(HIT_SIZE_MAX_PX);
        expect(a.cote % 2).toBe(0);
      }
      for (let i = 0; i < c.length; i++) {
        for (let j = i + 1; j < c.length; j++) {
          const ecart = Math.max(Math.abs(c[i].x - c[j].x), Math.abs(c[i].y - c[j].y));
          expect(ecart, `${c[i].nom} / ${c[j].nom} au zoom ${zoom}`).toBeGreaterThanOrEqual((c[i].cote + c[j].cote) / 2);
        }
      }
    }
  });

  it('44 px pour les clubs isolés dès l’ouverture à 1440 px (zoom 6), et pour tous à partir du zoom 10', () => {
    const ouverture = hitSizesAtZoom(6);
    for (const nom of ['Lyon', 'Toulouse', 'Strasbourg', 'Brest', 'Olympique de Marseille']) {
      expect(ouverture.get(LIGUE1_CLUBS_COORDS.find((c) => c.name === nom)!.id365), nom).toBe(HIT_SIZE_MAX_PX);
    }
    expect([...hitSizesAtZoom(10).values()].every((t) => t === HIT_SIZE_MAX_PX)).toBe(true);
  });
});
