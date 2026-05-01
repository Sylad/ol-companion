import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import type { OlSeasonRanking } from '@/types/api';

export function useSeasonRankings() {
  return useQuery({
    queryKey: ['season-rankings'],
    queryFn: ({ signal }) => apiGet<OlSeasonRanking[]>('/standings/season-rankings', signal),
    staleTime: 5 * 60 * 1000,
  });
}
