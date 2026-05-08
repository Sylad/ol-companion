import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import type { PlayerSeasonStats } from '@/types/api';

/**
 * Cumulative season stats for every OL player who logged minutes,
 * sorted by goal contributions desc.
 *
 * Cached server-side for 1h and invalidated on `season-matches-changed`.
 * Client-side, the SSE handler in `useEventStream` invalidates the
 * `['player-stats']` key when the same event arrives.
 */
export function useSeasonStats() {
  return useQuery({
    queryKey: ['player-stats', 'all'],
    queryFn: ({ signal }) =>
      apiGet<PlayerSeasonStats[]>('/players/season-stats', signal),
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Cumulative season stats for one OL player.
 */
export function usePlayerSeasonStats(athleteId: number | null | undefined) {
  return useQuery({
    queryKey: ['player-stats', 'one', athleteId],
    queryFn: ({ signal }) =>
      apiGet<PlayerSeasonStats>(`/players/${athleteId}/season-stats`, signal),
    enabled: typeof athleteId === 'number' && athleteId > 0,
    staleTime: 5 * 60 * 1000,
  });
}
