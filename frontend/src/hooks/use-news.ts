import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import type { NewsItem, YoutubeChannel } from '@/types/api';

export function useNews() {
  return useQuery({
    queryKey: ['news'],
    queryFn: ({ signal }) => apiGet<NewsItem[]>('/news', signal),
    staleTime: 5 * 60 * 1000,
  });
}

export function useYoutubeChannels() {
  return useQuery({
    queryKey: ['youtube-channels'],
    queryFn: ({ signal }) => apiGet<YoutubeChannel[]>('/youtube-channels', signal),
    staleTime: 24 * 60 * 60 * 1000,
  });
}
