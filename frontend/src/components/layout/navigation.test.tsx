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
import { GROUP_TITLE, SidebarLinks } from './sidebar-links';
import { DIVIDER, NAV_ITEMS, Sidebar } from './sidebar';
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

  // L24 : seule la barre du bas (téléphone) passe à 4 pages + « Plus » ; le bureau garde ses 7 pages.
  it('garde les 7 pages principales, Joueurs, Coupes et Carte L1 compris', async () => {
    await renderAt('/', () => <Sidebar eventStreamStatus="connected" />);
    const labels = NAV_ITEMS.map((i) => i.label);
    expect(labels).toEqual(['Dashboard', 'Calendrier', 'Classement', 'Joueurs', 'Actu', 'Coupes', 'Carte L1']);
    for (const label of labels) expect(screen.getByRole('link', { name: label })).toBeInTheDocument();
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
  // L24 (décision de Sylvain, option A, 02-10) : à 320 px, 8 cases de 40 px coupaient
  // « Dashboard », « Calendrier », « Classement » → 5 cases de 64 px, libellés en 10 px.
  it('garde 5 cases : Dashboard, Calendrier, Classement, Actu puis « Plus »', async () => {
    await renderAt('/', () => <BottomNav />);
    const nav = screen.getByRole('navigation', { name: 'Navigation principale' });
    const links = within(nav).getAllByRole('link').map((a) => a.textContent?.trim());
    expect(links).toEqual(['Dashboard', 'Calendrier', 'Classement', 'Actu']);
    const plus = within(nav).getByRole('button', { name: 'Plus' });
    expect(plus).toHaveAttribute('aria-expanded', 'false');
    const grid = nav.querySelector('.grid')!;
    expect(grid.className).toMatch(/(^| )grid-cols-5( |$)/);
    expect(grid.children).toHaveLength(5);
    for (const label of within(nav).getAllByText(/^(Dashboard|Calendrier|Classement|Actu|Plus)$/)) {
      expect(label.className).toMatch(/(^| )text-\[10px\]( |$)/);
    }
  });

  it('la pastille de « Plus » fait 16 px et rentre vers l’icône (plus au ras du bord)', async () => {
    seenOnlyOldest();
    await renderAt('/', () => <BottomNav />);
    const plus = await screen.findByRole('button', { name: 'Plus (2 nouveautés non vues)' });
    const badge = plus.querySelector('[data-news-badge]')!;
    expect(badge.className).toMatch(/(^| )h-4( |$)/);
    expect(badge.className).toMatch(/(^| )min-w-4( |$)/);
    expect(badge.className).not.toMatch(/-right-2\.5/);
  });

  it('« Plus » ouvre Joueurs, Coupes, Carte L1, FC Noobz, Nouveautés, Plan de travail et À propos ; Échap ferme et rend le focus à « Plus »', async () => {
    const user = userEvent.setup();
    await renderAt('/', () => <BottomNav />);
    const plus = screen.getByRole('button', { name: 'Plus' });
    await user.click(plus);
    const dialog = screen.getByRole('dialog', { name: 'Plus de pages' });
    const labels = within(dialog).getAllByRole('link').map((a) => a.textContent?.trim());
    expect(labels).toEqual(['Joueurs', 'Coupes', 'Carte L1', 'FC Noobz', 'Nouveautés', 'Plan de travail', 'À propos']);
    expect(within(dialog).getByRole('link', { name: 'Joueurs' })).toHaveAttribute('href', '/players');
    expect(within(dialog).getByRole('link', { name: 'Coupes' })).toHaveAttribute('href', '/cups');
    expect(within(dialog).getByRole('link', { name: 'Carte L1' })).toHaveAttribute('href', '/map');
    expect(within(dialog).getByRole('link', { name: 'Plan de travail' })).toHaveAttribute('href', '/plan');
    expect(within(dialog).getByRole('link', { name: 'Nouveautés' })).toHaveAttribute('href', '/nouveautes');
    expect(within(dialog).getAllByRole('link')[0]).toHaveFocus();
    expect(plus).toHaveAttribute('aria-expanded', 'true');

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(plus).toHaveFocus();
  });

  // Revue UX L24 (Nielsen #4) : même découpage que la barre latérale — pages, trait,
  // FC Noobz, trait, groupe « Application » titré (groupe nommé pour le lecteur d'écran).
  it('le panneau reprend les groupes de la barre latérale : pages | FC Noobz | « Application »', async () => {
    const user = userEvent.setup();
    await renderAt('/', () => <BottomNav />);
    await user.click(screen.getByRole('button', { name: 'Plus' }));
    const dialog = screen.getByRole('dialog', { name: 'Plus de pages' });
    const app = within(dialog).getByRole('group', { name: 'Application' });
    expect(within(app).getAllByRole('link').map((a) => a.textContent?.trim())).toEqual(['Nouveautés', 'Plan de travail', 'À propos']);
    const title = document.getElementById(app.getAttribute('aria-labelledby')!)!;
    expect(title.className).toBe(GROUP_TITLE);
    const lists = within(dialog).getAllByRole('list');
    expect(lists.map((l) => within(l).getAllByRole('link').map((a) => a.textContent?.trim()))).toEqual([
      ['Joueurs', 'Coupes', 'Carte L1'],
      ['FC Noobz'],
      ['Nouveautés', 'Plan de travail', 'À propos'],
    ]);
    expect(dialog.querySelectorAll('[data-divider]')).toHaveLength(2);
    for (const d of dialog.querySelectorAll('[data-divider]')) expect(d.className).toBe(DIVIDER);
  });

  // Revue UX L24 : panneau ouvert, focus revenu sur « Plus » (clic souris) → Échap ferme aussi.
  it('Échap ferme le panneau quand le focus est sur « Plus », qui garde le focus', async () => {
    const user = userEvent.setup();
    await renderAt('/', () => <BottomNav />);
    const plus = screen.getByRole('button', { name: 'Plus' });
    await user.click(plus);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    plus.focus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(plus).toHaveAttribute('aria-expanded', 'false');
    expect(plus).toHaveFocus();
  });

  // Revue UX L24, mesure à 320×568 : le panneau (537 px de contenu) défile ; la dernière
  // page recevait le focus SOUS la barre du bas (WCAG 2.4.11) et « Fermer » sortait de
  // l'écran en défilant. Marge de défilement = hauteur réservée à la barre, en-tête collant.
  it('le panneau défile sans cacher la page focalisée sous la barre, « Fermer » reste en haut', async () => {
    const user = userEvent.setup();
    await renderAt('/', () => <BottomNav />);
    await user.click(screen.getByRole('button', { name: 'Plus' }));
    const sheet = screen.getByRole('dialog');
    expect(sheet.style.scrollPaddingBottom).toBe(sheet.style.paddingBottom);
    expect(sheet.style.paddingBottom).not.toBe('');
    const header = within(sheet).getByRole('button', { name: 'Fermer' }).parentElement!;
    expect(header.className).toMatch(/(^| )sticky( |$)/);
    // -top-4 : collé au bord du panneau malgré son pt-4 (le collant se cale sur la zone de contenu).
    expect(header.className).toMatch(/(^| )-top-4( |$)/);
    expect(header.className).toMatch(/(^| )bg-surface( |$)/);
  });

  it('« Plus » est l’onglet actif sur /plan', async () => {
    await renderAt('/plan', () => <BottomNav />);
    expect(screen.getByRole('button', { name: 'Plus, page actuelle : Plan de travail' })).toHaveAttribute('data-active', 'true');
  });

  // Revue UX L24 (WCAG 1.3.1) : la couleur rouge n'est pas le seul signe que la page
  // courante est derrière « Plus » ; le nom accessible le dit (pas d'aria-current sur un bouton).
  it.each([
    ['/players', 'Joueurs'],
    ['/cups', 'Coupes'],
    ['/map', 'Carte L1'],
    ['/fcnoobz', 'FC Noobz'],
    ['/nouveautes', 'Nouveautés'],
    ['/about', 'À propos'],
  ])('sur %s, le nom accessible de « Plus » dit « page actuelle : %s »', async (path, label) => {
    await renderAt(path, () => <BottomNav />);
    const plus = screen.getByRole('button', { name: `Plus, page actuelle : ${label}` });
    expect(plus).not.toHaveAttribute('aria-current');
  });

  it('le nom accessible garde le nombre de nouveautés non vues après la page actuelle', async () => {
    seenOnlyOldest();
    await renderAt('/players', () => <BottomNav />);
    expect(
      await screen.findByRole('button', { name: 'Plus, page actuelle : Joueurs (2 nouveautés non vues)' }),
    ).toBeInTheDocument();
  });

  // L31 (revue UX L24, WCAG 1.4.1) : la teinte seule (1,47:1 entre actif et inactif) ne
  // suffit pas ; un filet en haut de la case active, présent ou absent, dit la même chose.
  it('la case active de la barre porte un repère non coloré (filet), les autres non', async () => {
    await renderAt('/standings', () => <BottomNav />);
    const nav = screen.getByRole('navigation', { name: 'Navigation principale' });
    const markers = nav.querySelectorAll('[data-active-marker]');
    expect(markers).toHaveLength(1);
    expect(markers[0].closest('a')).toHaveAttribute('href', '/standings');
    expect(markers[0]).toHaveAttribute('aria-hidden', 'true');
  });

  it('sur une page rangée dans « Plus », le repère est sur « Plus » seul', async () => {
    await renderAt('/players', () => <BottomNav />);
    const nav = screen.getByRole('navigation', { name: 'Navigation principale' });
    const markers = nav.querySelectorAll('[data-active-marker]');
    expect(markers).toHaveLength(1);
    expect(markers[0].closest('button')).toHaveAttribute('data-active', 'true');
  });

  it('panneau « Plus » ouvert : le repère passe de la page de la barre à « Plus »', async () => {
    const user = userEvent.setup();
    await renderAt('/standings', () => <BottomNav />);
    await user.click(screen.getByRole('button', { name: 'Plus' }));
    const nav = screen.getByRole('navigation', { name: 'Navigation principale' });
    const markers = nav.querySelectorAll('[data-active-marker]');
    expect(markers).toHaveLength(1);
    expect(markers[0].closest('button')).not.toBeNull();
  });

  it('sur une page de la barre, « Plus » ne parle pas de page actuelle', async () => {
    await renderAt('/standings', () => <BottomNav />);
    expect(screen.getByRole('button', { name: 'Plus' })).toHaveAttribute('data-active', 'false');
  });

  it.each([
    ['/players', 'Joueurs'],
    ['/cups', 'Coupes'],
    ['/map', 'Carte L1'],
  ])('sur %s (page passée dans « Plus »), « Plus » est l’onglet actif et le panneau marque %s', async (path, label) => {
    const user = userEvent.setup();
    await renderAt(path, () => <BottomNav />);
    const plus = screen.getByRole('button', { name: `Plus, page actuelle : ${label}` });
    expect(plus).toHaveAttribute('data-active', 'true');
    await user.click(plus);
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('link', { name: label })).toHaveAttribute('aria-current', 'page');
  });

  it('au clavier, les pages passées dans « Plus » s’atteignent et s’ouvrent', async () => {
    const user = userEvent.setup();
    const router = await renderAt('/', () => <BottomNav />);
    screen.getByRole('button', { name: 'Plus' }).focus();
    await user.keyboard('{Enter}');
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('link', { name: 'Joueurs' })).toHaveFocus();
    await user.tab();
    await user.tab();
    expect(within(dialog).getByRole('link', { name: 'Carte L1' })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(router.state.location.pathname).toBe('/map');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('choisir une page navigue et ferme le panneau ; « Plus » est alors l’onglet actif', async () => {
    const user = userEvent.setup();
    const router = await renderAt('/', () => <BottomNav />);
    await user.click(screen.getByRole('button', { name: 'Plus' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('link', { name: 'Nouveautés' }));
    expect(router.state.location.pathname).toBe('/nouveautes');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('button', { name: 'Plus, page actuelle : Nouveautés' })).toHaveAttribute('data-active', 'true');
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
