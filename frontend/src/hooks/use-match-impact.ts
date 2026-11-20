import { useQuery } from '@tanstack/react-query';
import { apiGet, estIntrouvable } from '@/lib/api';
import type { MatchImpact } from '@/types/api';

/** Relecture d'un classement provisoire : les matchs restants de la journée y entrent au fil de l'eau. */
const PROVISOIRE_REFETCH_MS = 15 * 60_000;

/**
 * L265 — ce que le match de Ligue 1 de l'OL joué à l'instant `at` (coup d'envoi, ISO) change à son
 * classement. `at` nul : rien n'est demandé. Un 404 (football-data ne connaît pas ce match) n'est pas rejoué.
 */
export function useMatchImpact(at: string | null) {
  return useQuery({
    queryKey: ['match-impact', at],
    queryFn: ({ signal }) => apiGet<MatchImpact>(`/match-impact?at=${encodeURIComponent(at as string)}`, signal),
    enabled: !!at,
    staleTime: 5 * 60_000,
    retry: (failures, error) => !estIntrouvable(error) && failures < 1,
    refetchInterval: (query) => {
      const d = query.state.data;
      return d && (!d.finished || d.remaining > 0) ? PROVISOIRE_REFETCH_MS : false;
    },
  });
}
