import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import type { NextOpponents } from '@/types/next-opponents';

/**
 * L273 — prochain adversaire en Ligue 1 de chaque club (football-data.org, un seul appel pour tout le
 * classement : jamais un appel par ligne, cf. la limite de débit par visiteur).
 */
export function useNextOpponents() {
  return useQuery({
    queryKey: ['next-opponents'],
    queryFn: ({ signal }) => apiGet<NextOpponents>('/next-opponents', signal),
    staleTime: 5 * 60_000,
    retry: 1,
  });
}
