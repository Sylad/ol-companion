/**
 * Sigle d'un club : celui de 365scores, sinon (il renvoie '' pour les deux clubs
 * d'un match) les trois premières lettres du nom, en capitales.
 */
export function clubSymbol(symbolicName: string | undefined, name: string): string {
  const given = symbolicName?.trim();
  if (given) return given;
  return name.replace(/[^\p{L}]/gu, '').slice(0, 3).toLocaleUpperCase('fr-FR');
}
