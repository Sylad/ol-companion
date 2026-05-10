import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';

export interface DemoStatus {
  demoMode: boolean;
  forced: boolean;
}

/**
 * Fetches the demo state for the current host. When `forced=true`, the
 * frontend should display the locked-demo badge and disable any UI that
 * would trigger a write request (which the backend would reject anyway).
 *
 * The query is cached for the whole session — the host doesn't change
 * mid-flight.
 */
export function useDemoStatus() {
  return useQuery({
    queryKey: ['demo-status'],
    queryFn: ({ signal }) => apiGet<DemoStatus>('/demo/status', signal),
    staleTime: Infinity,
    gcTime: Infinity,
    retry: 1,
  });
}
