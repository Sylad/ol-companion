import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
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
import { NEWS_SEEN_EVENT, NEWS_SEEN_KEY } from '@/lib/news-badge';

// Journal des Nouveautés servi à la pastille « nouveau » (L22).
const NEWS = {
  project: 'ol-companion',
  generated: '2026-10-01 22:00',
  entries: [
    { slug: 'c', title: 'C', date: '2026-10-01', lots: [], captures: [], html: '' },
    { slug: 'b', title: 'B', date: '2026-09-30', lots: [], captures: [], html: '' },
    { slug: 'a', title: 'A', date: '2026-09-28', lots: [], captures: [], html: '' },
  ],
};

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) =>
      url.endsWith('/nouveautes.json')
        ? { ok: true, status: 200, json: async () => NEWS }
        : { ok: false, status: 404, json: async () => null },
    ),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

/** Visite ancienne qui n'a vu que l'entrée « a » : deux nouveautés non vues. */
const seenOnlyOldest = () =>
  localStorage.setItem(NEWS_SEEN_KEY, JSON.stringify({ date: '2026-09-28', slugs: ['a'], at: '2026-09-28T08:00:00.000Z' }));

async function renderAt(path: string, Component: () => JSX.Element) {
  const rootRoute = createRootRoute({ component: Component });
  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  await screen.findAllByRole('link');
  return router;
}

