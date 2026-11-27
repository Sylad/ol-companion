import L from 'leaflet';
import { LIGUE1_CLUBS_COORDS } from '@/lib/ligue1-clubs-coords';

/**
 * Zone cliquable des marqueurs de la carte Ligue 1 (L193, L272).
 *
 * Le cercle d'un club ne fait que 14 px : le doigt et la souris le ratent, et au zoom d'ouverture les
 * clubs proches se recouvrent (PSG sous Paris FC, Monaco sous Nice, Lille sous Lens, Angers et Le Mans,
 * Auxerre et Troyes, Brest et Lorient). Chaque marqueur a donc une zone de 24 px (minimum WCAG 2.5.8), et les clubs trop proches à l'ouverture sont écartés
 * de quelques pixels (jamais de mètres : l'écart ne dépend pas du zoom).
 */

/** Côté minimal de la zone cliquable, en pixels (WCAG 2.5.8) : la table des décalages le garantit à tout zoom. */
export const HIT_SIZE_PX = 24;

/** Côté visé de la zone cliquable (WCAG 2.5.5, 44 px), tenu dès que les voisins en laissent la place (L272). */
export const HIT_SIZE_MAX_PX = 44;

/** Diamètre dessiné d'un club (L272 : 14 px, trop petit, « je plissais les yeux »). Tient dans la zone minimale. */
export const CLUB_MARKER_PX = 22;

/** Diamètre dessiné de l'OL, sans son halo (L272 : 18 px avant). */
export const OL_MARKER_PX = 26;

/** Décalage (dx, dy) en pixels d'écran, y vers le bas, par identifiant 365scores. Table calculée pour que les zones de 24 px
 * restent disjointes dès le zoom d'ouverture à 320 px de large (zoom 4, le plus bas) jusqu'au zoom maximal : à ce zoom la
 * Normandie, la Bretagne, Paris et la Bourgogne se tassent (Le Havre/Le Mans, Lens/PSG, Paris FC/Auxerre, Rennes/Lorient).
 * L'OL (Lyon) ne bouge jamais : il reste sur son stade. */
const NUDGES_PX: Record<number, readonly [number, number]> = {
  480: [1, -7], // PSG
  6075: [0, 19], // Paris FC
  471: [3, -13], // Monaco, au nord de Nice
  470: [3, 13], // OGC Nice
  478: [17, -4], // Lille, au nord-est de Lens
  481: [-7, -8], // Lens
  472: [0, 16], // Lorient
  534: [-9, -1], // Brest
  493: [0, 14], // Angers
  468: [-4, -5], // Le Mans
  476: [13, 4], // Auxerre
  488: [7, -13], // Troyes
  485: [-6, -8], // Le Havre
  477: [-10, -3], // Rennes
  469: [-5, 0], // Olympique de Marseille
};

export function markerNudge(id365: number): readonly [number, number] {
  return NUDGES_PX[id365] ?? [0, 0];
}

/** Centre dessiné d'un club à l'écran (px du monde au zoom donné), décalage compris. */
export function markerCentre(club: (typeof LIGUE1_CLUBS_COORDS)[number], zoom: number): { x: number; y: number } {
  const p = L.CRS.EPSG3857.latLngToPoint(L.latLng(club.lat, club.lng), zoom);
  const [dx, dy] = markerNudge(club.id365);
  return { x: p.x + dx, y: p.y + dy };
}

/**
 * Côté de la zone cliquable de chaque club au zoom donné (L272), par identifiant 365scores : l'écart (plus grand des
 * deux axes) au voisin le plus proche, arrondi au pair inférieur, entre 24 et 44 px. Chaque zone est au plus égale à
 * l'écart à chaque voisin, donc deux zones voisines (demi-côtés additionnés) ne se recouvrent jamais. À l'ouverture,
 * Paris, Nice/Monaco ou Lens/Lille n'ont que 26 à 30 px entre eux : leur zone reste sous 44 px, sans quoi il faudrait
 * écarter les marqueurs de 50 à 115 px de leur stade ; elle grandit avec le zoom.
 */
export function hitSizesAtZoom(zoom: number): Map<number, number> {
  const centres = LIGUE1_CLUBS_COORDS.map((c) => ({ id: c.id365, ...markerCentre(c, zoom) }));
  const tailles = new Map<number, number>();
  for (const a of centres) {
    let ecart = Infinity;
    for (const b of centres) {
      if (a !== b) ecart = Math.min(ecart, Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)));
    }
    const pair = Math.floor(ecart / 2) * 2;
    tailles.set(a.id, Math.max(HIT_SIZE_PX, Math.min(HIT_SIZE_MAX_PX, pair)));
  }
  return tailles;
}
