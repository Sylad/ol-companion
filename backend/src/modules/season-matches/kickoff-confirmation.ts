import type { Match } from '../fixtures/fixtures.service';

/** Les champs d'un match de la saison dont dépend la décision. */
interface KickoffSubject {
  competitionCode: string;
  status: string;
  matchday: number | null;
}

/** Nom de la Ligue 1 dans `competition.name` de football-data. */
const FOOTBALL_DATA_LIGUE1 = 'Ligue 1';

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
 * football-data, lui, le dit (`timeConfirmed` de `/api/fixtures`). D'où la
 * règle, qui n'affirme jamais une heure qu'aucune source ne confirme :
 *
 * - match en cours ou terminé → fixée ;
 * - Ligue 1 à venir → fixée seulement si football-data connaît la même journée
 *   ET la donne avec une heure. Il ne sert que les prochains matchs : au-delà,
 *   comme sans clé ou en panne, la réponse est « non fixée » ;
 * - autres compétitions (Ligue Europa, Coupe de France) → fixée : 365scores est
 *   la seule source, et aucun signal « à confirmer » n'y existe.
 */
export function isKickoffTimeConfirmed(
  match: KickoffSubject,
  footballData: Pick<Match, 'competition' | 'matchday' | 'timeConfirmed'>[],
): boolean {
  if (match.status !== 'SCHEDULED') return true;
  if (match.competitionCode !== 'L1') return true;
  if (match.matchday === null) return false;
  const same = footballData.find(
    (f) =>
      f.competition === FOOTBALL_DATA_LIGUE1 && f.matchday === match.matchday,
  );
  return same?.timeConfirmed === true;
}
