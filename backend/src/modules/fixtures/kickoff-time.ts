/**
 * football-data.org v4 dit lui-même quand l'heure d'un match n'est pas fixée :
 * statut `SCHEDULED` (la date est connue, pas l'heure) avec `utcDate` à
 * 00:00:00Z, contre `TIMED` dès que l'heure est programmée.
 *
 * Les deux conditions ensemble : `FixturesService.toMatch` replie tout statut
 * inconnu sur `SCHEDULED`, et un tel match garde sa vraie heure.
 *
 * Mesuré en prod le 2026-10-03 : J13 (`2026-12-05T00:00:00Z`) et J15
 * (`2027-01-02T00:00:00Z`) en `SCHEDULED`, affichés « 01:00 » par le calendrier.
 *
 * L268 : un match reporté (`POSTPONED`) ou interrompu (`SUSPENDED`, retenu
 * comme `POSTPONED` par `storedStatus`) n'a pas non plus d'heure quand sa date
 * est à minuit UTC : c'est le même remplissage. Il passait pour « heure
 * fixée » et s'affichait à 01:00 dans le `.ics` et sur /fixtures. Un match
 * joué ou en cours garde son heure, quelle qu'elle soit.
 */
const WITHOUT_TIME_STATUSES = new Set(['SCHEDULED', 'POSTPONED', 'SUSPENDED']);

export function footballDataTimeConfirmed(
  status: string,
  utcDate: string,
): boolean {
  return !(WITHOUT_TIME_STATUSES.has(status) && /T00:00:00(\.0+)?Z$/.test(utcDate));
}
