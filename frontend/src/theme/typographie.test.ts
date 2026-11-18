// L258 — une seule échelle de tailles de texte, en rem, définie dans src/theme/typographie.ts (revue UX L255, M3).
// Ce test refuse toute taille de texte en px (ou taille arbitraire) écrite ailleurs dans src/.
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { cn } from '@/lib/utils';
import { NOMS_TAILLES, TAILLE, TAILLE_AFFICHE, TAILLE_APPOINT, TAILLES_NOM_PASTILLE, fontSizeTailwind } from './typographie';
import config from '../../tailwind.config';

const SRC = path.resolve(import.meta.dirname, '..');
const THEME = path.join(SRC, 'theme', 'typographie.ts');

function fichiers(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = path.join(dir, n);
    if (statSync(p).isDirectory()) return fichiers(p);
    return /\.(tsx?|css)$/.test(n) && !/\.(test|spec)\.tsx?$/.test(n) && p !== THEME ? [p] : [];
  });
}

/** Motifs interdits hors du thème : chacun écrit une taille de texte qui n'est pas un pas de l'échelle. */
const INTERDITS: Array<[string, RegExp]> = [
  ['classe Tailwind de taille arbitraire (text-[…px], text-[…rem]…)', /\btext-\[\s*(?:length:)?-?[\d.]+(?:px|rem|em|pt|vw|vh)\s*\]/g],
  ['font-size en px (CSS)', /font-size\s*:[^;}\n]*\d(?:\.\d+)?px/g],
  ['fontSize numérique (px implicites : React, Recharts)', /fontSize\s*[:=]\s*\d/g],
  ['fontSize en px dans une chaîne', /fontSize\s*[:=][^,;}\n]*\d(?:\.\d+)?px/g],
];

describe('L258 — aucune taille de texte en px hors du thème', () => {
  const liste = fichiers(SRC);
  it('le balayage voit les sources (garde-fou du test lui-même)', () => {
    expect(liste.length).toBeGreaterThan(50);
    expect(liste.some((f) => f.endsWith('index.css'))).toBe(true);
  });
  for (const [quoi, motif] of INTERDITS)
    it(`aucun(e) ${quoi}`, () => {
      const trouves = liste.flatMap((f) => {
        const texte = readFileSync(f, 'utf8');
        return [...texte.matchAll(motif)].map((m) => `${path.relative(SRC, f)}:${texte.slice(0, m.index).split('\n').length} ${m[0]}`);
      });
      expect(trouves).toEqual([]);
    });
});

const rem = (v: string) => {
  expect(v).toMatch(/^\d+(\.\d+)?rem$/);
  return parseFloat(v) * 16;
};

describe('L258 — l’échelle du thème', () => {
  it('petite / moyenne / grande = 12 / 14 / 16 px à la racine par défaut, en rem', () => {
    expect(Object.values(TAILLE).map(rem)).toEqual([12, 14, 16]);
  });
  it('aucun pas sous 12 px, tout en rem', () => {
    for (const v of Object.values(TAILLE_APPOINT)) expect(rem(v)).toBeGreaterThanOrEqual(12);
    for (const [v] of Object.values(TAILLE_AFFICHE)) expect(rem(v)).toBeGreaterThanOrEqual(12);
  });
  it('noms de joueurs en pastille (seule exception, à la mesure) : départ à 12 px, pas de 0,5 px, plancher 8 px', () => {
    expect(TAILLES_NOM_PASTILLE.map(rem)).toEqual([12, 11.5, 11, 10.5, 10, 9.5, 9, 8.5, 8]);
  });
  it('Tailwind lit l’échelle du thème', () => {
    expect(config.theme?.extend?.fontSize).toBe(fontSizeTailwind);
  });
  it('tailwind-merge range les tailles du thème parmi les tailles (pas les couleurs)', () => {
    for (const n of NOMS_TAILLES) expect(cn(`text-${n}`, 'text-fg-dim').split(' ')).toEqual([`text-${n}`, 'text-fg-dim']);
    expect(cn('text-petite', 'text-sm')).toBe('text-sm');
  });
  it('la racine reste à 100 % (la taille choisie dans le navigateur)', () => {
    const css = readFileSync(path.join(SRC, 'index.css'), 'utf8');
    expect(css).toMatch(/html\s*\{[^}]*font-size:\s*100%/);
  });
});
