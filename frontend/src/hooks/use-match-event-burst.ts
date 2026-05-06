import { useEffect, useRef, useState } from 'react';
import type { LiveMatchStats, LiveMatchTimelineEvent } from '@/types/api';
import type { EventBurstType } from '@/components/match-event-burst';

/** Maps a 365scores event-type key (cf. live-match.aggregator.ts) to a burst variant. */
function mapEventType(type: string): EventBurstType | null {
  if (type === 'goal' || type === 'penalty_goal' || type === 'own_goal') return 'goal';
  if (type === 'red_card' || type === 'second_yellow_red') return 'red';
  if (type === 'yellow_card' || type === 'card') return 'yellow';
  if (type === 'substitution') return 'sub';
  return null;
}

/** Stable signature for an event (used as React key + dedup token). */
function eventSignature(e: LiveMatchTimelineEvent): string {
  return `${e.gameTime}|${e.type}|${e.competitorId}|${e.playerId ?? '_'}|${e.extraPlayerId ?? '_'}`;
}

interface ActiveBurst {
  id: string;
  type: EventBurstType;
}

/**
 * Detects newly arrived live-match events / score changes and surfaces an
 * `ActiveBurst` to render via `<MatchEventBurst>`. The first stats payload
 * never triggers a burst (page-load events shouldn't flash).
 */
export function useMatchEventBurst(stats: LiveMatchStats | undefined): ActiveBurst | null {
  const [burst, setBurst] = useState<ActiveBurst | null>(null);
  const seenSignaturesRef = useRef<Set<string> | null>(null);
  const lastScoreRef = useRef<{ home: number | null; away: number | null } | null>(null);
  const burstTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!stats) return;

    // First payload — record state silently, no burst.
    if (seenSignaturesRef.current === null) {
      seenSignaturesRef.current = new Set(stats.events.map(eventSignature));
      lastScoreRef.current = { home: stats.home.score, away: stats.away.score };
      return;
    }

    // Detect new events (preserve order — older events first in stats.events).
    const seen = seenSignaturesRef.current;
    const newEvents: LiveMatchTimelineEvent[] = [];
    for (const e of stats.events) {
      const sig = eventSignature(e);
      if (!seen.has(sig)) {
        seen.add(sig);
        newEvents.push(e);
      }
    }

    // Score-change fallback (in case 365scores updates the score before the timeline).
    const lastScore = lastScoreRef.current ?? { home: null, away: null };
    const scoreChanged =
      stats.home.score !== lastScore.home || stats.away.score !== lastScore.away;
    lastScoreRef.current = { home: stats.home.score, away: stats.away.score };

    // Pick the highest-priority new event: red > yellow > goal > sub. Goals win
    // over substitutions when they share a tick. Score-change without a matching
    // timeline event still triggers a goal burst.
    const priority: Record<EventBurstType, number> = { red: 4, goal: 3, yellow: 2, sub: 1 };
    let chosen: { type: EventBurstType; sig: string } | null = null;
    for (const e of newEvents) {
      const t = mapEventType(e.type);
      if (!t) continue;
      const sig = eventSignature(e);
      if (!chosen || priority[t] > priority[chosen.type]) {
        chosen = { type: t, sig };
      }
    }

    if (
      !chosen &&
      scoreChanged &&
      (stats.home.score ?? 0) + (stats.away.score ?? 0) >
        (lastScore.home ?? 0) + (lastScore.away ?? 0)
    ) {
      chosen = { type: 'goal', sig: `score-${stats.home.score}-${stats.away.score}-${Date.now()}` };
    }

    if (chosen) {
      // Unique id forces React to remount <MatchEventBurst> via `key` so the
      // animation replays even if the same type fires twice in a row.
      setBurst({ id: chosen.sig, type: chosen.type });

      if (burstTimerRef.current !== null) {
        window.clearTimeout(burstTimerRef.current);
      }
      // Slightly longer than the longest animation to avoid flicker.
      burstTimerRef.current = window.setTimeout(() => {
        setBurst(null);
        burstTimerRef.current = null;
      }, 2200);
    }
  }, [stats]);

  useEffect(() => {
    return () => {
      if (burstTimerRef.current !== null) {
        window.clearTimeout(burstTimerRef.current);
      }
    };
  }, []);

  return burst;
}
