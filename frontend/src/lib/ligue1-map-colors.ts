/**
 * Couleurs et motifs des marqueurs et de la légende de la Carte L1 (L191).
 * La couleur ne porte jamais seule le résultat : chaque moitié a aussi un motif
 * (WCAG 1.4.1). WCAG 1.4.11 (L275) : chaque teinte pleine (V, N, D) lit ≥ 3:1 sur le fond sombre de la carte
 * ET sur les tuiles OpenStreetMap claires (terre, mer, forêt, prairie : `OSM_TILE_FILLS`) ; le contour double
 * (anneau sombre dehors, anneau clair dedans) détache le marqueur des deux fonds. Avant L275, les teintes n'étaient
 * calibrées que pour le fond sombre : le gris du nul faisait 2,25 à 2,38:1 sur les tuiles, le contour blanc 1,3 à 2,4:1.
 */
export type MapResult = 'W' | 'D' | 'L' | 'FUTURE';

export const OL_RED = 'hsl(0, 73%, 50%)';
/** Bleu OL éclairci : le bleu `--ol-blue` (33 % de clarté) ne faisait que 1,83:1 sur le fond. */
export const WIN_BLUE = 'hsl(226, 56%, 51%)';
/** Gris du nul : 41 % (55 % avant L275, 2,09:1 sur la mer d'OSM) ; 3,33:1 sur le fond sombre, 3,26:1 sur la forêt. */
export const RESULT_GRAY = 'hsl(0, 0%, 41%)';
/** Rouge de la défaite, un peu plus sombre que `OL_RED` (2,87:1 sur la forêt d'OSM) : 3,29:1 sur la forêt, 3,30:1 sur le fond sombre. */
export const LOSS_RED = 'hsl(0, 73%, 46%)';
export const RESULT_DARK = 'hsl(0, 0%, 18%)';
/** Anneau clair du contour (dedans) : détache le marqueur du fond sombre (la teinte « pas joué » n'existe que par lui). */
export const RESULT_OUTLINE = 'hsl(0, 0%, 92%)';
/** Anneau sombre du contour (dehors, L275) : détache le marqueur des tuiles claires, où l'anneau clair ne fait que 1,0 à 1,4:1. */
export const RESULT_OUTLINE_DARK = 'hsl(0, 0%, 10%)';

/** Fond de la carte sans tuile (`MapContainer`), et donc de toute zone où la tuile n'est pas encore là. */
export const MAP_DARK_BACKGROUND = '#0e1420';

/**
 * Aplats clairs des tuiles OpenStreetMap (style osm-carto) sur lesquels un marqueur peut se poser : les plus clairs
 * et les plus sombres des grandes surfaces, mer et forêt étant les pires cas pour une teinte moyenne.
 */
export const OSM_TILE_FILLS = {
  terre: '#f2efe9',
  mer: '#aad3df',
  foret: '#add19e',
  prairie: '#cdebb0',
  habitat: '#e0dfdf',
} as const;

export const RESULT_COLORS: Record<MapResult, string> = {
  W: WIN_BLUE,
  D: RESULT_GRAY,
  L: LOSS_RED,
  FUTURE: RESULT_DARK,
};

/**
 * Couleur de la lettre des pastilles de la fiche (9 px, WCAG 1.4.3 : ≥ 4,5:1) : blanc partout.
 * Le gris du nul à 55 % prenait du noir (le blanc n'y faisait que 3,35:1) ; à 41 % (L275), le noir n'y ferait plus
 * que 3,80:1 et le blanc y fait 5,53:1.
 */
export const RESULT_CHIP_TEXT: Record<MapResult, string> = {
  W: 'hsl(0, 0%, 100%)',
  D: 'hsl(0, 0%, 100%)',
  L: 'hsl(0, 0%, 100%)',
  FUTURE: 'hsl(0, 0%, 100%)',
};

/**
 * Motif blanc d'une moitié, en repère 28×28, centré sur (cx, 14) :
 * victoire = aucun (aplat), nul = barre horizontale, défaite = barre oblique,
 * pas joué = point. Raccourcis de 8 à 6 unités en L275 : ils tiennent dans la moitié
 * colorée, en dedans de l'anneau clair (rayon intérieur 10,3), pour cx = 9 et 19.
 */
export function resultGlyph(result: MapResult, cx: number): string {
  const stroke = 'stroke="#fff" stroke-width="3" stroke-linecap="round"';
  if (result === 'D') return `<line x1="${cx - 3}" y1="14" x2="${cx + 3}" y2="14" ${stroke} />`;
  if (result === 'L') return `<line x1="${cx - 3}" y1="17.5" x2="${cx + 3}" y2="10.5" ${stroke} />`;
  if (result === 'FUTURE') return `<circle cx="${cx}" cy="14" r="2" fill="#fff" />`;
  return '';
}
