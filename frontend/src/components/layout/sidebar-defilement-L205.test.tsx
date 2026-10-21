import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { RouterProvider, createMemoryHistory, createRootRoute, createRouter } from '@tanstack/react-router';
import { Sidebar } from './sidebar';

vi.mock('@/components/live-connection-badge', () => ({ LiveConnectionBadge: () => <span>Pastille</span> }));
vi.mock('./sidebar-links', () => ({ SidebarLinks: () => <a href="https://www.sofascore.com">Sofascore</a> }));

afterEach(cleanup);

async function renderSidebar() {
  const root = createRootRoute({ component: () => <Sidebar eventStreamStatus="connected" /> });
  const router = createRouter({ routeTree: root, history: createMemoryHistory({ initialEntries: ['/'] }) });
  render(<RouterProvider router={router} />);
  await screen.findByText('Pastille');
  return document.querySelector('aside') as HTMLElement;
}

describe('Sidebar — barre défilable à faible hauteur (L205, WCAG 2.4.11)', () => {
  it('R1 — le contenu (liens, Sofascore, pastille du direct, version) est dans un conteneur qui défile verticalement', async () => {
    const aside = await renderSidebar();
    const defile = screen.getByText('Pastille').closest('[data-testid="barre-laterale-defilante"]') as HTMLElement;
    expect(defile).not.toBeNull();
    expect(aside.contains(defile)).toBe(true);
    expect(defile.className).toMatch(/(^|\s)overflow-y-auto(\s|$)/);
    expect(defile.className).toMatch(/(^|\s)min-h-0(\s|$)/);
    for (const nom of ['Dashboard', 'Équipe de France', 'FC Noobz', 'Sofascore']) {
      expect(defile.contains(screen.getByRole('link', { name: nom }))).toBe(true);
    }
    expect(defile.contains(screen.getByText('v2.0'))).toBe(true);
  });

  it('R2 — les liserés néon sont hors du conteneur qui défile : ils ne partent pas avec le contenu', async () => {
    const aside = await renderSidebar();
    const defile = aside.querySelector('[data-testid="barre-laterale-defilante"]') as HTMLElement;
    const liserés = Array.from(aside.querySelectorAll<HTMLElement>('[aria-hidden="true"].pointer-events-none'));
    expect(liserés).toHaveLength(2);
    for (const l of liserés) {
      expect(defile.contains(l)).toBe(false);
      expect(l.parentElement).toBe(aside);
    }
  });

  it('R3 — la barre elle-même ne défile pas et ne se laisse pas écraser (le défilement est dans le conteneur)', async () => {
    const aside = await renderSidebar();
    expect(aside.className).not.toMatch(/overflow-y-(auto|scroll)/);
    expect(aside.className).toMatch(/(^|\s)inset-y-0(\s|$)/);
  });
});
