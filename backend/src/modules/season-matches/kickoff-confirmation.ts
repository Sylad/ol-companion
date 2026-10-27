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

/** Les champs d'un match football-data dont dépend la décision. */
export type FootballDataKickoff = Pick<
  Match,
  'competition' | 'matchday' | 'timeConfirmed'
> & {
  /** Instant du coup d'envoi selon football-data ; absent = rien à comparer. */
  date?: string;
};

/**
 * Ce que football-data dit de l'heure de la journée `matchday` de Ligue 1 :
 * `true` (fixée) ou `false` (à confirmer), ou `undefined` s'il n'en dit rien
 * (pas de clé, pas de cache, appel en échec, journée au-delà de sa réponse,
 * match sans journée). Partagé avec la réponse de `/api/live-match/{id}/stats`.
 *
 * `date` est le coup d'envoi tel que 365scores l'annonce : quand football-data
 * a fixé l'heure (`true`) mais à un AUTRE instant, l'heure de 365scores est un
 * remplissage ou une valeur périmée, pas une heure fixée — le verdict est
 * `false` (L46). Sans `date` (ou sans date chez football-data), le verdict de
 * football-data tient seul.
 */
export function footballDataSaysKickoff(
  matchday: number | null,
  footballData: FootballDataKickoff[],
  date?: string,
): boolean | undefined {
  if (matchday === null) return undefined;
  const said = footballData.find(
    (f) => f.competition === FOOTBALL_DATA_LIGUE1 && f.matchday === matchday,
  );
  if (said === undefined) return undefined;
  if (said.timeConfirmed && date !== undefined && said.date !== undefined) {
    return new Date(said.date).getTime() === new Date(date).getTime();
  }
  return said.timeConfirmed;
}

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
 *   mot : `SCHEDULED` à minuit UTC = non fixée ; `TIMED` = fixée SI son instant
 *   est celui de 365scores, sinon non fixée (l'heure de 365scores n'est alors
 *   pas la bonne, L46) ;
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
  footballData: FootballDataKickoff[],
  now: Date = new Date(),
): boolean {
  if (match.status !== 'SCHEDULED') return true;
  if (match.competitionCode !== 'L1') return true;
  const said = footballDataSaysKickoff(
    match.matchday,
    footballData,
    match.date,
  );
  if (said !== undefined) return said;
  return new Date(match.date).getTime() - now.getTime() <= KICKOFF_WINDOW_MS;
}
