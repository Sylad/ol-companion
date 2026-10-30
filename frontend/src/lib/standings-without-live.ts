import { OL_TEAM_ID, type LiveMatchSummary, type SeasonMatch, type StandingEntry } from '@/types/api';

const LIGUE_1_365SCORES_ID = 35;

/**
 * 365scores range le match de Ligue 1 en cours dans le classement, mais pas au même rythme que
 * le direct (classement en cache 1 h côté serveur, direct relu toutes les 60 s) : la ligne peut
 * ne pas encore le contenir, ou le contenir à un autre score que celui du direct. On ne retire donc
 * jamais « le score du direct » de la ligne (L86) : quand la ligne compte exactement un match de
 * plus que les matchs de Ligue 1 terminés de `/api/season-matches`, c'est que le match en cours y est,
 * et le bilan est alors refait de ces seuls matchs terminés (V/N/D, buts, points), comme le bilan de la
 * saison. Ligne qui ne compte pas ce match, listes qui ne s'accordent pas (autre écart que 1), liste
 * de la saison pas encore lue, match d'une autre compétition ou non en cours : la ligne telle quelle.
 */
export function standingsWithoutLive(
  ol: StandingEntry | undefined,
  live: LiveMatchSummary | null | undefined,
  matches: SeasonMatch[] | undefined,
): StandingEntry | undefined {
  if (!ol || !matches || !live || live.status !== 'live' || live.competitionId !== LIGUE_1_365SCORES_ID) return ol;
  const finished = matches.filter(
    (m) =>
      m.competitionId === LIGUE_1_365SCORES_ID &&
      m.status === 'FINISHED' &&
      m.homeScore !== null &&
      m.awayScore !== null &&
      (m.homeTeamId === OL_TEAM_ID || m.awayTeamId === OL_TEAM_ID),
  );
  if (ol.played !== finished.length + 1) return ol;
  let won = 0;
  let draw = 0;
  let lost = 0;
  let goalsFor = 0;
  let goalsAgainst = 0;
  for (const m of finished) {
    const olHome = m.homeTeamId === OL_TEAM_ID;
    const pour = (olHome ? m.homeScore : m.awayScore) as number;
    const contre = (olHome ? m.awayScore : m.homeScore) as number;
    goalsFor += pour;
    goalsAgainst += contre;
    if (pour > contre) won++;
    else if (pour === contre) draw++;
    else lost++;
  }
  return {
    ...ol,
    played: finished.length,
    won,
    draw,
    lost,
    goalsFor,
    goalsAgainst,
    goalDifference: goalsFor - goalsAgainst,
    points: won * 3 + draw,
  };
}
