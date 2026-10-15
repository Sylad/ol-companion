const COLUMNS = 3;

function bottoms(heights: number[], assignment: number[], gap: number): number[] {
  const total = new Array<number>(COLUMNS).fill(0);
  const count = new Array<number>(COLUMNS).fill(0);
  heights.forEach((h, i) => {
    total[assignment[i]] += h;
    count[assignment[i]] += 1;
  });
  return total.map((t, c) => t + Math.max(0, count[c] - 1) * gap);
}

/** Écart entre la colonne la plus haute et la plus basse. */
export function spread(heights: number[], assignment: number[], gap: number): number {
  const b = bottoms(heights, assignment, gap);
  return Math.max(...b) - Math.min(...b);
}

/** Écart de bas de colonnes visé par le lot L159. */
export const TARGET_SPREAD = 150;

/**
 * Répartit des blocs (hauteurs mesurées, dans l'ordre de lecture) sur trois colonnes
 * de même largeur pour que leurs bas se rejoignent. Si `fallback` tient déjà la cible
 * (< 150 px), il est gardé tel quel : un bloc reste au même endroit d'un match à l'autre.
 * Sinon, parmi les répartitions sous la cible (3^n, n ≤ 8), celle qui déplace le moins de
 * blocs, à écart égal la plus serrée ; aucune sous la cible : l'écart minimal.
 * Hauteurs inconnues (0) : `fallback` inchangé.
 */
export function balanceColumns(heights: number[], fallback: number[], gap: number): number[] {
  const n = heights.length;
  if (n === 0 || heights.some((h) => !(h > 0))) return fallback;
  const base = spread(heights, fallback, gap);
  if (base < TARGET_SPREAD) return fallback;
  let best = fallback;
  let bestOk = false;
  let bestMoves = 0;
  let bestSpread = base;
  const cur = new Array<number>(n).fill(0);
  const total = COLUMNS ** n;
  for (let k = 0; k < total; k++) {
    let x = k;
    let moves = 0;
    for (let i = 0; i < n; i++) {
      cur[i] = x % COLUMNS;
      x = Math.floor(x / COLUMNS);
      if (cur[i] !== fallback[i]) moves++;
    }
    const s = spread(heights, cur, gap);
    const ok = s < TARGET_SPREAD;
    const better = ok
      ? !bestOk || moves < bestMoves || (moves === bestMoves && s < bestSpread)
      : !bestOk && s < bestSpread;
    if (better) {
      best = cur.slice();
      bestOk = ok;
      bestMoves = moves;
      bestSpread = s;
    }
  }
  return best;
}
