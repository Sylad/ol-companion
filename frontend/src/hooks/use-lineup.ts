import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import type { LineupResponse } from '@/types/api';

export function useLineup() {
  return useQuery({
    queryKey: ['lineup'],
    queryFn: ({ signal }) => apiGet<LineupResponse | null>('/lineup', signal),
    staleTime: 30 * 60 * 1000,
  });
}
