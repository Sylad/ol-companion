import { useEffect, useRef } from 'react';
import { useLiveMatchStats, useCurrentLiveMatch } from './use-live-match';
import { postNotification } from '@/lib/pwa';
import { OL_365SCORES_ID } from '@/types/api';
import type { LiveMatchStats, LiveMatchTimelineEvent } from '@/types/api';

const STORAGE_KEY = 'olc:notifications-enabled';
const SEEN_SIG_KEY = 'olc:notif-seen-events';

/**
 * Returns true when the user has explicitly enabled notifications via the
 * settings toggle. We default to OFF — opt-in only.
 */
export function notificationsEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function setNotificationsEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    if (enabled) localStorage.setItem(STORAGE_KEY, '1');
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore quota / private mode
  }
}

function eventSignature(e: LiveMatchTimelineEvent): string {
  return `${e.gameTime}|${e.type}|${e.competitorId}|${e.playerId ?? '_'}|${e.extraPlayerId ?? '_'}`;
}

function loadSeenSignatures(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = sessionStorage.getItem(SEEN_SIG_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function saveSeenSignatures(set: Set<string>): void {
  if (typeof window === 'undefined') return;
  try {
    // Cap at 200 most recent to keep the storage tiny.
    const arr = Array.from(set);
    sessionStorage.setItem(SEEN_SIG_KEY, JSON.stringify(arr.slice(-200)));
  } catch {
    // ignore
  }
}

interface NotifPayload {
  title: string;
  body: string;
  tag?: string;
}

function buildPayload(
  stats: LiveMatchStats,
  newEvent: LiveMatchTimelineEvent | null,
  scoreJump: boolean,
): NotifPayload | null {
  const olIsHome = stats.home.id === OL_365SCORES_ID;
  const olName = olIsHome ? stats.home.name : stats.away.name;
  const opponentName = olIsHome ? stats.away.name : stats.home.name;
  const score = `${stats.home.score ?? 0}-${stats.away.score ?? 0}`;
  const tagBase = `olc-${stats.gameId}`;

  // Goal — by far the highest priority.
  if (newEvent && (newEvent.type === 'goal' || newEvent.type === 'penalty_goal')) {
    const olScored = newEvent.competitorId === OL_365SCORES_ID;
    const verb = olScored ? `${olName} vient de marquer !` : `${opponentName} marque…`;
    return {
      title: olScored ? `⚽ But pour Lyon` : `⚠️ But adverse`,
      body: `${verb} ${score} (${newEvent.gameTimeDisplay})`,
      tag: `${tagBase}-goal-${newEvent.gameTime}`,
    };
  }

  // Score change without a matching event (rare — 365scores delay).
  if (scoreJump) {
    return {
      title: '⚽ But !',
      body: `${stats.home.name} ${score} ${stats.away.name}`,
      tag: `${tagBase}-score-${score}`,
    };
  }

  if (newEvent && (newEvent.type === 'red_card' || newEvent.type === 'second_yellow_red')) {
    const isOl = newEvent.competitorId === OL_365SCORES_ID;
    return {
      title: isOl ? '🟥 Carton rouge OL' : '🟥 Carton rouge',
      body: `${newEvent.description} · ${newEvent.gameTimeDisplay}`,
      tag: `${tagBase}-red-${newEvent.gameTime}`,
    };
  }

  return null;
}

/**
 * Listens to the live-match SSE stream (already invalidating the
 * `useLiveMatchStats` query in `useEventStream`) and pops a system
 * notification when:
 *  - OL or the opponent scores
 *  - a red card is shown
 *  - the match has just kicked off / ended (status flip)
 *
 * The hook is a no-op unless:
 *  - `notificationsEnabled()` returns true (user opted in)
 *  - `Notification.permission === 'granted'`
 *  - `document.hidden` is true (we don't want to spam the active tab —
 *    in-app bursts already do that job; cf. `useMatchEventBurst`).
 */
export function useMatchNotifications(): void {
  const { data: current } = useCurrentLiveMatch();
  const { data: stats } = useLiveMatchStats(
    current?.gameId ?? null,
    current?.matchupId ?? null,
  );

  const seenRef = useRef<Set<string> | null>(null);
  const lastScoreRef = useRef<{ home: number | null; away: number | null } | null>(null);
  const lastStatusRef = useRef<string | null>(null);

  useEffect(() => {
    if (!stats) return;

    // Hydrate the dedup set from sessionStorage on first run so a tab
    // refresh during a live game doesn't re-fire notifications.
    if (seenRef.current === null) {
      seenRef.current = loadSeenSignatures();
      lastScoreRef.current = { home: stats.home.score, away: stats.away.score };
      lastStatusRef.current = stats.status;
      // First payload after page load is always silent.
      for (const e of stats.events) seenRef.current.add(eventSignature(e));
      saveSeenSignatures(seenRef.current);
      return;
    }

    if (!notificationsEnabled()) return;
    if (typeof document !== 'undefined' && !document.hidden) return; // foreground → in-app burst handles it

    const seen = seenRef.current;
    const newEvents: LiveMatchTimelineEvent[] = [];
    for (const e of stats.events) {
      const sig = eventSignature(e);
      if (!seen.has(sig)) {
        seen.add(sig);
        newEvents.push(e);
      }
    }

    const lastScore = lastScoreRef.current ?? { home: null, away: null };
    const scoreSumNow = (stats.home.score ?? 0) + (stats.away.score ?? 0);
    const scoreSumPrev = (lastScore.home ?? 0) + (lastScore.away ?? 0);
    const scoreJump = scoreSumNow > scoreSumPrev;
    lastScoreRef.current = { home: stats.home.score, away: stats.away.score };

    // Match start / end — single notification per status flip.
    const statusChanged = lastStatusRef.current !== stats.status;
    lastStatusRef.current = stats.status;

    let payload: NotifPayload | null = null;
    // Highest-priority new event wins (goal > red > nothing).
    const goal = newEvents.find((e) => e.type === 'goal' || e.type === 'penalty_goal');
    const red = newEvents.find((e) => e.type === 'red_card' || e.type === 'second_yellow_red');
    if (goal) payload = buildPayload(stats, goal, false);
    else if (red) payload = buildPayload(stats, red, false);
    else if (scoreJump) payload = buildPayload(stats, null, true);
    else if (statusChanged && stats.status === 'live') {
      payload = {
        title: '🔴 Coup d\'envoi',
        body: `${stats.home.name} – ${stats.away.name}`,
        tag: `olc-${stats.gameId}-kickoff`,
      };
    } else if (statusChanged && stats.status === 'ended') {
      payload = {
        title: 'Fin du match',
        body: `${stats.home.name} ${stats.home.score ?? 0}-${stats.away.score ?? 0} ${stats.away.name}`,
        tag: `olc-${stats.gameId}-fulltime`,
      };
    }

    if (payload) {
      void postNotification({
        ...payload,
        data: { url: `/match/${stats.gameId}`, gameId: stats.gameId },
      });
    }

    saveSeenSignatures(seen);
  }, [stats]);
}
