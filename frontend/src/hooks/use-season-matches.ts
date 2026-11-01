import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import type { SeasonMatch } from '@/types/api';
import { settleInPlay } from '@/lib/season-settle';
import { useCurrentLiveMatch } from './use-live-match';

/**
 * Fetches OL's full-season match list across all tracked competitions
 * (Ligue 1, Coupe de France, Europa League). Backed by 365scores so it
 * does NOT suffer the football-data 20-match window that affects
 * /api/fixtures.
 *
 * The map uses this for bicolor markers (filtered to L1) AND the popup
 * "Coupe de France" section.
 *
 * L240 : la liste peut garder un match fini en `IN_PLAY` (cache serveur 30 min) ; le flux direct
 * fait foi et un `IN_PLAY` de plus de 3 h n'est plus un direct (`settleInPlay`). Toutes les
 * tuiles qui lisent cette liste voient donc le même statut.
 */
export function useSeasonMatches() {
  const query = useQuery({
    queryKey: ['season-matches'],
    queryFn: ({ signal }) => apiGet<SeasonMatch[]>('/season-matches', signal),
    staleTime: 5 * 60 * 1000,
  });
  const { data: live } = useCurrentLiveMatch();
  const raw = query.data;
  const data = useMemo(() => (raw ? settleInPlay(raw, live) : raw), [raw, live]);
  return { ...query, data } as typeof query;
}
