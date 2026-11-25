import { useQuery } from '@tanstack/react-query';
import { fetchCarrieres } from '@/lib/fcnoobz-carrieres';

export function useFcNoobzCarrieres() {
  return useQuery({
    queryKey: ['fcnoobz', 'carrieres'],
    queryFn: ({ signal }) => fetchCarrieres(signal),
    staleTime: 10 * 60 * 1000,
  });
}
