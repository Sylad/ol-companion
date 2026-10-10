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
});