describe('barre latérale (bureau)', () => {
  // Revue UX L13 : Nouveautés et À propos ne sont pas des « Ressources » (liens externes).
  it('groupe « Application » (Nouveautés puis À propos) avant « Ressources », qui ne garde que les liens externes', async () => {
    await renderAt('/nouveautes', () => <SidebarLinks />);
    const app = screen.getByRole('group', { name: 'Application' });
    const res = screen.getByRole('group', { name: 'Ressources' });
    // L23 : « Plan de travail » entre Nouveautés et À propos, dans le même groupe.
    expect(within(app).getAllByRole('link').map((a) => a.textContent?.trim())).toEqual(['Nouveautés', 'Plan de travail', 'À propos']);
    expect(within(app).getByRole('link', { name: 'Plan de travail' })).toHaveAttribute('href', '/plan');
    const external = within(res).getAllByRole('link');
    expect(external.length).toBeGreaterThan(0);
    for (const a of external) expect(a).toHaveAttribute('target', '_blank');
    expect(app.compareDocumentPosition(res) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    expect(within(app).getByRole('link', { name: 'Nouveautés' })).toHaveAttribute('href', '/nouveautes');
    expect(within(app).getByRole('link', { name: 'Nouveautés' })).toHaveAttribute('aria-current', 'page');
    expect(within(app).getByRole('link', { name: 'À propos' })).not.toHaveAttribute('aria-current');
  });
});

describe('pastille « nouveau » (L22)', () => {
  it('premier visiteur : aucune pastille, ni au bureau ni au téléphone', async () => {
    await renderAt('/', () => (
      <>
        <SidebarLinks />
        <BottomNav />
      </>
    ));
    await new Promise((r) => setTimeout(r, 20));
    expect(document.querySelectorAll('[data-news-badge]')).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Plus' })).toBeInTheDocument();
  });

  // Revue UX L22 : un nouveau venu qui n'ouvre jamais /nouveautes n'avait jamais de
  // pastille (aucune mémoire → rien n'est nouveau, pour toujours).
  it('nouveau venu : aucune pastille, mais une ligne de base est mémorisée ; une entrée publiée ensuite → pastille 1', async () => {
    await renderAt('/', () => <SidebarLinks />);
    await waitFor(() => expect(localStorage.getItem(NEWS_SEEN_KEY)).not.toBeNull());
    const base = JSON.parse(localStorage.getItem(NEWS_SEEN_KEY)!);
    expect(base.seen).toEqual(['a', 'b', 'c']);
    expect(base.at).toBeUndefined();
    expect(document.querySelectorAll('[data-news-badge]')).toHaveLength(0);
    cleanup();

    NEWS.entries.unshift({ slug: 'd', title: 'D', date: '2026-10-02', lots: [], captures: [], html: '' });
    try {
      await renderAt('/', () => <SidebarLinks />);
      expect(await screen.findByRole('link', { name: 'Nouveautés (1 nouveauté non vue)' })).toBeInTheDocument();
    } finally {
      NEWS.entries.shift();
    }
  });

  it('bureau : le lien Nouveautés porte le nombre d’entrées non vues, dit en toutes lettres au lecteur d’écran', async () => {
    seenOnlyOldest();
    await renderAt('/', () => <SidebarLinks />);
    const link = await screen.findByRole('link', { name: 'Nouveautés (2 nouveautés non vues)' });
    const badge = link.querySelector('[data-news-badge]')!;
    expect(badge).toHaveTextContent('2');
    expect(badge).toHaveAttribute('aria-hidden', 'true');
    // Revue UX : la ligne fait 32 px (py-2 + 16 px de texte) ; une pastille de 18 px la
    // portait à 34 px et décalait les lignes suivantes de 2 px → pastille de 16 px.
    expect(badge.className).toMatch(/(^| )h-4( |$)/);
    expect(badge.className).toMatch(/(^| )min-w-4( |$)/);
    expect(badge.className).not.toMatch(/h-\[1\.125rem\]/);
  });

  it('téléphone : « Plus » et le lien Nouveautés du panneau portent la pastille', async () => {
    seenOnlyOldest();
    const user = userEvent.setup();
    await renderAt('/', () => <BottomNav />);
    const plus = await screen.findByRole('button', { name: 'Plus (2 nouveautés non vues)' });
    expect(plus.querySelector('[data-news-badge]')).toHaveTextContent('2');
    await user.click(plus);
    const dialog = screen.getByRole('dialog', { name: 'Plus de pages' });
    const link = within(dialog).getByRole('link', { name: 'Nouveautés (2 nouveautés non vues)' });
    expect(link.querySelector('[data-news-badge]')).toHaveTextContent('2');
  });

  it('la pastille s’éteint dès que la page Nouveautés a marqué tout vu (événement), et entre onglets (storage)', async () => {
    seenOnlyOldest();
    await renderAt('/', () => <SidebarLinks />);
    await screen.findByRole('link', { name: 'Nouveautés (2 nouveautés non vues)' });
    act(() => {
      localStorage.setItem(NEWS_SEEN_KEY, JSON.stringify({ date: '2026-10-01', slugs: ['c'] }));
      window.dispatchEvent(new Event(NEWS_SEEN_EVENT));
    });
    expect(screen.getByRole('link', { name: 'Nouveautés' })).not.toContainHTML('data-news-badge');
    act(() => {
      localStorage.setItem(NEWS_SEEN_KEY, JSON.stringify({ date: '2026-09-30', slugs: ['b'] }));
      window.dispatchEvent(new StorageEvent('storage', { key: NEWS_SEEN_KEY }));
    });
    expect(screen.getByRole('link', { name: 'Nouveautés (1 nouveauté non vue)' })).toBeInTheDocument();
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

  it('« Plus » ouvre FC Noobz, Nouveautés, Plan de travail et À propos ; Échap ferme et rend le focus à « Plus »', async () => {
    const user = userEvent.setup();
    await renderAt('/', () => <BottomNav />);
    const plus = screen.getByRole('button', { name: 'Plus' });
    await user.click(plus);
    const dialog = screen.getByRole('dialog', { name: 'Plus de pages' });
    const labels = within(dialog).getAllByRole('link').map((a) => a.textContent?.trim());
    expect(labels).toEqual(['FC Noobz', 'Nouveautés', 'Plan de travail', 'À propos']);
    expect(within(dialog).getByRole('link', { name: 'Plan de travail' })).toHaveAttribute('href', '/plan');
    expect(within(dialog).getByRole('link', { name: 'Nouveautés' })).toHaveAttribute('href', '/nouveautes');
    expect(within(dialog).getAllByRole('link')[0]).toHaveFocus();
    expect(plus).toHaveAttribute('aria-expanded', 'true');

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(plus).toHaveFocus();
  });

  it('« Plus » est l’onglet actif sur /plan', async () => {
    await renderAt('/plan', () => <BottomNav />);
    expect(screen.getByRole('button', { name: 'Plus' })).toHaveAttribute('data-active', 'true');
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

  // Revue UX L13 : panneau aria-modal, la page derrière ne doit pas défiler.
  it('bloque le défilement de la page tant que le panneau est ouvert, le restaure à la fermeture', async () => {
    const user = userEvent.setup();
    document.body.style.overflow = 'scroll';
    await renderAt('/', () => <BottomNav />);
    await user.click(screen.getByRole('button', { name: 'Plus' }));
    expect(document.body.style.overflow).toBe('hidden');
    await user.keyboard('{Escape}');
    expect(document.body.style.overflow).toBe('scroll');

    // Fermeture par le choix d'une page : restauré aussi.
    await user.click(screen.getByRole('button', { name: 'Plus' }));
    expect(document.body.style.overflow).toBe('hidden');
    await user.click(within(screen.getByRole('dialog')).getByRole('link', { name: 'À propos' }));
    expect(document.body.style.overflow).toBe('scroll');
    document.body.style.overflow = '';
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
