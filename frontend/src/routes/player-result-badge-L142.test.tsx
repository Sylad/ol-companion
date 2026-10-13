import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// L142 — badges V/N/D de la fiche joueur : texte en jeton -fg (L138), ≥ 4,5:1 sur leur teinte à 10 % (WCAG 1.4.3).

const css = readFileSync(resolve(__dirname, '../index.css'), 'utf8');
const src = readFileSync(resolve(__dirname, './player.$athleteId.tsx'), 'utf8');
const token = (n: string): [number, number, number] => {
  const m = css.match(new RegExp(`--${n}:\\s*(\\d+)\\s+(\\d+)%\\s+(\\d+)%`));
  if (!m) throw new Error(`jeton --${n} introuvable`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
};
const rgb = ([h, s, l]: [number, number, number]) => {
  const S = s / 100, L = l / 100, a = S * Math.min(L, 1 - L);
  const f = (n: number) => { const k = (n + h / 30) % 12; return 255 * (L - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))); };
  return [f(0), f(8), f(4)];
};
const lum = (c: number[]) => {
  const [r, g, b] = c.map((v) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: number[], b: number[]) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

describe('L142 — badges de résultat de la fiche joueur', () => {
  it.each(['win', 'draw', 'loss'])('le badge %s utilise le jeton -fg', (t) => {
    const badge = src.slice(src.indexOf('function ResultBadge'), src.indexOf('interface SparkPoint'));
    expect(badge).toContain(`text-${t}-fg`);
    expect(badge).not.toMatch(new RegExp(`text-${t}(?!-)[\\s'"]`));
  });
  it.each(['win', 'draw', 'loss'])('texte %s-fg ≥ 4,5:1 sur sa teinte à 10 %% (carte ou surface-2)', (t) => {
    for (const s of ['surface', 'surface-2']) {
      const surface = rgb(token(s));
      const bg = rgb(token(t)).map((v, i) => 0.9 * surface[i] + 0.1 * v);
      expect(contrast(rgb(token(`${t}-fg`)), bg)).toBeGreaterThanOrEqual(4.5);
    }
  });
});
