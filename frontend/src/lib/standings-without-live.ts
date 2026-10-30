import { OL_365SCORES_ID, type LiveMatchSummary, type StandingEntry } from '@/types/api';

const LIGUE_1_365SCORES_ID = 35;

/**
 * 365scores range le match de Ligue 1 en cours dans le classement, au score du moment (L86) :
 * les tuiles de l'accueil disaient « 6 matchs · 1N 1D » à la 56e de Lens – Lyon, quand le
 * bilan de la saison disait 5 matchs. On retire du bilan de l'OL ce match, avec son résultat
 * provisoire ; sans score lisible des deux côtés, on ne devine rien et on rend la ligne telle quelle.
 */
export function standingsWithoutLive(
  ol: StandingEntry | undefined,
  live: LiveMatchSummary | null | undefined,
): StandingEntry | undefined {
  if (!ol || !live || live.status !== 'live' || live.competitionId !== LIGUE_1_365SCORES_ID) return ol;
  const olSide = [live.home, live.away].find((s) => s.id === OL_365SCORES_ID);
  const other = live.home === olSide ? live.away : live.home;
  if (!olSide || olSide.score === null || other.score === null) return ol;
  if (ol.played < 1) return ol;
  const pour = olSide.score;
  const contre = other.score;
  const won = pour > contre ? 1 : 0;
  const draw = pour === contre ? 1 : 0;
  return {
    ...ol,
    played: ol.played - 1,
    won: ol.won - won,
    draw: ol.draw - draw,
    lost: ol.lost - (won || draw ? 0 : 1),
    goalsFor: ol.goalsFor - pour,
    goalsAgainst: ol.goalsAgainst - contre,
    goalDifference: ol.goalDifference - (pour - contre),
    points: ol.points - (won ? 3 : draw ? 1 : 0),
  };
}
