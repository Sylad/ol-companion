import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRouter,
} from '@tanstack/react-router';
import { BottomNav } from './bottom-nav';
import { SidebarLinks } from './sidebar-links';
import { NAV_ITEMS } from './sidebar';

async function renderAt(path: string, Component: () => JSX.Element) {
  const rootRoute = createRootRoute({ component: Component });
  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  render(<RouterProvider router={router} />);
  await screen.findAllByRole('link');
  return router;
}

describe('barre latérale (bureau)', () => {
  it('« Nouveautés » juste au-dessus d’« À propos », marqué comme page courante sur /nouveautes', async () => {
    await renderAt('/nouveautes', () => <SidebarLinks />);
    const labels = screen.getAllByRole('link').map((a) => a.textContent?.trim());
    expect(labels.slice(-2)).toEqual(['Nouveautés', 'À propos']);
    expect(screen.getByRole('link', { name: 'Nouveautés' })).toHaveAttribute('href', '/nouveautes');
    expect(screen.getByRole('link', { name: 'Nouveautés' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'À propos' })).not.toHaveAttribute('aria-current');
  });
});

describe('<BottomNav /> (téléphone)', () => {
  it('garde 8 cases (pas une de plus) : les 7 pages principales puis « Plus »', async () => {
    await renderAt('/', () => <BottomNav />);
    const nav = screen.getByRole('navigation', { name: 'Navigation principale' });
    const links = within(nav).getAllByRole('link').map((a) => a.textContent?.trim());
    expect(links).toEqual(NAV_ITEMS.map((i) => i.label));
    const plus = within(nav).getByRole('button', { name: 'Plus' });
    expect(plus).toHaveAttribute('aria-expanded', 'false');
    expect(nav.querySelector('.grid')!.children).toHaveLength(8);
  });

  it('« Plus » ouvre FC Noobz, Nouveautés et À propos ; Échap ferme et rend le focus à « Plus »', async () => {
    const user = userEvent.setup();
    await renderAt('/', () => <BottomNav />);
    const plus = screen.getByRole('button', { name: 'Plus' });
    await user.click(plus);
    const dialog = screen.getByRole('dialog', { name: 'Plus de pages' });
    const labels = within(dialog).getAllByRole('link').map((a) => a.textContent?.trim());
    expect(labels).toEqual(['FC Noobz', 'Nouveautés', 'À propos']);
    expect(within(dialog).getByRole('link', { name: 'Nouveautés' })).toHaveAttribute('href', '/nouveautes');
    expect(within(dialog).getAllByRole('link')[0]).toHaveFocus();
    expect(plus).toHaveAttribute('aria-expanded', 'true');

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(plus).toHaveFocus();
  });

  it('choisir une page navigue et ferme le panneau ; « Plus » est alors l’onglet actif', async () => {
    const user = userEvent.setup();
    const router = await renderAt('/', () => <BottomNav />);
    await user.click(screen.getByRole('button', { name: 'Plus' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('link', { name: 'Nouveautés' }));
    expect(router.state.location.pathname).toBe('/nouveautes');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('button', { name: 'Plus' })).toHaveAttribute('data-active', 'true');
  });

  it('le focus reste dans le panneau (Tab et Maj+Tab bouclent)', async () => {
    const user = userEvent.setup();
    await renderAt('/', () => <BottomNav />);
    await user.click(screen.getByRole('button', { name: 'Plus' }));
    const dialog = screen.getByRole('dialog');
    const close = within(dialog).getByRole('button', { name: 'Fermer' });
    const links = within(dialog).getAllByRole('link');
    links[links.length - 1].focus();
    await user.tab();
    expect(close).toHaveFocus();
    await user.tab({ shift: true });
    expect(links[links.length - 1]).toHaveFocus();
  });
});
