// Initiales d'un joueur, lues dans son nom complet (jamais dans `shortName`, qui peut être le seul nom de famille).
export function initiales(nom: string): string {
  return nom.split(/\s+/).filter(Boolean).map((m) => m[0]).join('').slice(0, 2).toUpperCase();
}
