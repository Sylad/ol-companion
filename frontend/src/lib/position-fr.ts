/**
 * 365scores donne les postes en anglais (« Goalkeeper », « Centre Back »,
 * « Coach »), en libellé long ou en abréviation (GK, CB). L'écran les montre
 * en français ; un libellé déjà français de 365scores (« Milieu de Terrain ») est ramené à la casse du français ;
 * un libellé inconnu est rendu tel quel.
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
  'milieu de terrain': 'Milieu de terrain',
  attaquant: 'Attaquant',
  défenseur: 'Défenseur',
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

/**
 * Codes produits par `abbreviatePosition` (backend, feuille de match du direct) et par les stats de saison, rendus en
 * libellé long français : une fiche alimentée par la feuille probable n'a que le code (« GK »), jamais « Goalkeeper ».
 */
const LONG_FR_BY_CODE: Record<string, string> = {
  gk: 'Gardien', def: 'Défenseur', cb: 'Défenseur central', lb: 'Latéral gauche', rb: 'Latéral droit',
  lwb: 'Piston gauche', rwb: 'Piston droit', mid: 'Milieu', dm: 'Milieu défensif', cm: 'Milieu central',
  am: 'Milieu offensif', lm: 'Milieu gauche', rm: 'Milieu droit', atk: 'Attaquant', fw: 'Attaquant',
  lw: 'Ailier gauche', rw: 'Ailier droit', cf: 'Avant-centre', ss: 'Second attaquant', st: 'Avant-centre',
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
  Milieu: 'MIL', 'Milieu de terrain': 'MIL', 'Milieu défensif': 'MDC', 'Milieu central': 'MC', 'Milieu offensif': 'MO',
  'Milieu gauche': 'MG', 'Milieu droit': 'MD', Attaquant: 'ATT', 'Ailier gauche': 'AG',
  'Ailier droit': 'AD', 'Avant-centre': 'AC', 'Second attaquant': 'SA', Entraîneur: 'ENT',
};

export function positionLabelFr(name: string): string {
  const key = name.trim().toLowerCase();
  if (!key) return name;
  return LONG_FR[key] ?? LONG_FR_BY_CODE[key] ?? name;
}

export function positionShortFr(value: string): string {
  const key = value.trim().toLowerCase();
  if (SHORT_FR[key]) return SHORT_FR[key];
  const long = LONG_FR[key];
  return (long && SHORT_BY_LONG_FR[long]) ?? value;
}

const GROUPE: Record<string, string> = {
  // libellés de ligne de 365scores (champ `position` de la feuille de match, toujours présent)
  'gardien de but': 'GK', 'milieu de terrain': 'MID', attaquant: 'ATK', défenseur: 'DEF',
  goalkeeper: 'GK', defender: 'DEF', midfielder: 'MID', attacker: 'ATK', forward: 'ATK',
  // codes courts
  gk: 'GK',
  def: 'DEF', cb: 'DEF', lb: 'DEF', rb: 'DEF', lwb: 'DEF', rwb: 'DEF',
  mid: 'MID', dm: 'MID', cm: 'MID', am: 'MID', lm: 'MID', rm: 'MID',
  atk: 'ATK', fw: 'ATK', lw: 'ATK', rw: 'ATK', cf: 'ATK', ss: 'ATK', st: 'ATK',
  // `positionShort` de la feuille porte aussi des libellés longs (formation.shortName)
  'centre back': 'DEF', 'center back': 'DEF', 'centre-back': 'DEF', 'left back': 'DEF', 'right back': 'DEF',
  'left wing back': 'DEF', 'right wing back': 'DEF',
  'defensive midfield': 'MID', 'central midfield': 'MID', 'attacking midfield': 'MID', 'left midfield': 'MID', 'right midfield': 'MID',
  'left forward': 'ATK', 'right forward': 'ATK', 'centre forward': 'ATK', 'left winger': 'ATK', 'right winger': 'ATK',
  'second striker': 'ATK', striker: 'ATK',
};

/**
 * Poste d'un joueur de la feuille de match ramené à l'une des quatre lignes (GK, DEF, MID, ATK) que portent les joueurs
 * des stats de saison. La ligne se lit d'abord dans `position` (« Defender »), puis dans `positionShort`, qui peut être
 * un code (CB) ou un libellé long (« Centre Back ») ; un poste inconnu est rendu tel quel (`positionShort`).
 */
export function positionGroup(position: string, positionShort = ''): string {
  return GROUPE[position.trim().toLowerCase()] ?? GROUPE[positionShort.trim().toLowerCase()] ?? (positionShort || position);
}
