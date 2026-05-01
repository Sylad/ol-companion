import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import type { WikiImageResult } from '@/types/api';

export function useWikiImage(query: string | null | undefined) {
  return useQuery({
    queryKey: ['wiki-image', query],
    queryFn: ({ signal }) =>
      apiGet<WikiImageResult>(`/wiki-image?q=${encodeURIComponent(query!)}`, signal),
    enabled: !!query,
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
  });
}
