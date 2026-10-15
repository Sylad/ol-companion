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

/**
 * Répartit des blocs (hauteurs mesurées, dans l'ordre de lecture) sur trois colonnes
 * de même largeur pour que leurs bas se rejoignent. Essaie toutes les répartitions
 * (3^n, n ≤ 8) ; à écart égal (à 8 px près) garde la plus proche de `fallback`.
 * Hauteurs inconnues (0) : `fallback` inchangé.
 */
export function balanceColumns(heights: number[], fallback: number[], gap: number): number[] {
  const n = heights.length;
  if (n === 0 || heights.some((h) => !(h > 0))) return fallback;
  let best = fallback;
  let bestScore = spread(heights, fallback, gap);
  const cur = new Array<number>(n).fill(0);
  const total = COLUMNS ** n;
  for (let k = 0; k < total; k++) {
    let x = k;
    for (let i = 0; i < n; i++) {
      cur[i] = x % COLUMNS;
      x = Math.floor(x / COLUMNS);
    }
    const s = spread(heights, cur, gap);
    if (s < bestScore - 8) {
      bestScore = s;
      best = cur.slice();
    }
  }
  return best;
}
