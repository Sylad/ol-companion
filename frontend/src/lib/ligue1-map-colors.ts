/**
 * Couleurs et motifs des marqueurs et de la légende de la Carte L1 (L191).
 * La couleur ne porte jamais seule le résultat : chaque moitié a aussi un motif
 * (WCAG 1.4.1) et chaque teinte lit ≥ 3:1 sur le fond sombre (WCAG 1.4.11).
 */
export type MapResult = 'W' | 'D' | 'L' | 'FUTURE';

export const OL_RED = 'hsl(0, 73%, 50%)';
/** Bleu OL éclairci : le bleu `--ol-blue` (33 % de clarté) ne faisait que 1,83:1 sur le fond. */
export const WIN_BLUE = 'hsl(226, 56%, 51%)';
export const RESULT_GRAY = 'hsl(0, 0%, 55%)';
export const RESULT_DARK = 'hsl(0, 0%, 18%)';
/** Contour des pastilles et des marqueurs (la teinte sombre « pas joué » n'existe que par lui). */
export const RESULT_OUTLINE = 'hsl(0, 0%, 92%)';

export const RESULT_COLORS: Record<MapResult, string> = {
  W: WIN_BLUE,
  D: RESULT_GRAY,
  L: OL_RED,
  FUTURE: RESULT_DARK,
};

/**
 * Couleur de la lettre des pastilles de la fiche (9 px, WCAG 1.4.3 : ≥ 4,5:1) :
 * le blanc ne faisait que 3,35:1 sur le gris du nul, qui prend du noir (6,27:1).
 */
export const RESULT_CHIP_TEXT: Record<MapResult, string> = {
  W: 'hsl(0, 0%, 100%)',
  D: 'hsl(0, 0%, 0%)',
  L: 'hsl(0, 0%, 100%)',
  FUTURE: 'hsl(0, 0%, 100%)',
};

/**
 * Motif blanc d'une moitié, en repère 28×28, centré sur (cx, 14) :
 * victoire = aucun (aplat), nul = barre horizontale, défaite = barre oblique,
 * pas joué = point.
 */
export function resultGlyph(result: MapResult, cx: number): string {
  const stroke = 'stroke="#fff" stroke-width="3" stroke-linecap="round"';
  if (result === 'D') return `<line x1="${cx - 4}" y1="14" x2="${cx + 4}" y2="14" ${stroke} />`;
  if (result === 'L') return `<line x1="${cx - 4}" y1="19" x2="${cx + 4}" y2="9" ${stroke} />`;
  if (result === 'FUTURE') return `<circle cx="${cx}" cy="14" r="2" fill="#fff" />`;
  return '';
}
