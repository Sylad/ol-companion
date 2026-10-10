import { OL_365SCORES_ID } from '../../config/constants';
import type { CupMatch } from './cups.service';

const LEAGUE_PHASE_STAGE = 'Phase de ligue';
/**
 * Sans match à venir ni défaite lisible, l'OL est donné éliminé au bout de ce
 * délai : le tirage du tour suivant (ou des barrages après la phase de ligue)
 * est publié bien avant.
 */
export const STALE_DAYS = 50;
/** Journées de la phase de ligue d'une compétition européenne (format à 36 clubs). */
export const LEAGUE_PHASE_MATCHES = 8;
const DIRECT_LAST_RANK = 8;
const PLAYOFF_LAST_RANK = 24;

/** Phase de ligue entièrement jouée : la dernière confrontation jouée en est une et ses 8 journées le sont. */
export function isLeaguePhaseComplete(matches: CupMatch[]): boolean {
  const finished = matches
    .filter((m) => m.status === 'FINISHED')
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const last = finished[finished.length - 1];
  return last?.stageFr === LEAGUE_PHASE_STAGE
    && finished.filter((m) => m.stageFr === LEAGUE_PHASE_STAGE).length >= LEAGUE_PHASE_MATCHES;
}

/** Suite de l'OL selon son rang final en phase de ligue : 1-8 huitièmes, 9-24 barrages, 25 et plus éliminé. */
export function leaguePhaseOutcome(rank: number): '1/8 de finale' | 'Barrages' | 'Éliminé' {
  if (rank <= DIRECT_LAST_RANK) return '1/8 de finale';
  if (rank <= PLAYOFF_LAST_RANK) return 'Barrages';
  return 'Éliminé';
}

/** Buts de l'OL moins buts adverses sur les matchs joués de la confrontation. */
function aggregate(matches: CupMatch[]): number {
  let diff = 0;
  for (const m of matches) {
    const olHome = m.homeTeamId === OL_365SCORES_ID;
    const ol = olHome ? m.homeScore : m.awayScore;
    const opp = olHome ? m.awayScore : m.homeScore;
    diff += (ol ?? 0) - (opp ?? 0);
  }
  return diff;
}

/**
 * Éliminé seulement sur preuve : la dernière confrontation à élimination directe
 * est perdue (équipe qualifiée lue chez 365scores, à défaut cumul des buts) et rien n'est à venir. Un tour gagné, une phase de ligue
 * (sauf rang final connu, `leaguePhaseRank`) ou un score illisible ne prouvent rien : on
 * reste « en lice » jusqu'à STALE_DAYS sans match. `upcomingKnown` = false quand
 * l'appel des matchs à venir a échoué : l'absence de match ne veut alors rien dire.
 */
export function isCupEliminated(matches: CupMatch[], now: Date = new Date(), upcomingKnown = true, leaguePhaseRank?: number): boolean {
  if (!upcomingKnown) return false;
  const finished = matches
    .filter((m) => m.status === 'FINISHED')
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const upcoming = matches.some((m) => m.status === 'SCHEDULED' || m.status === 'IN_PLAY');
  if (finished.length === 0 || upcoming) return false;

  const last = finished[finished.length - 1];
  if (leaguePhaseRank !== undefined && isLeaguePhaseComplete(matches)) {
    return leaguePhaseOutcome(leaguePhaseRank) === 'Éliminé';
  }
  if (last.stageFr !== LEAGUE_PHASE_STAGE) {
    const tie = finished.filter((m) => m.stageFr === last.stageFr);
    // 365scores désigne l'équipe qualifiée : seul moyen de lire une issue aux tirs au but (cumul nul).
    const decided = tie.find((m) => m.olQualified !== undefined);
    if (decided) return !decided.olQualified;
    if (aggregate(tie) < 0) return true;
  }
  return now.getTime() - new Date(last.date).getTime() > STALE_DAYS * 86_400_000;
}
