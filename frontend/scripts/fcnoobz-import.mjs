#!/usr/bin/env node
// L121 — import local des carrières Football Manager (Big-Blue), étude L120 § 5.
//
//   node scripts/fcnoobz-import.mjs <relevé.json> [<relevé.json>…] [--releve AAAA-MM-JJ] [--sortie <fichier>]
//
// Chaque relevé suit le schéma de public/fcnoobz-data/carrieres.json (sans releveLe) : une saisie à la main
// (FM21 à FM24, titres) ou un résumé tiré d'une sauvegarde (provenance « sauvegarde »). Les relevés sont
// fusionnés (un relevé plus loin dans la liste remplace la même saison d'un club d'une édition), triés, vérifiés
// contre la liste blanche (fcnoobz-carrieres-schema.mjs) puis écrits dans public/fcnoobz-data/carrieres.json.
// Rien n'est lu d'une sauvegarde ici, rien n'est envoyé : le fichier écrit se relit puis se commite à la main.
// Exemple de relevé (valeurs fabriquées) : scripts/fcnoobz-releve-exemple.json.
// Un relevé hors liste blanche (nom de joueur, finance…) fait échouer l'import (code 1) sans rien écrire.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validerCarrieres } from './fcnoobz-carrieres-schema.mjs';

const ICI = dirname(fileURLToPath(import.meta.url));
export const SORTIE_PAR_DEFAUT = resolve(ICI, '../public/fcnoobz-data/carrieres.json');

const debutSaison = (s) => Number.parseInt(s.saison, 10);

/** Fusionne des relevés en un fichier publiable trié (éditions récentes en tête, saisons chronologiques). */
export function fusionnerReleves(releves, releveLe) {
  const editions = new Map();
  for (const r of releves) {
    for (const e of r.editions ?? []) {
      const clubs = editions.get(e.edition) ?? new Map();
      editions.set(e.edition, clubs);
      for (const c of e.clubs ?? []) {
        const saisons = clubs.get(c.club) ?? new Map();
        clubs.set(c.club, saisons);
        for (const s of c.saisons ?? []) saisons.set(s.saison, s);
      }
    }
  }
  return {
    releveLe: editions.size > 0 ? releveLe : null,
    editions: [...editions.entries()]
      .sort(([a], [b]) => b - a)
      .map(([edition, clubs]) => ({
        edition,
        clubs: [...clubs.entries()].map(([club, saisons]) => ({
          club,
          saisons: [...saisons.values()].sort((a, b) => debutSaison(a) - debutSaison(b)),
        })),
      })),
  };
}

function aujourdhui() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' });
}

export function main(argv) {
  const fichiers = [];
  let releveLe = aujourdhui();
  let sortie = SORTIE_PAR_DEFAUT;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--releve') releveLe = argv[++i];
    else if (argv[i] === '--sortie') sortie = resolve(argv[++i]);
    else fichiers.push(argv[i]);
  }
  if (fichiers.length === 0) {
    console.error('usage : node scripts/fcnoobz-import.mjs <relevé.json> [<relevé.json>…] [--releve AAAA-MM-JJ] [--sortie <fichier>]');
    return 2;
  }
  const releves = [];
  for (const f of fichiers) {
    const r = JSON.parse(readFileSync(f, 'utf8'));
    // Chaque relevé est vérifié seul, pour nommer le fichier fautif.
    const erreurs = validerCarrieres({ releveLe: null, ...r, ...(r.editions?.length ? { releveLe } : {}) });
    if (erreurs.length > 0) {
      console.error(`${f} : refusé\n  ${erreurs.join('\n  ')}`);
      return 1;
    }
    releves.push(r);
  }
  const data = fusionnerReleves(releves, releveLe);
  const erreurs = validerCarrieres(data);
  if (erreurs.length > 0) {
    console.error(`résultat refusé\n  ${erreurs.join('\n  ')}`);
    return 1;
  }
  mkdirSync(dirname(sortie), { recursive: true });
  writeFileSync(sortie, `${JSON.stringify(data, null, 2)}\n`);
  const saisons = data.editions.flatMap((e) => e.clubs.flatMap((c) => c.saisons)).length;
  console.log(`${sortie} : ${data.editions.length} édition(s), ${saisons} saison(s), relevé du ${data.releveLe ?? '—'} ; à relire avant de commiter.`);
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(main(process.argv.slice(2)));
