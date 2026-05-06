import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import type { SeasonMatch } from '@/types/api';

/**
 * Fetches OL's full-season match list across all tracked competitions
 * (Ligue 1, Coupe de France, Europa League). Backed by 365scores so it
 * does NOT suffer the football-data 20-match window that affects
 * /api/fixtures.
 *
 * The map uses this for bicolor markers (filtered to L1) AND the popup
 * "Coupe de France" section.
 */
export function useSeasonMatches() {
  return useQuery({
    queryKey: ['season-matches'],
    queryFn: ({ signal }) => apiGet<SeasonMatch[]>('/season-matches', signal),
    staleTime: 5 * 60 * 1000,
  });
}
