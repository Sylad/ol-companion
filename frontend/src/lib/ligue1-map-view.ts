import L from 'leaflet';
import { LIGUE1_CLUBS_COORDS } from '@/lib/ligue1-clubs-coords';
import { markerNudge } from '@/lib/ligue1-map-hit';

/**
 * Cadrage de la carte Ligue 1 (L192) : la carte s'ouvre sur la France, les 18 clubs dans la
 * vue ; le zoom arrière s'arrête à ce cadrage et le glisser ne sort pas de la France.
 */

/** Marge intérieure du cadrage en pixels : le marqueur de l'OL (18 px + halo) reste entier. */
export const FRAME_PADDING_PX = 36;

/** Le zoom d'ouverture n'est plus un entier : la France occupe la carte au lieu d'un cadre vide. */
export const ZOOM_SNAP = 0.25;

/** Zoom avant maximal : au-delà, les tuiles OpenStreetMap n'apportent rien aux marqueurs de 14 px. */
export const MAX_ZOOM = 14;

/**
 * Le glisser s'arrête à la France entourée d'une France et demie de chaque côté. Assez large pour que
 * la vue d'un téléphone en portrait, au zoom minimal, tienne dedans : sinon Leaflet la recentre sur le
 * milieu des latitudes du plafond et décale le cadrage.
 */
const MAX_BOUNDS_PAD = 1.5;

export function clubsBounds(): L.LatLngBounds {
  return L.latLngBounds(LIGUE1_CLUBS_COORDS.map((c) => [c.lat, c.lng] as [number, number]));
}

/**
 * Les 18 marqueurs tels que dessinés au zoom donné : les clubs écartés par `markerNudge` (L193) sont
 * déplacés de quelques pixels, qui valent plus ou moins de degrés selon le zoom.
 */
export function drawnBounds(zoom: number): L.LatLngBounds {
  return L.latLngBounds(
    LIGUE1_CLUBS_COORDS.map((c) => {
      const [dx, dy] = markerNudge(c.id365);
      const p = L.CRS.EPSG3857.latLngToPoint(L.latLng(c.lat, c.lng), zoom);
      return L.CRS.EPSG3857.pointToLatLng(L.point(p.x + dx, p.y + dy), zoom);
    }),
  );
}

export function maxBounds(): L.LatLngBounds {
  return clubsBounds().pad(MAX_BOUNDS_PAD);
}

/**
 * Cadre la France (marqueurs écartés compris) et en fait le zoom minimal. À rappeler quand la carte change de format
 * (rotation du téléphone, fenêtre redimensionnée) : le cadrage suit, le zoom arrière aussi.
 */
export function frameFrance(map: L.Map, animate = false): void {
  const padding = L.point(FRAME_PADDING_PX, FRAME_PADDING_PX);
  // getBoundsZoom ne descend pas sous le zoom minimal posé : on le lève pour mesurer le cadrage.
  map.setMinZoom(0);
  // Zoom du cadrage calculé, pas lu avec getZoom() : pendant un fitBounds animé il rend encore l'ancien zoom.
  // Les marqueurs écartés (L193) élargissent l'étendue d'un zoom à l'autre : on la recalcule au zoom trouvé, deux fois.
  let bounds = clubsBounds();
  let framedZoom = Math.min(map.getBoundsZoom(bounds, false, padding.multiplyBy(2)), MAX_ZOOM);
  for (let i = 0; i < 2; i++) {
    bounds = drawnBounds(framedZoom);
    framedZoom = Math.min(map.getBoundsZoom(bounds, false, padding.multiplyBy(2)), MAX_ZOOM);
  }
  // fitBounds centre sur le milieu projeté (Mercator), pas sur la moyenne des latitudes.
  map.fitBounds(bounds, { padding: [FRAME_PADDING_PX, FRAME_PADDING_PX], animate });
  // Posé après le cadrage : le poser avant ferait un zoom animé qui, en finissant, défait le cadrage.
  map.setMinZoom(framedZoom);
}
