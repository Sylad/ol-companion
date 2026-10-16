/** Sigle fixe du club suivi : 365scores renvoie un sigle vide, et personne n'appelle l'OL « LYO ». */
export const OL_SYMBOL = 'OL';

/**
 * Sigle d'un club : « OL » pour le club suivi (toujours), sinon celui de 365scores et, s'il
 * le renvoie vide (cas des deux clubs d'un match), les trois premières lettres du nom, en capitales.
 */
export function clubSymbol(symbolicName: string | undefined, name: string, isOl = false): string {
  if (isOl) return OL_SYMBOL;
  const given = symbolicName?.trim();
  if (given) return given;
  return name.replace(/[^\p{L}]/gu, '').slice(0, 3).toLocaleUpperCase('fr-FR');
}

/**
 * Légende d'un club : sigle puis nom (« OL Lyon », « RCL Lens »). Quand le sigle n'est qu'un repli
 * tiré du nom (365scores n'en donne pas), il répéterait le nom (« REN Rennes ») : on garde le nom seul.
 */
export function clubLegendLabel(symbolicName: string | undefined, name: string, isOl = false): string {
  if (!isOl && !symbolicName?.trim()) return name;
  return `${clubSymbol(symbolicName, name, isOl)} ${name}`;
}
