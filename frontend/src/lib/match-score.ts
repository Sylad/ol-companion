import type { LiveMatchStatus } from '@/types/api';

/**
 * Scores à afficher, ou null tant qu'il n'y en a pas : 365scores met -1 (ou
 * rien) pour un match qui n'a pas commencé, et un « -1 · -1 » n'est pas un score.
 */
export function scoreText(
  home: { score: number | null },
  away: { score: number | null },
  status: LiveMatchStatus,
): [string, string] | null {
  if (status === 'upcoming') return null;
  const valid = (n: number | null): n is number => n !== null && n >= 0;
  if (!valid(home.score) || !valid(away.score)) return null;
  return [String(home.score), String(away.score)];
}
