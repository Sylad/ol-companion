/**
 * Couleur par équipe sur la page d'un match (L160 R5, L167 R4). La couleur suit l'équipe suivie,
 * pas le côté : « suivie » = l'OL sur un match de l'OL (rouge, adversaire bleu), la France sur un match
 * des Bleus (bleu, adversaire blanc ; le rouge reste l'accent de la page, jamais une équipe).
 * Les valeurs des Bleus sont écrites en entier : 4,04:1 (bleu) et 17,15:1 (blanc) sur --surface.
 */
export type MatchPalette = 'ol' | 'bleus';

export interface TeamColors {
  /** Remplissage SVG / fond d'une pastille. */
  fill: string;
  /** Classe Tailwind du même fond (puces de légende, barres). */
  bg: string;
  /** Texte qui porte l'équipe (≥ 4,5:1 sur --surface). */
  text: string;
}

const OL: TeamColors = { fill: 'hsl(var(--ol-red))', bg: 'bg-ol-red', text: 'text-ol-red-bright' };
const OL_OPPONENT: TeamColors = { fill: 'hsl(var(--ol-blue-bright))', bg: 'bg-ol-blue-bright', text: 'text-[hsl(226_70%_70%)]' };
const FRANCE: TeamColors = { fill: 'hsl(224 80% 58%)', bg: 'bg-[hsl(224_80%_58%)]', text: 'text-[hsl(224_90%_75%)]' };
const FRANCE_OPPONENT: TeamColors = { fill: 'hsl(0 0% 96%)', bg: 'bg-[hsl(0_0%_96%)]', text: 'text-[hsl(0_0%_96%)]' };

/** Couleurs de l'équipe suivie (`tracked`) ou de son adversaire. */
export function teamColors(palette: MatchPalette, tracked: boolean): TeamColors {
  if (palette === 'bleus') return tracked ? FRANCE : FRANCE_OPPONENT;
  return tracked ? OL : OL_OPPONENT;
}

/** Identifiant 365scores de la France (CLAUDE.md : équipe de France A). */
export const FRANCE_365SCORES_ID = 5061;

/** Vrai quand le domicile ou l'extérieur du matchupId (« domicile-extérieur-id ») vaut exactement 5061 (L167 R3). */
export function isFranceMatchup(matchupId: string | undefined): boolean {
  const [home, away] = (matchupId ?? '').split('-');
  return home === String(FRANCE_365SCORES_ID) || away === String(FRANCE_365SCORES_ID);
}
