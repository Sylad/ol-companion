import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import type { FranceOverview } from '@/types/api';

export function useFrance() {
  return useQuery({
    queryKey: ['france'],
    queryFn: ({ signal }) => apiGet<FranceOverview>('/france', signal),
    staleTime: 10 * 60 * 1000,
  });
}
