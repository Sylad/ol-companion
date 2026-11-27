import { OL_RED, RESULT_COLORS, RESULT_OUTLINE, resultGlyph } from '@/lib/ligue1-map-colors';
import { CLUB_MARKER_PX, OL_MARKER_PX } from '@/lib/ligue1-map-hit';
import type { OLMatchResult } from '@/lib/ligue1-club-match';

/** Dessin des marqueurs de la carte Ligue 1, partagé par la carte et sa légende (L272 : la légende suit le rendu). */

/** Pastille de l'OL, rouge plein cerclé de blanc avec halo : marqueur et légende. */
export function olMarkerHtml(size = OL_MARKER_PX): string {
  const halo = '0 0 0 3px hsla(0, 90%, 60%, 0.35), 0 0 12px hsla(0, 90%, 55%, 0.55)';
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
  const stroke = RESULT_OUTLINE;
  const cA = colorForResult(legA);
  const cB = colorForResult(legB);
  // viewBox 28x28, radius 13, center (14,14) — sweep flag 0 (left arc) / 1 (right arc).
  return `<svg viewBox="0 0 28 28" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style="display:block;flex-shrink:0;filter:drop-shadow(0 0 2px rgba(0,0,0,0.45));">`
    + `<path d="M 14 1 A 13 13 0 0 0 14 27 Z" fill="${cA}" />`
    + `<path d="M 14 1 A 13 13 0 0 1 14 27 Z" fill="${cB}" />`
    + resultGlyph(legA ?? 'FUTURE', 7.5)
    + resultGlyph(legB ?? 'FUTURE', 20.5)
    + `<line x1="14" y1="1" x2="14" y2="27" stroke="${stroke}" stroke-width="0.8" />`
    + `<circle cx="14" cy="14" r="13" fill="none" stroke="${stroke}" stroke-width="1.4" />`
    + `</svg>`;
}
