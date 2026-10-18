import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RouterProvider, createMemoryHistory, createRootRoute, createRouter } from '@tanstack/react-router';
import { FcNoobzPage } from './fcnoobz';

// L8 — revue UX de /fcnoobz : pied de page lisible (WCAG 1.4.3), tuile Jeux vidéo en tête.

async function renderPage() {
  const rootRoute = createRootRoute({ component: FcNoobzPage });
  const router = createRouter({ routeTree: rootRoute, history: createMemoryHistory({ initialEntries: ['/fcnoobz'] }) });
  render(<RouterProvider router={router} />);
  await screen.findByTestId('tuile-jeux-video');
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const a = (s / 100) * Math.min(l / 100, 1 - l / 100);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return (l / 100 - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))) * 255;
  };
  return [f(0), f(8), f(4)];
}
function luminance([r, g, b]: [number, number, number]) {
  const lin = (c: number) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

describe('L8 t1 — pied de page lisible', () => {
  it('le pied de page lit --fg-dim, au moins 4,5:1 sur le fond le plus clair de la page (rgb(6,8,20))', async () => {
    await renderPage();
    const footer = screen.getByTestId('pied-fcnoobz');
    expect(footer).toHaveTextContent('Section indépendante du suivi OL');
    expect(footer).toHaveClass('text-fg-dim');
    const css = readFileSync('src/index.css', 'utf8');
    const m = css.match(/--fg-dim:\s*(\d+)\s+(\d+)%\s+(\d+)%/);
    expect(m).not.toBeNull();
    const fg = luminance(hslToRgb(Number(m![1]), Number(m![2]), Number(m![3])));
    const bg = luminance([6, 8, 20]);
    expect((fg + 0.05) / (bg + 0.05)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('L8 t2 — tuile Jeux vidéo en tête', () => {
  it('la tuile Jeux vidéo précède les tuiles « Bientôt » et ne partage pas leur grille', async () => {
    await renderPage();
    const tile = screen.getByTestId('tuile-jeux-video');
    const grid = screen.getByTestId('tuiles-bientot');
    expect(tile.compareDocumentPosition(grid) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(grid.contains(tile)).toBe(false);
    expect(grid.children).toHaveLength(3);
  });
  it("la tuile montre au repos son signe d'action « Voir la page → »", async () => {
    await renderPage();
    expect(screen.getByTestId('tuile-jeux-video')).toHaveTextContent('Voir la page →');
  });
  it('les 3 tuiles non cliquables ne grossissent pas au survol', async () => {
    await renderPage();
    for (const t of screen.getByTestId('tuiles-bientot').children) {
      expect(t.className).not.toMatch(/scale/);
      expect(t.querySelector('a')).toBeNull();
    }
  });
  it('badges de statut en 10 px au moins, icônes décoratives masquées, logo du héros sans alt (le h1 le nomme)', async () => {
    await renderPage();
    for (const t of screen.getByTestId('tuiles-bientot').children) {
      expect(t.innerHTML).not.toMatch(/text-\[9px\]/);
      for (const svg of t.querySelectorAll('svg')) expect(svg).toHaveAttribute('aria-hidden', 'true');
    }
    expect(document.querySelector('img[src="/fcnoobz.png"]')).toHaveAttribute('alt', '');
  });
});
