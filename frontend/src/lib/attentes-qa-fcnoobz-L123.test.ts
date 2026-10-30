import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// L123 — docs/qa/expectations.md décrit /fcnoobz (4 cartes, tuile Jeux vidéo en tête) et /fcnoobz/jeux-video.

const attentes = readFileSync(resolve(__dirname, '../../../docs/qa/expectations.md'), 'utf8');

function section(titre: string): string[] {
  const lignes = attentes.split('\n');
  const debut = lignes.findIndex((l) => l === `## ${titre}`);
  if (debut < 0) return [];
  const fin = lignes.findIndex((l, i) => i > debut && l.startsWith('## '));
  return lignes.slice(debut + 1, fin < 0 ? undefined : fin).filter((l) => l.trim() !== '');
}

describe('Attentes QA — /fcnoobz et /fcnoobz/jeux-video (L123)', () => {
  const fc = section('/fcnoobz').join('\n');
  const jv = section('/fcnoobz/jeux-video');

  it('L123 — /fcnoobz attend 4 cartes, dont la tuile Jeux vidéo, un lien, en tête et en pleine largeur', () => {
    expect(fc).toContain('4 cartes');
    expect(fc).not.toContain('3 cartes');
    expect(fc).toContain('Jeux vidéo');
    expect(fc).toMatch(/lien vers \/fcnoobz\/jeux-video/);
    expect(fc).toMatch(/en tête[^;]*pleine largeur[^;]*au-dessus des 3 tuiles/);
    for (const nom of ['Lecteur de sauvegarde FM', 'Histoire du club', 'Palmarès virtuel']) expect(fc).toContain(nom);
  });

  it('L123 — /fcnoobz/jeux-video existe, juste après /fcnoobz, avec shows, never et api', () => {
    const titres = attentes.split('\n').filter((l) => l.startsWith('## '));
    expect(titres.indexOf('## /fcnoobz/jeux-video')).toBe(titres.indexOf('## /fcnoobz') + 1);
    expect(jv.some((l) => l.startsWith('- shows:'))).toBe(true);
    expect(jv.some((l) => l.startsWith('- never:'))).toBe(true);
    expect(jv.some((l) => l.startsWith('- api: /jeux-video-data/football-manager.json'))).toBe(true);
  });

  it('L123 — la ligne shows nomme le h1, les 4 blocs et la ligne de vérification', () => {
    const shows = jv.find((l) => l.startsWith('- shows:')) ?? '';
    expect(shows).toContain('« Jeux vidéo »');
    for (const bloc of ['Prochaine sortie', 'Éditions précédentes', 'Nouveautés annoncées', 'La série']) {
      expect(shows).toContain(bloc);
    }
    expect(shows).toContain('Infos vérifiées le');
    expect(shows).toContain('footballmanager.com');
  });

  it('L123 — la ligne never nomme les états de chargement, d’erreur et vide, et la date manquante', () => {
    const never = jv.find((l) => l.startsWith('- never:')) ?? '';
    for (const etat of ['Chargement de Football Manager…', 'Réessayer', 'Aucune info Football Manager pour le moment.', 'Date à confirmer']) {
      expect(never).toContain(etat);
    }
  });
});
