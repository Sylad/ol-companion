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
 */
export function footballDataTimeConfirmed(
  status: string,
  utcDate: string,
): boolean {
  return !(status === 'SCHEDULED' && /T00:00:00(\.0+)?Z$/.test(utcDate));
}
