/**
 * L269 — coupure d'un nom de joueur trop large pour sa pastille, DERNIER RECOURS de la composition de /match (quand
 * même en laissant chaque pastille prendre la largeur de son nom, une rangée ne tient pas sur une ligne). Le nom garde
 * 12 px (plancher L258/L261) ; il se coupe entre deux syllabes, avec un trait d'union visible, par des césures douces
 * (U+00AD) que le navigateur n'utilise que si le morceau ne tient pas. Fonctions pures : la mesure est passée en paramètre.
 */

export const CESURE = '­';

/** Morceaux d'un nom tels qu'il se coupe sans césure : à l'espace, ou après un tiret (le tiret reste au bout du morceau). */
export const morceaux = (nom: string) => nom.split(/\s+/).flatMap((m) => m.split(/(?<=-)/)).filter(Boolean);

const LETTRE = /\p{L}/u;
const VOYELLE = /[aeiouyàâäáãåæéèêëíìîïıóòôöõøœúùûüÿ]/i;
/** Groupes de deux consonnes qui ne se séparent pas (« Ri-chard », « Athe-kame », jamais « At-hekame »). */
const DIGRAMMES = new Set(['ch', 'ph', 'th', 'sh', 'gh', 'gn', 'ck', 'qu']);
/** Consonne suivie de l ou r qui ouvre une syllabe (« San-dro », « Ta-bla »). */
const ATTAQUES = /^[bcdfgkptv][lr]$/i;

const estVoyelle = (c: string | undefined) => !!c && VOYELLE.test(c);
const estConsonne = (c: string | undefined) => !!c && LETTRE.test(c) && !VOYELLE.test(c);

/**
 * Positions de coupure syllabique d'un mot (indice du caractère qui ouvre la nouvelle ligne) : avant une consonne suivie
 * d'une voyelle (« Alex-sandro », « Haralds-son »), avant un digramme ou une attaque consonne + l/r suivis d'une voyelle,
 * jamais au milieu d'un digramme ; au moins 2 lettres avant la coupure et 3 après.
 */
export function coupuresSyllabiques(mot: string): number[] {
  const c = Array.from(mot);
  const positions: number[] = [];
  for (let i = 2; i <= c.length - 3; i++) {
    if (!LETTRE.test(c[i - 1]) || !estConsonne(c[i])) continue;
    const paire = (c[i - 1] + c[i]).toLowerCase();
    if (DIGRAMMES.has(paire)) continue;
    const suivante = (c[i] + c[i + 1]).toLowerCase();
    const ouvre =
      estVoyelle(c[i + 1]) ||
      ((DIGRAMMES.has(suivante) || ATTAQUES.test(suivante)) && estVoyelle(c[i + 2]));
    // Une attaque (« dr ») se coupe avant, pas entre ses deux consonnes : « San-dro », pas « Sand-ro ».
    if (ouvre && !(ATTAQUES.test(paire) && estVoyelle(c[i + 1]))) positions.push(i);
  }
  return positions;
}

/** Toutes les positions qui laissent au moins 2 caractères de chaque côté (quand une syllabe seule est trop large). */
export function coupuresPartout(mot: string): number[] {
  const n = Array.from(mot).length;
  return Array.from({ length: Math.max(0, n - 3) }, (_, k) => k + 2);
}

/** Insère une césure douce à chaque position. */
export function avecCesures(mot: string, positions: number[]): string {
  const c = Array.from(mot);
  const ici = new Set(positions);
  return c.map((ch, i) => (ici.has(i) ? CESURE + ch : ch)).join('');
}

const segments = (mot: string, positions: number[]) => {
  const c = Array.from(mot);
  const bornes = [0, ...positions, c.length];
  return bornes.slice(1).map((fin, k) => c.slice(bornes[k], fin).join('') + (fin < c.length ? '-' : ''));
};

/**
 * Nom à afficher dans une pastille de `place` px utiles : chaque morceau qui tient est gardé tel quel ; un morceau trop
 * large reçoit des césures syllabiques, ou des césures partout si une de ses syllabes (trait d'union compris) ne tient
 * pas non plus. `mesure` rend la largeur d'un texte à 12 px.
 */
export function nomCoupe(nom: string, mesure: (texte: string) => number, place: number): string {
  return nom
    .split(/(\s+)/)
    .map((mot) => {
      if (!mot.trim()) return mot;
      return mot
        .split(/(?<=-)/)
        .map((m) => {
          if (mesure(m) <= place + 0.5) return m;
          const syll = coupuresSyllabiques(m);
          const ok = syll.length > 0 && segments(m, syll).every((s) => mesure(s) <= place + 0.5);
          return avecCesures(m, ok ? syll : coupuresPartout(m));
        })
        .join('');
    })
    .join('');
}

/**
 * Largeur minimale d'un nom (min-content) : son morceau le plus large ; un morceau qui porte des césures douces vaut sa
 * syllabe la plus large, trait d'union compris.
 */
export function largeurMin(nom: string, mesure: (texte: string) => number): number {
  return Math.max(
    0,
    ...morceaux(nom).flatMap((m) => {
      const parts = m.split(CESURE);
      return parts.map((s, k) => mesure(s + (k < parts.length - 1 ? '-' : '')));
    }),
  );
}

/**
 * Une rangée tient sur une ligne si la somme des largeurs minimales de ses pastilles (nom + padding et bordures) et des
 * écarts de 4 px ne dépasse pas la largeur de la rangée.
 */
export function rangeeTient(noms: string[], mesure: (texte: string) => number, bords: number, rangee: number): boolean {
  const besoin = noms.reduce((t, nom) => t + largeurMin(nom, mesure) + bords, 0) + (noms.length - 1) * 4;
  return besoin <= rangee + 0.5;
}

/**
 * Noms d'une rangée, coupés au minimum pour qu'elle tienne sur une ligne : tant qu'elle ne tient pas, le nom le plus
 * large pas encore coupé reçoit ses césures (`nomCoupe`, pour une pastille de `place` px utiles). Une rangée qui tient
 * revient telle quelle.
 */
export function nomsDeRangee(noms: string[], mesure: (texte: string) => number, bords: number, rangee: number, place: number): string[] {
  const out = [...noms];
  const coupes = new Set<number>();
  while (!rangeeTient(out, mesure, bords, rangee)) {
    let k = -1;
    for (let i = 0; i < out.length; i++) {
      if (!coupes.has(i) && (k < 0 || largeurMin(out[i], mesure) > largeurMin(out[k], mesure))) k = i;
    }
    if (k < 0) break;
    coupes.add(k);
    out[k] = nomCoupe(noms[k], mesure, place);
  }
  return out;
}
