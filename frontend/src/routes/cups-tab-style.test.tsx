import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';
import baseConfig from '../../tailwind.config';
import type { CupInfo } from '@/types/api';

// L112 — l'onglet actif de la page Coupes n'avait pas de fond : `bg-ol-red/12` n'est pas
// une classe que Tailwind génère (opacités 0, 5, 10, 15…). Vitest tourne sans CSS : on
// génère ici le CSS Tailwind réel du projet et on lit le fond calculé de chaque classe.

const cups: CupInfo[] = [
  { competitionId: 573, name: 'Ligue Europa', currentStageFr: 'Phase de ligue', isEliminated: false, matches: [] },
];
vi.mock('@/hooks/use-cups', () => ({
  useCups: () => ({ data: cups, isLoading: false, isError: false }),
}));
vi.mock('@/components/knowledge-header', () => ({ KnowledgeHeader: () => null }));
vi.mock('@/components/bracket', () => ({ Bracket: () => null }));
vi.mock('@/components/cup-match-row', () => ({ CupMatchRow: () => null }));

import { CupsPage } from './cups';

async function generatedCss(classes: string[]): Promise<string> {
  const result = await postcss([
    tailwindcss({
      ...baseConfig,
      content: [{ raw: classes.join(' ') }],
    }),
  ]).process('@tailwind utilities;', { from: undefined });
  return result.css;
}

// Sélecteur CSS échappé (`\/`), lui-même échappé pour la RegExp.
const esc = (cls: string) => cls.replace(/[/:.]/g, (c) => `\\\\${c}`);

describe('<CupsPage /> — fond de l’onglet actif (L112)', () => {
  it('chaque classe de fond de l’onglet actif est générée, avec une couleur calculée', async () => {
    render(<CupsPage />);
    const tab = screen.getByRole('button', { pressed: true });
    const bgClasses = tab.className.split(/\s+/).filter((c) => c.startsWith('bg-'));
    expect(bgClasses.length).toBeGreaterThan(0);

    const css = await generatedCss(bgClasses);
    for (const cls of bgClasses) {
      const rule = new RegExp(`\\.${esc(cls)}\\s*\\{[^}]*background-color:\\s*hsl\\([^}]+\\}`);
      expect(css, `classe ${cls} non générée par Tailwind`).toMatch(rule);
    }
  });

  it('garde-fou : une opacité hors échelle (bg-ol-red/12) ne produit aucun fond', async () => {
    const css = await generatedCss(['bg-ol-red/12']);
    expect(css).not.toContain('background-color');
  });

  // WCAG 1.4.3 : les deux textes les plus fragiles de l'onglet actif, mesurés dans le
  // navigateur (1440 px) — pastille « En lice » (10 px gras) et sous-titre (text-xs, fg-dim).
  it('les textes fragiles de l’onglet actif restent ≥ 4,5:1 sur le fond calculé', async () => {
    render(<CupsPage />);
    const tab = screen.getByRole('button', { pressed: true });
    const bgClasses = tab.className.split(/\s+/).filter((c) => c.startsWith('bg-'));
    const css = await generatedCss(bgClasses);

    const section: Rgb = [16, 18, 25]; // fond de section mesuré
    const olRed: Rgb = [221, 34, 34]; // --ol-red 0 73% 50%
    let bg = section;
    for (const cls of bgClasses) {
      const m = css.match(new RegExp(`\\.${esc(cls)}\\s*\\{[^}]*?/\\s*([0-9.]+)\\)`));
      expect(m, `alpha de ${cls} introuvable`).not.toBeNull();
      const a = Number(m![1]);
      bg = bg.map((c, i) => olRed[i] * a + c * (1 - a)) as Rgb;
    }
    const pastille: Rgb = [239, 67, 67]; // --ol-red-bright
    const sousTitre: Rgb = [116, 132, 154]; // --fg-dim
    expect(contrast(pastille, bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(sousTitre, bg)).toBeGreaterThanOrEqual(4.5);
  });
});

type Rgb = [number, number, number];
function luminance(c: Rgb): number {
  const [r, g, b] = c.map((v) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a: Rgb, b: Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
