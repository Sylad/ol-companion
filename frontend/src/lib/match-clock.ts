import type { LiveMatchSummary } from '@/types/api';

export type MatchPhase =
  | 'upcoming'
  | 'first-half'
  | 'half-time'
  | 'second-half'
  | 'extra-time'
  | 'shootout'
  | 'ended';

export interface MatchClock {
  phase: MatchPhase;
  /** Short label (≤ 14 chars) shown in place of "23'" when not in active play. */
  label: string;
  /** True when the clock should be ticking (regular play). HT/FT/pre-match → false. */
  isActive: boolean;
}

/**
 * Derives the right clock label + phase from a LiveMatchSummary so we can show
 * "MI-TEMPS" / "TERMINÉ" / "PROLONGATIONS" / "TAB" instead of misleading "45'".
 */
export function deriveClock(s: Pick<LiveMatchSummary, 'gameTimeDisplay' | 'statusText' | 'statusGroup'>): MatchClock {
  const txt = (s.statusText ?? '').toLowerCase();
  if (s.statusGroup === 1) {
    return { phase: 'upcoming', label: 'À VENIR', isActive: false };
  }
  if (s.statusGroup === 4) {
    if (txt.includes('tirs au but') || txt.includes('séance') || txt.includes('penalty')) {
      return { phase: 'ended', label: 'TERMINÉ (TAB)', isActive: false };
    }
    if (txt.includes('prolongation') || txt.includes('a.p.') || txt.includes('après prolongation')) {
      return { phase: 'ended', label: 'TERMINÉ (a.p.)', isActive: false };
    }
    return { phase: 'ended', label: 'TERMINÉ', isActive: false };
  }
  // statusGroup === 3 (live) — refine via statusText
  // Order matters: check active-play phrases FIRST (they may contain "mi-temps" inside e.g. "Deuxième mi-temps").
  if (txt.includes('deuxième') || txt.includes('seconde') || txt.includes('2nd')) {
    return { phase: 'second-half', label: s.gameTimeDisplay || s.statusText, isActive: true };
  }
  if (txt.includes('première') || txt.includes('1st')) {
    return { phase: 'first-half', label: s.gameTimeDisplay || s.statusText, isActive: true };
  }
  if (txt.includes('tirs au but') || txt.includes('séance de penalty') || txt.includes('penalty shootout')) {
    return { phase: 'shootout', label: 'TAB', isActive: true };
  }
  if (txt.includes('prolongation') || txt.includes('extra time')) {
    return { phase: 'extra-time', label: s.gameTimeDisplay || 'PROLONGATIONS', isActive: true };
  }
  // Bare "Mi-temps" / "Halftime" pause label (only fires when not in 1st/2nd half block above).
  if (txt.includes('mi-temps') || txt === 'halftime') {
    return { phase: 'half-time', label: 'MI-TEMPS', isActive: false };
  }
  return { phase: 'first-half', label: s.gameTimeDisplay || s.statusText, isActive: true };
}
