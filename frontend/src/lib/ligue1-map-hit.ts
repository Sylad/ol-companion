/**
 * Zone cliquable des marqueurs de la carte Ligue 1 (L193).
 *
 * Le cercle d'un club ne fait que 14 px : le doigt et la souris le ratent, et au zoom d'ouverture les
 * clubs proches se recouvrent (PSG sous Paris FC, Monaco sous Nice, Lille sous Lens, Angers et Le Mans,
 * Auxerre et Troyes, Brest et Lorient). Chaque marqueur a donc une zone de 24 px (minimum WCAG 2.5.8), et les clubs trop proches à l'ouverture sont écartés
 * de quelques pixels (jamais de mètres : l'écart ne dépend pas du zoom).
 */

/** Côté de la zone cliquable, en pixels. */
export const HIT_SIZE_PX = 24;

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
