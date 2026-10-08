import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// L52 — --fg-dim servait des textes de 10-11 px à 3,84–3,98:1 (sous le 4,5:1 de
// WCAG 1.4.3). Le jeton est lu dans index.css et mesuré sur les trois fonds.
const css = readFileSync(resolve(__dirname, '../index.css'), 'utf8');

function token(name: string): [number, number, number] {
  const m = css.match(new RegExp(`--${name}:\\s*(\\d+(?:\\.\\d+)?)\\s+(\\d+(?:\\.\\d+)?)%\\s+(\\d+(?:\\.\\d+)?)%`));
  if (!m) throw new Error(`jeton --${name} introuvable`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function toRgb([h, s, l]: [number, number, number]): number[] {
  const sat = s / 100;
  const lig = l / 100;
  const a = sat * Math.min(lig, 1 - lig);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return lig - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [f(0), f(8), f(4)];
}

function luminance(rgb: number[]): number {
  const [r, g, b] = rgb.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: number[], b: number[]): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe('fg-dim (L52)', () => {
  const dim = toRgb(token('fg-dim'));

  it('vaut environ rgb(115,131,153)', () => {
    dim.forEach((v, i) => expect(Math.abs(v * 255 - [115, 131, 153][i])).toBeLessThan(2));
  });

  it.each(['bg', 'surface', 'surface-2'])('atteint 4,5:1 sur --%s', (fond) => {
    expect(contrast(dim, toRgb(token(fond)))).toBeGreaterThanOrEqual(4.5);
  });
});

// Un fond teinté par le jeton lui-même (bg-fg-dim/NN) fait tomber le texte
// text-fg-dim à 4,12:1 : le badge « Éliminé » de /cups n'en porte pas.
describe('fg-dim sur fond teinté (L52)', () => {
  it('le badge « Éliminé » de /cups n’est pas posé sur bg-fg-dim/NN', () => {
    const src = readFileSync(resolve(__dirname, '../routes/cups.tsx'), 'utf8');
    const badge = src.match(/text-\[10px\][^\n]*\n[^\n]*isEliminated\n([^\n]*)/);
    expect(badge).not.toBeNull();
    expect(badge![1]).toContain('text-fg-dim');
    expect(badge![1]).not.toMatch(/bg-fg-dim\/\d+/);
  });
});

// Repli « OL » du logo de l'en-tête : 16 px gras posé sur bg-white/5 au-dessus
// du halo rouge de la page (mesuré rgb(50,25,30)) → fg-dim y faisait 4,26:1.
describe('repli « OL » de l’en-tête (L52)', () => {
  it('n’utilise pas fg-dim, et fg-muted tient 4,5:1 sur le halo mesuré', () => {
    const src = readFileSync(resolve(__dirname, '../components/knowledge-header.tsx'), 'utf8');
    const fallback = src.match(/<span className="([^"]*)">OL<\/span>/);
    expect(fallback).not.toBeNull();
    expect(fallback![1]).not.toContain('text-fg-dim');
    expect(fallback![1]).toContain('text-fg-muted');
    const halo = [50 / 255, 25 / 255, 30 / 255];
    expect(contrast(toRgb(token('fg-muted')), halo)).toBeGreaterThanOrEqual(4.5);
  });
});
