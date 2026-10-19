import { describe, expect, it } from 'vitest';
import L from 'leaflet';
import { LIGUE1_CLUBS_COORDS } from '@/lib/ligue1-clubs-coords';
import { HIT_SIZE_PX, markerNudge } from '@/lib/ligue1-map-hit';
import { MAX_ZOOM } from '@/lib/ligue1-map-view';

// L193 — la zone cliquable de 24 px d'un club ne recouvre jamais celle d'un voisin, à aucun zoom de la carte.

/** Zoom d'ouverture de la carte à 320 px de large (260 px de carte), mesuré dans Chromium : le plus bas qu'un visiteur du /map voie (390 px : 4,75). */
const ZOOM_OUVERTURE_320 = 4;

/** Centre du marqueur à l'écran (px) à un zoom donné, décalage de désencombrement compris. */
function centre(club: (typeof LIGUE1_CLUBS_COORDS)[number], zoom: number) {
  const p = L.CRS.EPSG3857.latLngToPoint(L.latLng(club.lat, club.lng), zoom);
  const [dx, dy] = markerNudge(club.id365);
  return { x: p.x + dx, y: p.y + dy };
}

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
