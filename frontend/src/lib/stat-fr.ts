/** Libellés de statistiques 365scores laissés en anglais (ou en français approximatif) → nom français. */
const STAT_NAME_FR: Record<string, string> = {
  Tackles: 'Tacles',
  'Les interceptions': 'Interceptions',
  Goals: 'Buts',
  Assists: 'Passes décisives',
  Appearances: 'Matchs joués',
  'Yellow:Red': 'Jaunes : rouges',
};

/** Rôles que 365scores écrit en anglais sur un match à venir. */
const ROLE_FR: Record<string, string> = {
  Attacker: 'Attaquant',
  Midfielder: 'Milieu de terrain',
  Defender: 'Défenseur',
  Goalkeeper: 'Gardien',
};

export function statNameFr(name: string): string {
  return STAT_NAME_FR[name] ?? name;
}

export function roleFr(role: string): string {
  return ROLE_FR[role] ?? role;
}

/** Nombre au format français : `digits` décimales, virgule (1,03). */
export function decimalFr(n: number, digits: number): string {
  return n.toFixed(digits).replace('.', ',');
}

/** Valeur de statistique 365scores (texte) : un décimal à point passe à la virgule, le reste (« 12 », « 0 : 0 ») est inchangé. */
export function statValueFr(value: string): string {
  return /^-?\d+\.\d+$/.test(value) ? value.replace('.', ',') : value;
}
