/**
 * 365scores ne dit pas qu'une heure n'est pas fixée (il met une heure de remplissage) et
 * football-data ne suit pas les Bleus : au-delà de 14 jours (seuil de CLAUDE.md « L39 »),
 * l'heure est tenue pour non fixée. Règle partagée par `/api/france` et `/api/live-match/{gameId}/stats`.
 */
export const TIME_CONFIRMED_HORIZON_MS = 14 * 24 * 60 * 60 * 1000;

/** Vrai quand le coup d'envoi est à 14 jours ou moins (borne comprise), ou déjà passé. */
export function isKickoffTimeWithinHorizon(startTime: string, now: number): boolean {
  return new Date(startTime).getTime() - now <= TIME_CONFIRMED_HORIZON_MS;
}
