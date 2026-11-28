import { OL_RED, RESULT_COLORS, RESULT_OUTLINE, RESULT_OUTLINE_DARK, resultGlyph } from '@/lib/ligue1-map-colors';
import { CLUB_MARKER_PX, OL_MARKER_PX } from '@/lib/ligue1-map-hit';
import type { OLMatchResult } from '@/lib/ligue1-club-match';

/** Dessin des marqueurs de la carte Ligue 1, partagé par la carte et sa légende (L272 : la légende suit le rendu). */

/**
 * Pastille de l'OL, rouge plein cerclé de blanc puis d'un anneau sombre (L275 : le blanc seul se perdait sur les
 * tuiles claires), avec une lueur rouge : marqueur et légende. Seul l'anneau sombre est plein (2 px) : l'anneau rosé de
 * 3 px posé dessous en L275 portait le halo plein à 5 px hors de la pastille, sur la rangée voisine de la légende
 * (4 px d'écart à 390) ; mesure `tests-navigateur/legende-halo-ol-L275.test.ts`.
 */
export function olMarkerHtml(size = OL_MARKER_PX): string {
  const halo = `0 0 0 2px ${RESULT_OUTLINE_DARK}, 0 0 12px hsla(0, 90%, 55%, 0.55)`;
  return `<span style="display:inline-block;flex-shrink:0;width:${size}px;height:${size}px;border-radius:9999px;background:${OL_RED};border:2px solid #fff;box-shadow:${halo};"></span>`;
}

/** Couleur d'un résultat ; « pas encore joué » ou aucun match recensé → sombre. */
export function colorForResult(result: OLMatchResult | null): string {
  return RESULT_COLORS[result ?? 'FUTURE'];
}

/**
 * Bicolor SVG marker for non-OL clubs (marqueur et légende, L272).
 * Left half  = leg A (first chronological OL vs club fixture this season)
 * Right half = leg B (second fixture)
 * Color encodes result vs OL (blue=W, red=L, gray=D, dark=FUTURE/missing) and so does a
 * white pattern per half (none=W, bar=D, slash=L, dot=FUTURE) — see ligue1-map-colors.
 */
export function clubMarkerSvg(legA: OLMatchResult | null, legB: OLMatchResult | null, size = CLUB_MARKER_PX): string {
  const clair = RESULT_OUTLINE;
  const sombre = RESULT_OUTLINE_DARK;
  const cA = colorForResult(legA);
  const cB = colorForResult(legB);
  // viewBox 28x28, centre (14,14) — sweep flag 0 (left arc) / 1 (right arc). Moitiés de rayon 11,5 ; contour double
  // (L275) : anneau sombre de 12,1 à 14 (≥ 3:1 sur les tuiles claires), anneau clair de 10,3 à 12,2 (≥ 3:1 sur le
  // fond sombre). À 22 px, 1 unité = 0,79 px : 1,5 px de chaque anneau, assez pour qu'un pixel entier tombe dedans.
  return `<svg viewBox="0 0 28 28" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style="display:block;flex-shrink:0;filter:drop-shadow(0 0 2px rgba(0,0,0,0.45));">`
    + `<circle cx="14" cy="14" r="13.05" fill="none" stroke="${sombre}" stroke-width="1.9" />`
    + `<path d="M 14 2.5 A 11.5 11.5 0 0 0 14 25.5 Z" fill="${cA}" />`
    + `<path d="M 14 2.5 A 11.5 11.5 0 0 1 14 25.5 Z" fill="${cB}" />`
    + resultGlyph(legA ?? 'FUTURE', 9)
    + resultGlyph(legB ?? 'FUTURE', 19)
    + `<line x1="14" y1="2.5" x2="14" y2="25.5" stroke="${clair}" stroke-width="0.8" />`
    + `<circle cx="14" cy="14" r="11.25" fill="none" stroke="${clair}" stroke-width="1.9" />`
    + `</svg>`;
}
