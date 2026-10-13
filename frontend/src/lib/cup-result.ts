import { isOlTeamName } from '@/lib/ol-name';
import type { CupMatch } from '@/types/api';

export interface CupResult {
  result: 'W' | 'D' | 'L';
  /** Nul décidé aux tirs au but : le score ne les compte pas, 365scores désigne le qualifié (L140). */
  shootout: boolean;
}

/**
 * Issue d'un match de coupe pour l'OL, ou null (non terminé, sans score, sans l'OL).
 * Un nul dont 365scores désigne un qualifié (`olQualified`) est une victoire ou une défaite
 * aux tirs au but — sauf sur une manche retour dont le cumul des deux manches n'est pas nul :
 * le qualifié l'est alors au cumul, le match reste un nul. `tie` = les matchs de la coupe,
 * pour retrouver la manche aller.
 */
export function cupResult(m: CupMatch, tie: CupMatch[] = [m]): CupResult | null {
  if (m.status !== 'FINISHED' || m.homeScore === null || m.awayScore === null) return null;
  const olIsHome = isOlTeamName(m.homeTeam);
  if (!olIsHome && !isOlTeamName(m.awayTeam)) return null;
  const olScore = olIsHome ? m.homeScore : m.awayScore;
  const oppScore = olIsHome ? m.awayScore : m.homeScore;
  if (olScore > oppScore) return { result: 'W', shootout: false };
  if (olScore < oppScore) return { result: 'L', shootout: false };
  if (m.olQualified === undefined) return { result: 'D', shootout: false };

  const sameRound = (o: CupMatch) =>
    o.id !== m.id &&
    o.status === 'FINISHED' &&
    o.homeScore !== null &&
    o.awayScore !== null &&
    o.stageFr === m.stageFr &&
    [o.homeTeamId, o.awayTeamId].sort().join() === [m.homeTeamId, m.awayTeamId].sort().join();
  // Une manche aller ne se joue pas aux tirs au but, quoi que dise `olQualified` (règle L135).
  if (tie.some((o) => sameRound(o) && o.date > m.date)) return { result: 'D', shootout: false };
  const first = tie.filter((o) => sameRound(o) && o.date < m.date).sort((a, b) => b.date.localeCompare(a.date))[0];
  if (first) {
    const olFirst = isOlTeamName(first.homeTeam) ? first.homeScore! - first.awayScore! : first.awayScore! - first.homeScore!;
    if (olFirst !== 0) return { result: 'D', shootout: false };
  }
  return { result: m.olQualified ? 'W' : 'L', shootout: true };
}
