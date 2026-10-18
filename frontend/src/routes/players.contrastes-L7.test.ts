import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { contrast, token, type Rgb } from '@/test/contraste';
import { ratingColor, ratingTextColor } from '@/components/formation-field';

// L7/t2 — contrastes de la page Joueurs et de la fiche (WCAG 1.4.3 texte ≥ 4,5:1, 1.4.11 tracé ≥ 3:1).
// L'échelle des notes (vert/jaune/orange/rouge) est gardée : seul le chiffre change de couleur.

const read = (p: string) => readFileSync(resolve(__dirname, p), 'utf8');
const hex = (h: string): Rgb => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as Rgb;
const surface = token('surface');

describe('L7/t2 — contrastes Joueurs', () => {
  it.each([9, 8, 7.4, 6.2, 5.5, 4.2])('chiffre de la pastille de note %s ≥ 4,5:1 sur sa couleur', (note) => {
    expect(contrast(hex(ratingTextColor(note)), hex(ratingColor(note)))).toBeGreaterThanOrEqual(4.5);
  });

  it('l’échelle des couleurs de notes est conservée', () => {
    expect([8, 7, 6, 5, 4].map(ratingColor)).toEqual(['#16a34a', '#65a30d', '#ca8a04', '#ea580c', '#dc2626']);
  });

  it('badge de formation : blanc sur --ol-red-deep ≥ 4,5:1, et le badge l’utilise', () => {
    expect(contrast([255, 255, 255], token('ol-red-deep'))).toBeGreaterThanOrEqual(4.5);
    expect(read('../components/formation-field.tsx')).toContain('bg-ol-red-deep');
  });

  it('« min total » : --ol-blue-fg ≥ 4,5:1 sur la carte, utilisé par la fiche', () => {
    expect(contrast(token('ol-blue-fg'), surface)).toBeGreaterThanOrEqual(4.5);
    expect(read('./player.$athleteId.tsx')).toContain('text-ol-blue-fg');
  });

  it('courbe des minutes : bleu vif OL ≥ 3:1 sur la carte (tracé, 1.4.11)', () => {
    const src = read('./player.$athleteId.tsx');
    expect(src).toMatch(/<Sparkline series=\{minutesSeries\} color=\{OL_BLUE_BRIGHT\}/);
    expect(contrast(token('ol-blue-bright'), surface)).toBeGreaterThanOrEqual(3);
  });

  it('messages d’erreur en text-loss-fg ≥ 4,5:1 (jamais text-loss seul)', () => {
    for (const f of ['./players.tsx', './player.$athleteId.tsx']) {
      expect(read(f)).not.toMatch(/text-loss(?!-)/);
    }
    for (const fond of ['bg', 'surface']) {
      expect(contrast(token('loss-fg'), token(fond))).toBeGreaterThanOrEqual(4.5);
    }
  });
});
