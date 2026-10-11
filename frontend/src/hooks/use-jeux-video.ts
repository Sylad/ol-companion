import { useQuery } from '@tanstack/react-query';
import { fetchJeuxVideo } from '@/lib/jeux-video';

export function useJeuxVideo() {
  return useQuery({
    queryKey: ['jeux-video', 'football-manager'],
    queryFn: ({ signal }) => fetchJeuxVideo(signal),
    staleTime: 10 * 60 * 1000,
  });
}
