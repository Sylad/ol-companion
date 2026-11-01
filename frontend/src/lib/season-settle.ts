import type { LiveMatchSummary, SeasonMatch } from '@/types/api';

/** Un match dure moins de 3 h (prolongations et tirs au but compris) : au-delà, « IN_PLAY » est périmé. */
export const IN_PLAY_MAX_MS = 3 * 3600_000;

/**
 * La liste de la saison (cache serveur 30 min, 365scores en retard) peut garder un match fini en
 * `IN_PLAY` (L240). Deux garde-fous, sans toucher aux autres statuts :
 * - le flux direct (`/api/live-match/current`) fait foi : s'il dit « fini » pour CE match, il est
 *   `FINISHED`, avec le score du direct ;
 * - un `IN_PLAY` dont le coup d'envoi date de plus de 3 h n'est plus un direct, sauf si le flux
 *   direct dit encore « en cours » pour ce match.
 */
export function settleInPlay(
  matches: SeasonMatch[],
  live: LiveMatchSummary | null | undefined,
  now: Date = new Date(),
): SeasonMatch[] {
  return matches.map((m) => {
    if (m.status !== 'IN_PLAY') return m;
    const sameGame = live != null && live.gameId === m.id;
    if (sameGame && live.status === 'ended') {
      return {
        ...m,
        status: 'FINISHED',
        homeScore: live.home.score ?? m.homeScore,
        awayScore: live.away.score ?? m.awayScore,
      };
    }
    const stale = now.getTime() - new Date(m.date).getTime() > IN_PLAY_MAX_MS;
    if (stale && !(sameGame && live.status === 'live')) return { ...m, status: 'FINISHED' };
    return m;
  });
}
