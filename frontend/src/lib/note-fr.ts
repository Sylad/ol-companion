/** Note d'un joueur au format français : une décimale, virgule (7,3). */
export function noteFr(note: number): string {
  return note.toFixed(1).replace('.', ',');
}
