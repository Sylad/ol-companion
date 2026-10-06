import type { SeasonMatch } from '@/types/api';

/** Année de début de la saison d'une date : juillet (qualifications) → juin. */
function startYear(date: Date): number {
  return date.getUTCMonth() >= 6 ? date.getUTCFullYear() : date.getUTCFullYear() - 1;
}

/**
 * « 2026-27 » : la saison que couvrent les matchs servis (la plus représentée,
 * un match isolé d'une autre saison ne compte pas). Sans match, la saison de
 * `now`. Jamais écrit en dur : la saison change chaque août.
 */
export function seasonLabel(matches: SeasonMatch[] | undefined, now: Date = new Date()): string {
  const counts = new Map<number, number>();
  for (const m of matches ?? []) {
    const d = new Date(m.date);
    if (Number.isNaN(d.getTime())) continue;
    const y = startYear(d);
    counts.set(y, (counts.get(y) ?? 0) + 1);
  }
  let year = startYear(now);
  let best = 0;
  for (const [y, n] of counts) {
    if (n > best || (n === best && y > year)) {
      year = y;
      best = n;
    }
  }
  return `${year}-${String((year + 1) % 100).padStart(2, '0')}`;
}
