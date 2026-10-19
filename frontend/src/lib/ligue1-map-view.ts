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

interface Frame {
  /** Les 18 marqueurs tels que dessinés au zoom du cadrage. */
  bounds: L.LatLngBounds;
  /** Zoom du cadrage : le zoom minimal de la carte. */
  zoom: number;
  /** Limite du glisser : la vue d'ouverture, une borne par axe. */
  maxBounds: L.LatLngBounds;
}

/** Jeu d'un pixel autour de la vue d'ouverture : sans lui, l'arrondi du flottant décalerait le cadrage d'un pixel. */
const MAX_BOUNDS_SLACK_PX = 1;

/**
 * Cadrage de la France pour la taille actuelle de la carte. Le glisser ne sort pas de la vue d'ouverture : à ce zoom
 * la carte ne bouge pas, plus près elle se déplace mais jamais au-delà de cette vue (Recentrer y ramène). Ce n'est
 * pas une garantie d'avoir des clubs à l'écran : les coins de la vue d'ouverture sont la mer. Une marge symétrique autour des clubs (la France + 1,5 de chaque
 * côté) laissait la vue partir en Pologne sur un téléphone, où le cadrage est limité par la largeur et la vue est haute.
 * La marge de 36 px du cadrage, comptée au zoom d'ouverture, vaut plus au-dessus : un club du bord se découvre entier.
 */
function measureFrame(map: L.Map): Frame {
  const padding = L.point(FRAME_PADDING_PX, FRAME_PADDING_PX);
  // getBoundsZoom ne descend pas sous le zoom minimal posé : on le lève pour mesurer le cadrage.
  map.setMinZoom(0);
  // Zoom du cadrage calculé, pas lu avec getZoom() : pendant un fitBounds animé il rend encore l'ancien zoom.
  // Les marqueurs écartés (L193) élargissent l'étendue d'un zoom à l'autre : on la recalcule au zoom trouvé, deux fois.
  let bounds = clubsBounds();
  let zoom = Math.min(map.getBoundsZoom(bounds, false, padding.multiplyBy(2)), MAX_ZOOM);
  for (let i = 0; i < 2; i++) {
    bounds = drawnBounds(zoom);
    zoom = Math.min(map.getBoundsZoom(bounds, false, padding.multiplyBy(2)), MAX_ZOOM);
  }
  // fitBounds centre sur le milieu projeté (Mercator) des marqueurs ; la vue d'ouverture est ce centre ± la demi-carte.
  const crs = map.options.crs ?? L.CRS.EPSG3857;
  const centre = crs.latLngToPoint(bounds.getSouthWest(), zoom).add(crs.latLngToPoint(bounds.getNorthEast(), zoom)).divideBy(2);
  const half = map.getSize().divideBy(2).add([MAX_BOUNDS_SLACK_PX, MAX_BOUNDS_SLACK_PX]);
  const maxBounds = L.latLngBounds(crs.pointToLatLng(centre.subtract(half), zoom), crs.pointToLatLng(centre.add(half), zoom));
  return { bounds, zoom, maxBounds };
}

/** Limite du glisser de chaque carte, et si elle est levée (fiche ouverte, L195). */
const limits = new WeakMap<L.Map, { maxBounds: L.LatLngBounds; lifted: boolean }>();

function applyMaxBounds(map: L.Map, maxBounds: L.LatLngBounds): void {
  const state = limits.get(map);
  const lifted = state?.lifted ?? false;
  limits.set(map, { maxBounds, lifted });
  // Rien à refaire quand la limite est déjà posée : setMaxBounds recale la vue, ce qui gênerait un cadrage animé.
  if (!lifted && !(state && state.maxBounds.equals(maxBounds, 1e-9))) {
    map.setMaxBounds(maxBounds);
  }
}

/** Lève la limite du glisser le temps d'une fiche (les clubs du nord n'ont pas la place d'une fiche dans la vue d'ouverture). */
export function liftMaxBounds(map: L.Map): void {
  const state = limits.get(map);
  if (state) state.lifted = true;
  map.setMaxBounds(L.latLngBounds([]));
}

/** Remet la limite du glisser levée par `liftMaxBounds`. */
export function restoreMaxBounds(map: L.Map): void {
  const state = limits.get(map);
  if (!state) return;
  state.lifted = false;
  map.setMaxBounds(state.maxBounds);
}

/**
 * Cadre la France (marqueurs écartés compris) et en fait le zoom minimal et la limite du glisser. Le zoom minimal
 * est celui du cadrage calculé, aussi depuis un zoom avant (Recentrer).
 */
export function frameFrance(map: L.Map, animate = false): void {
  const frame = measureFrame(map);
  applyMaxBounds(map, frame.maxBounds);
  // fitBounds centre sur le milieu projeté (Mercator), pas sur la moyenne des latitudes.
  map.fitBounds(frame.bounds, { padding: [FRAME_PADDING_PX, FRAME_PADDING_PX], animate });
  // Posé après le cadrage : le poser avant ferait un zoom animé qui, en finissant, défait le cadrage.
  map.setMinZoom(frame.zoom);
}

/**
 * La carte change de format (rotation du téléphone, fenêtre redimensionnée) : au zoom minimal elle reprend son cadrage ;
 * plus près elle garde le zoom et le déplacement de l'utilisateur, seuls le zoom minimal et la limite du glisser suivent.
 */
export function followResize(map: L.Map): void {
  const wasAtMinimum = map.getZoom() <= map.getMinZoom() + 1e-6;
  const frame = measureFrame(map);
  if (wasAtMinimum || map.getZoom() <= frame.zoom + 1e-6) {
    frameFrance(map);
    return;
  }
  applyMaxBounds(map, frame.maxBounds);
  map.setMinZoom(frame.zoom);
}
