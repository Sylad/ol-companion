// L121 — liste blanche du fichier public /fcnoobz-data/carrieres.json (fiche fcnoobz-carrieres, R7).
// Partagée par l'import local (fcnoobz-import.mjs) et son test : tout champ hors de ces listes est refusé,
// pour qu'aucun nom de joueur, aucune finance ni aucune donnée brute de sauvegarde ne parte sur Internet.

export const CHAMPS_RACINE = ['releveLe', 'editions'];
export const CHAMPS_EDITION = ['edition', 'clubs'];
export const CHAMPS_CLUB = ['club', 'saisons'];
export const CHAMPS_SAISON = ['saison', 'division', 'place', 'titres', 'enCours', 'provenance'];
export const PROVENANCES = ['sauvegarde', 'saisie'];

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const SAISON = /^(\d{4})(?:-(\d{4}))?$/;

const estObjet = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const texte = (v) => typeof v === 'string' && v.trim() !== '' && v.length <= 80;

function champsEnTrop(objet, permis, ou, erreurs) {
  for (const cle of Object.keys(objet)) if (!permis.includes(cle)) erreurs.push(`${ou} : champ hors liste blanche « ${cle} »`);
}

const placeValide = (p) => p === undefined || p === null || (Number.isInteger(p) && p >= 1 && p <= 99);
const titresValides = (t) => t === undefined || (Array.isArray(t) && t.every(texte));

function saisonValide(v) {
  const m = typeof v === 'string' ? SAISON.exec(v) : null;
  return !!m && (!m[2] || +m[2] === +m[1] + 1);
}

function validerSaison(s, ou, erreurs) {
  if (!estObjet(s)) return void erreurs.push(`${ou} : objet attendu`);
  champsEnTrop(s, CHAMPS_SAISON, ou, erreurs);
  const controles = [
    [saisonValide(s.saison), 'saison : « AAAA » ou « AAAA-AAAA+1 » attendu'],
    [texte(s.division), 'division : texte attendu'],
    [placeValide(s.place), 'place : entier de 1 à 99 ou null'],
    [titresValides(s.titres), 'titres : liste de textes attendue'],
    [s.enCours === undefined || typeof s.enCours === 'boolean', 'enCours : booléen attendu'],
    [PROVENANCES.includes(s.provenance), `provenance : ${PROVENANCES.join(' ou ')}`],
  ];
  for (const [ok, message] of controles) if (!ok) erreurs.push(`${ou}.${message}`);
}

/** Rend la liste des écarts à la liste blanche (vide = fichier publiable). */
export function validerCarrieres(data) {
  const erreurs = [];
  if (!estObjet(data)) return ['racine : objet attendu'];
  champsEnTrop(data, CHAMPS_RACINE, 'racine', erreurs);
  if (data.releveLe !== null && !(typeof data.releveLe === 'string' && ISO.test(data.releveLe))) erreurs.push('releveLe : AAAA-MM-JJ ou null');
  if (!Array.isArray(data.editions)) return [...erreurs, 'editions : liste attendue'];
  data.editions.forEach((e, i) => {
    const ou = `editions[${i}]`;
    if (!estObjet(e)) return void erreurs.push(`${ou} : objet attendu`);
    champsEnTrop(e, CHAMPS_EDITION, ou, erreurs);
    if (!(Number.isInteger(e.edition) && e.edition >= 5 && e.edition <= 99)) erreurs.push(`${ou}.edition : numéro (21, 26…) attendu`);
    if (!Array.isArray(e.clubs)) return void erreurs.push(`${ou}.clubs : liste attendue`);
    e.clubs.forEach((c, j) => {
      const ouc = `${ou}.clubs[${j}]`;
      if (!estObjet(c)) return void erreurs.push(`${ouc} : objet attendu`);
      champsEnTrop(c, CHAMPS_CLUB, ouc, erreurs);
      if (!texte(c.club)) erreurs.push(`${ouc}.club : texte attendu`);
      if (!Array.isArray(c.saisons)) return void erreurs.push(`${ouc}.saisons : liste attendue`);
      c.saisons.forEach((s, k) => validerSaison(s, `${ouc}.saisons[${k}]`, erreurs));
    });
  });
  if (data.releveLe === null && data.editions.length > 0) erreurs.push('releveLe : date du relevé obligatoire dès qu’une édition est publiée');
  return erreurs;
}
