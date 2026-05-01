import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import type { Fixture } from '@/types/api';

export function useFixtures() {
  return useQuery({
    queryKey: ['fixtures'],
    queryFn: ({ signal }) => apiGet<Fixture[]>('/fixtures', signal),
    staleTime: 5 * 60 * 1000,
  });
}
