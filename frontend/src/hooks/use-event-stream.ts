import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

/**
 * Subscribes to the backend SSE channel (`/api/events`) once at app start
 * and invalidates the relevant React Query caches when matching events arrive.
 */
export function useEventStream() {
  const qc = useQueryClient();

  useEffect(() => {
    const es = new EventSource('/api/events');

    es.onmessage = (e) => {
      try {
        const { type } = JSON.parse(e.data) as { type: string };
        switch (type) {
          case 'live-match-changed':
            qc.invalidateQueries({ queryKey: ['live-match'] });
            break;
          case 'fixtures-changed':
            qc.invalidateQueries({ queryKey: ['fixtures'] });
            qc.invalidateQueries({ queryKey: ['live-match', 'current'] });
            break;
          case 'standings-changed':
            qc.invalidateQueries({ queryKey: ['standings'] });
            break;
          case 'season-rankings-changed':
            qc.invalidateQueries({ queryKey: ['season-rankings'] });
            break;
          case 'season-matches-changed':
            qc.invalidateQueries({ queryKey: ['season-matches'] });
            break;
          case 'claude-balance-changed':
            qc.invalidateQueries({ queryKey: ['claude-usage'] });
            break;
          // 'heartbeat' is ignored on purpose
        }
      } catch {
        // ignore malformed messages
      }
    };

    es.onerror = () => {
      // EventSource auto-reconnects; nothing to do here.
    };

    return () => es.close();
  }, [qc]);
}
