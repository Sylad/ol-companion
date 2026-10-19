/**
 * Zone cliquable des marqueurs de la carte Ligue 1 (L193).
 *
 * Le cercle d'un club ne fait que 14 px : le doigt et la souris le ratent, et au zoom d'ouverture les
 * clubs proches se recouvrent (PSG sous Paris FC, Monaco sous Nice, Lille sous Lens, Angers et Le Mans,
 * Auxerre et Troyes, Brest et Lorient). Chaque marqueur a donc une zone de 24 px (minimum WCAG 2.5.8), et les six couples trop proches à l'ouverture sont écartés
 * de quelques pixels (jamais de mètres : l'écart ne dépend pas du zoom).
 */

/** Côté de la zone cliquable, en pixels. */
export const HIT_SIZE_PX = 24;

/** Écart de chaque club d'un couple, dans le sens où il est déjà le plus loin de l'autre : 26 px d'écart au moins. Les décalages évitent les
 * quatre côtés du cadrage (L192) : pas de club à l'extrémité nord, ouest ou est déplacé vers l'extérieur. */
const SPREAD_PX = 13;

/** Décalage (dx, dy) en pixels d'écran, y vers le bas, par identifiant 365scores. */
const NUDGES_PX: Record<number, readonly [number, number]> = {
  480: [0, -SPREAD_PX], // PSG, au nord de Paris FC
  6075: [0, SPREAD_PX], // Paris FC
  471: [0, -SPREAD_PX], // Monaco, un cran au nord de Nice
  470: [0, SPREAD_PX], // OGC Nice
  478: [SPREAD_PX, 0], // Lille, au nord-est de Lens
  481: [-SPREAD_PX, 0], // Lens
  472: [0, SPREAD_PX], // Lorient, au sud-est de Brest (qui, à l'ouest, ne bouge pas)
  493: [0, SPREAD_PX], // Angers, au sud du Mans
  468: [0, -SPREAD_PX], // Le Mans
  476: [0, SPREAD_PX], // Auxerre, au sud de Troyes
  488: [0, -SPREAD_PX], // Troyes
};

export function markerNudge(id365: number): readonly [number, number] {
  return NUDGES_PX[id365] ?? [0, 0];
}
