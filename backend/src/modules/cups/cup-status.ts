import type { CupMatch } from './cups.service';

const EUROPA_LEAGUE_ID = 573;
const LEAGUE_PHASE_STAGE = 'Phase de ligue';
/** Une équipe joue 8 matchs en phase de ligue. */
export const LEAGUE_PHASE_MATCHES = 8;

/**
 * Éliminé = au moins un match joué et plus rien à venir. Exception : tant que
 * la phase de ligue de la Ligue Europa n'est pas jouée en entier, l'absence de
 * match à venir ne prouve rien (calendrier pas encore publié ou page manquante) :
 * on ne conclut pas.
 */
export function isCupEliminated(competitionId: number, matches: CupMatch[]): boolean {
  const finished = matches.filter((m) => m.status === 'FINISHED');
  const upcoming = matches.filter((m) => m.status === 'SCHEDULED' || m.status === 'IN_PLAY');
  if (finished.length === 0 || upcoming.length > 0) return false;
  if (competitionId === EUROPA_LEAGUE_ID) {
    const onlyLeaguePhase = matches.every((m) => m.stageFr === LEAGUE_PHASE_STAGE);
    if (onlyLeaguePhase && finished.length < LEAGUE_PHASE_MATCHES) return false;
  }
  return true;
}
