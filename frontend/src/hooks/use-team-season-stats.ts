import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import type { TeamSeasonStats } from '@/types/api';

/**
 * Cumulative team-level stats for OL across the current season — backed by
 * /api/season-matches/team-stats. Refresh follows the season-matches cron
 * (30 min) so we keep the staleTime in the same ballpark.
 */
export function useTeamSeasonStats() {
  return useQuery({
    queryKey: ['season-matches', 'team-stats'],
    queryFn: ({ signal }) => apiGet<TeamSeasonStats>('/season-matches/team-stats', signal),
    staleTime: 5 * 60 * 1000,
  });
}
