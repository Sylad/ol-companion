import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  RESULT_COLORS,
  RESULT_OUTLINE,
  resultGlyph,
} from './ligue1-map-colors';
import { contrastRatio, hslTokenToRgb, parseHsl } from './contrast';

// L191 — revue UX L10 : contrastes mesurés de la Carte L1 (WCAG 1.4.3 / 1.4.11) et
// moitiés de marqueur distinguables sans la couleur (WCAG 1.4.1).
const css = readFileSync(resolve(__dirname, '../index.css'), 'utf8');
const root = css.match(/:root\s*\{[^}]*\}/)![0];
const token = (name: string) => {
  const m = root.match(new RegExp(`--${name}:\\s*([^;]+);`));
  if (!m) throw new Error(`jeton --${name} introuvable`);
  return hslTokenToRgb(m[1].trim());
};
const surface = token('surface');

describe('Carte L1 — contrastes (L191)', () => {
  it('R1 — les chiffres V et D du bilan de la popup lisent ≥ 4,5:1 sur le fond de la bulle', () => {
    const src = readFileSync(resolve(__dirname, '../components/ligue1-map.tsx'), 'utf8');
    const bilan = src.match(/Bilan OL[\s\S]*?<\/div>\s*\)\}/)![0];
    expect(bilan).toContain('text-ol-blue-fg');
    expect(bilan).toContain('text-loss-fg');
    expect(contrastRatio(token('ol-blue-fg'), surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(token('loss-fg'), surface)).toBeGreaterThanOrEqual(4.5);
  });

  it("R2 — les liens d'attribution Leaflet battent leaflet.css (plus spécifique) et lisent ≥ 4,5:1", () => {
    const rule = css.match(/([^{}]*attribution a[^{}]*)\{([^{}]*)\}/)!;
    const classes = (rule[1].match(/\.[\w-]+/g) ?? []).length;
    expect(classes).toBeGreaterThanOrEqual(2); // leaflet.css : `.leaflet-container a` = 1 classe + 1 balise
    expect(rule[2]).toContain('--ol-blue-fg');
    expect(contrastRatio(token('ol-blue-fg'), surface)).toBeGreaterThanOrEqual(4.5);
  });

  it("R3 — chaque pastille de légende fait ≥ 3:1 sur le fond, par sa couleur ou par son contour", () => {
    for (const [result, color] of Object.entries(RESULT_COLORS)) {
      const fill = contrastRatio(parseHsl(color), surface);
      const outline = contrastRatio(parseHsl(RESULT_OUTLINE), surface);
      expect(Math.max(fill, outline), result).toBeGreaterThanOrEqual(3);
    }
  });

  it('R3 — les teintes pleines (V, N, D) lisent ≥ 3:1 sur le fond', () => {
    for (const r of ['W', 'D', 'L'] as const) {
      expect(contrastRatio(parseHsl(RESULT_COLORS[r]), surface), r).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('Carte L1 — moitiés de marqueur sans la couleur (L191)', () => {
  it('R4 — chaque résultat a un motif propre, deux à deux différents', () => {
    const motifs = (['W', 'D', 'L', 'FUTURE'] as const).map((r) => resultGlyph(r, 7));
    expect(new Set(motifs).size).toBe(4);
  });
});
