import type { Match } from '../fixtures/fixtures.service';

/** Les champs d'un match de la saison dont dépend la décision. */
interface KickoffSubject {
  competitionCode: string;
  status: string;
  matchday: number | null;
  /** Date ISO du coup d'envoi selon 365scores. */
  date: string;
}

/** Nom de la Ligue 1 dans `competition.name` de football-data. */
const FOOTBALL_DATA_LIGUE1 = 'Ligue 1';

/**
 * Quand football-data ne dit rien d'une journée, l'heure de 365scores est
 * affichée pour un match des 14 prochains jours, et « à confirmer » au-delà
 * (décision du 2026-10-03). Borne comprise.
 */
export const KICKOFF_WINDOW_MS = 14 * 24 * 3600_000;

/**
 * L'heure du coup d'envoi d'un match de la saison est-elle fixée ?
 *
 * 365scores ne le dit pas. Mesuré le 2026-10-03 sur la charge réelle : J13
 * Troyes–Lyon et J15 Le Mans–Lyon y sont à 17:00 UTC un samedi, comme presque
 * toutes les journées suivantes, alors que football-data les donne sans heure ;
 * et RIEN n'y distingue cette heure de remplissage d'une vraie — mêmes
 * `statusGroup`, `statusText`, `gameTimeAndStatusDisplayType`, `hasTVNetworks`
 * que J11 ou J12, dont l'heure est fixée. 17:00 UTC est par ailleurs une vraie
 * heure de coup d'envoi (Lyon–Auxerre, J3) : pas de règle possible sur l'heure.
 *
 * football-data, lui, le dit (`timeConfirmed` de `/api/fixtures`). La règle :
 *
 * - match en cours ou terminé → fixée ;
 * - autres compétitions (Ligue Europa, Ligue des champions, Coupe de France) →
 *   fixée : 365scores est la seule source, aucun signal « à confirmer » n'y
 *   existe ;
 * - Ligue 1 à venir, football-data PARLE de la même journée → il a le dernier
 *   mot : `TIMED` = fixée, `SCHEDULED` à minuit UTC = non fixée ;
 * - Ligue 1 à venir, football-data n'en dit RIEN (pas de clé, pas de cache,
 *   appel en échec, journée au-delà de sa réponse, match sans journée) → l'heure
 *   de 365scores est tenue pour fixée dans les 14 prochains jours, pas au-delà.
 *
 * Le silence de football-data ne cache donc plus une vraie heure : avant, un
 * appel refusé (429) faisait passer le match du lendemain en « Horaire à
 * confirmer ».
 */
export function isKickoffTimeConfirmed(
  match: KickoffSubject,
  footballData: Pick<Match, 'competition' | 'matchday' | 'timeConfirmed'>[],
  now: Date = new Date(),
): boolean {
  if (match.status !== 'SCHEDULED') return true;
  if (match.competitionCode !== 'L1') return true;
  const said =
    match.matchday === null
      ? undefined
      : footballData.find(
          (f) =>
            f.competition === FOOTBALL_DATA_LIGUE1 &&
            f.matchday === match.matchday,
        );
  if (said) return said.timeConfirmed;
  return new Date(match.date).getTime() - now.getTime() <= KICKOFF_WINDOW_MS;
}
