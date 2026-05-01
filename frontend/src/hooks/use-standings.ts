import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import type { SeasonStandings } from '@/types/api';

export function useStandings() {
  return useQuery({
    queryKey: ['standings'],
    queryFn: ({ signal }) => apiGet<SeasonStandings | null>('/standings', signal),
    staleTime: 5 * 60 * 1000,
  });
}
