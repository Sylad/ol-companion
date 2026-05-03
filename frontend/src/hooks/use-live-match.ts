import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import type { LiveMatchStats, LiveMatchSummary } from '@/types/api';

export function useCurrentLiveMatch() {
  return useQuery({
    queryKey: ['live-match', 'current'],
    queryFn: async ({ signal }) => {
      const data = await apiGet<LiveMatchSummary | null>('/live-match/current', signal);
      return data; // nullable
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
}

export function useLiveMatchStats(gameId: number | null, matchupId: string | null) {
  return useQuery({
    queryKey: ['live-match', 'stats', gameId, matchupId],
    queryFn: ({ signal }) =>
      apiGet<LiveMatchStats>(
        `/live-match/${gameId}/stats?matchupId=${encodeURIComponent(matchupId!)}`,
        signal,
      ),
    enabled: !!(gameId && matchupId),
    staleTime: 5_000,
    refetchInterval: ({ state }) => (state.data?.status === 'live' ? 30_000 : false),
    refetchOnWindowFocus: true,
  });
}
