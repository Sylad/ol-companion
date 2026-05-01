import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import type { CupInfo } from '@/types/api';

export function useCups() {
  return useQuery({
    queryKey: ['cups'],
    queryFn: ({ signal }) => apiGet<CupInfo[]>('/cups', signal),
    staleTime: 30 * 60 * 1000,
  });
}
