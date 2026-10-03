import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

export type EventStreamStatus = 'connecting' | 'connected' | 'reconnecting';

/**
 * Subscribes to the backend SSE channel (`/api/events`) once at app start
 * and invalidates the relevant React Query caches when matching events arrive.
 */
export function useEventStream(): EventStreamStatus {
  const qc = useQueryClient();
  const [status, setStatus] = useState<EventStreamStatus>('connecting');

  useEffect(() => {
    const es = new EventSource('/api/events');

    let hadDrop = false;
    es.onopen = () => {
      setStatus('connected');
      // Reconnexion après une coupure : les events émis pendant le trou sont
      // perdus → invalider les caches dérivés pour resynchroniser.
      if (hadDrop) {
        qc.invalidateQueries();
      }
    };

    es.onmessage = (e) => {
      try {
        const { type } = JSON.parse(e.data) as { type: string };
        switch (type) {
          case 'live-match-changed':
            qc.invalidateQueries({ queryKey: ['live-match'] });
            break;
          case 'fixtures-changed':
            qc.invalidateQueries({ queryKey: ['fixtures'] });
            // L'heure fixée ou non des matchs de la saison (timeConfirmed) est
            // dérivée de ce calendrier — `exact` : les statistiques d'équipe,
            // rangées sous la même clé, n'en dépendent pas.
            qc.invalidateQueries({ queryKey: ['season-matches'], exact: true });
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
            // Both player season stats AND team season stats are derived from
            // season-matches → same trigger refreshes both.
            qc.invalidateQueries({ queryKey: ['player-stats'] });
            qc.invalidateQueries({ queryKey: ['season-matches', 'team-stats'] });
            break;
          // 'heartbeat' is ignored on purpose
        }
      } catch {
        // ignore malformed messages
      }
    };

    es.onerror = () => {
      hadDrop = true;
      // EventSource auto-reconnects; surface the state without adding manual retry logic.
      setStatus('reconnecting');
    };

    return () => es.close();
  }, [qc]);

  return status;
}
