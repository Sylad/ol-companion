import type { Fixture } from '@/types/api';
import { OL_TEAM_ID } from '@/types/api';
import { resolveOpponentClub } from './ligue1-club-match';

/**
 * Lieu du prochain match : le stade du club qui reçoit, tiré de la table des
 * clubs de Ligue 1. Club introuvable → `null` : l'écran ne montre rien plutôt
 * qu'un stade fabriqué à partir du nom du club (« Stade Racing Club de Lens »).
 */
export function nextMatchVenue(match: Pick<Fixture, 'homeTeam' | 'homeTeamId'>): string | null {
  if (match.homeTeamId === OL_TEAM_ID) return 'Groupama Stadium · Décines-Charpieu';
  const host = resolveOpponentClub({
    homeTeamId: OL_TEAM_ID,
    awayTeamId: match.homeTeamId,
    awayTeam: match.homeTeam,
  } as Fixture);
  return host?.stadium ?? null;
}
