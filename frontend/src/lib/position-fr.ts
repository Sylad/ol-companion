/**
 * 365scores donne les postes en anglais (« Goalkeeper », « Centre Back »,
 * « Coach »), en libellé long ou en abréviation (GK, CB). L'écran les montre
 * en français ; un libellé inconnu est rendu tel quel.
 */
const LONG_FR: Record<string, string> = {
  goalkeeper: 'Gardien',
  'gardien de but': 'Gardien de but',
  defender: 'Défenseur',
  'centre back': 'Défenseur central',
  'centre-back': 'Défenseur central',
  'center back': 'Défenseur central',
  'left back': 'Latéral gauche',
  'right back': 'Latéral droit',
  'left wing back': 'Piston gauche',
  'right wing back': 'Piston droit',
  midfielder: 'Milieu',
  'defensive midfield': 'Milieu défensif',
  'central midfield': 'Milieu central',
  'attacking midfield': 'Milieu offensif',
  'left midfield': 'Milieu gauche',
  'right midfield': 'Milieu droit',
  attacker: 'Attaquant',
  forward: 'Attaquant',
  'left forward': 'Ailier gauche',
  'right forward': 'Ailier droit',
  'left winger': 'Ailier gauche',
  'right winger': 'Ailier droit',
  'centre forward': 'Avant-centre',
  'second striker': 'Second attaquant',
  striker: 'Avant-centre',
  coach: 'Entraîneur',
  manager: 'Entraîneur',
  management: 'Entraîneur',
};

const SHORT_FR: Record<string, string> = {
  gk: 'GB', def: 'DEF', cb: 'DC', lb: 'DG', rb: 'DD', lwb: 'PG', rwb: 'PD',
  mid: 'MIL', dm: 'MDC', cm: 'MC', am: 'MO', lm: 'MG', rm: 'MD',
  atk: 'ATT', fw: 'ATT', lw: 'AG', rw: 'AD', cf: 'AC', ss: 'SA', st: 'AC',
  coach: 'ENT',
};

const SHORT_BY_LONG_FR: Record<string, string> = {
  Gardien: 'GB', 'Gardien de but': 'GB', Défenseur: 'DEF', 'Défenseur central': 'DC',
  'Latéral gauche': 'DG', 'Latéral droit': 'DD', 'Piston gauche': 'PG', 'Piston droit': 'PD',
  Milieu: 'MIL', 'Milieu défensif': 'MDC', 'Milieu central': 'MC', 'Milieu offensif': 'MO',
  'Milieu gauche': 'MG', 'Milieu droit': 'MD', Attaquant: 'ATT', 'Ailier gauche': 'AG',
  'Ailier droit': 'AD', 'Avant-centre': 'AC', 'Second attaquant': 'SA', Entraîneur: 'ENT',
};

export function positionLabelFr(name: string): string {
  const key = name.trim().toLowerCase();
  if (!key) return name;
  return LONG_FR[key] ?? name;
}

export function positionShortFr(value: string): string {
  const key = value.trim().toLowerCase();
  if (SHORT_FR[key]) return SHORT_FR[key];
  const long = LONG_FR[key];
  return (long && SHORT_BY_LONG_FR[long]) ?? value;
}
