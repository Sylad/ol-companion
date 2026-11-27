import { OL_365SCORES_ID, OL_TEAM_ID } from './constants';

/**
 * L273 — identifiant 365scores d'un club de Ligue 1 → identifiant football-data.org.
 *
 * Le classement (`/api/standings`) vient de 365scores et porte ses identifiants (sauf l'OL,
 * servi sous 523) ; le prochain adversaire vient de football-data. Les noms des deux sources
 * diffèrent (« PSG » / « Paris Saint-Germain FC », « Rennes » / « Stade Rennais FC 1901 ») :
 * la jointure se fait par cette table, jamais par le nom.
 *
 * Saison 2026-2027, les 18 clubs : identifiants 365scores relevés dans `/api/standings` de la
 * prod (`tests-navigateur/donnees/api-prod-2026-11-18.json`), football-data dans
 * `/v4/teams/523/matches` (`test/fixtures/football_data_ol_matches_2026_10_03.json`) ; Lorient
 * (525) et Strasbourg (576) sont les identifiants publics de football-data. Un club promu absent
 * de la table n'a pas d'adversaire affiché (« club non relié »), et le service le journalise.
 */
export const SCORES365_TO_FOOTBALL_DATA: Readonly<Record<number, number>> = {
  [OL_365SCORES_ID]: OL_TEAM_ID, // Lyon
  480: 524, // PSG
  478: 521, // Lille
  6075: 1045, // Paris FC
  469: 516, // Marseille
  470: 522, // Nice
  471: 548, // Monaco
  477: 529, // Rennes
  534: 512, // Brest
  472: 525, // Lorient
  481: 546, // Lens
  482: 511, // Toulouse
  479: 576, // Strasbourg
  476: 519, // Auxerre
  468: 535, // Le Mans
  493: 532, // Angers
  488: 531, // Troyes
  485: 533, // Le Havre
};

/** Identifiant du club dans `/api/standings` (365scores, OL sous 523) → football-data. */
export function standingsIdToFootballData(standingsId: number): number | undefined {
  if (standingsId === OL_TEAM_ID) return OL_TEAM_ID;
  return SCORES365_TO_FOOTBALL_DATA[standingsId];
}

const FOOTBALL_DATA_TO_STANDINGS: ReadonlyMap<number, number> = new Map(
  Object.entries(SCORES365_TO_FOOTBALL_DATA).map(([s365, fd]) => [fd, Number(s365) === OL_365SCORES_ID ? OL_TEAM_ID : Number(s365)]),
);

/** Identifiant football-data → identifiant du club dans `/api/standings` ; `undefined` si non relié. */
export function footballDataToStandingsId(fdId: number): number | undefined {
  return FOOTBALL_DATA_TO_STANDINGS.get(fdId);
}

/** Les identifiants de `/api/standings` reliés à football-data. */
export const LINKED_STANDINGS_IDS: readonly number[] = [...FOOTBALL_DATA_TO_STANDINGS.values()];
