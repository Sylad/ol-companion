import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import userEvent from '@testing-library/user-event';
import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router';
import { router as appRouter } from '@/router';
import { BottomNav } from './bottom-nav';
import { SECONDARY_ITEMS } from './sidebar-links';
import { NAV_ITEMS, Sidebar } from './sidebar';

// L28 — « page actuelle » de la navigation. Le <Link> de TanStack Router pose lui-même
// aria-current="page" sur tout lien qu'il juge actif, par une correspondance floue
// (préfixe) : un lien vers « / » serait alors « page actuelle » partout. Mesuré avec
// @tanstack/react-router 1.169.2 : la correspondance floue exige que le caractère qui
// suit le préfixe soit « / » (link.tsx, pathIsFuzzyEqual), donc « / » n'est actif que
// sur « / ». Ces tests gardent ce comportement contre une montée de version du routeur
// et vérifient que le style actif (calculé par l'application) dit la même chose
// qu'aria-current (posé par le routeur ou par l'application, selon le lien).

/** Chemins réels de l'application, lus dans l'arbre de routes de src/router.tsx. */
const APP_ROUTE_PATHS = Object.keys(appRouter.routesByPath);
/** Une URL concrète par route : les paramètres ($athleteId, $gameId) valent « 1 ». */
const APP_URLS = APP_ROUTE_PATHS.map((p) => p.replace(/\$[A-Za-z]+/g, '1'));

const FC_NOOBZ = { to: '/fcnoobz', label: 'FC Noobz' } as const;
/** Les 11 entrées de la barre latérale, dans l'ordre d'affichage. */
const SIDEBAR_ENTRIES = [...NAV_ITEMS, FC_NOOBZ, ...SECONDARY_ITEMS].map(({ to, label }) => ({ to, label }));
/** Les 4 pages de la barre du bas ; les 7 autres sont dans le panneau « Plus ». */
const BAR_LABELS = ['Dashboard', 'Calendrier', 'Classement', 'Actu'];
const BAR_ENTRIES = SIDEBAR_ENTRIES.filter((e) => BAR_LABELS.includes(e.label));
const MORE_ENTRIES = SIDEBAR_ENTRIES.filter((e) => !BAR_LABELS.includes(e.label));

beforeEach(() => {
  localStorage.clear();
  // Journal des Nouveautés vide : aucune pastille, les noms accessibles restent les libellés.
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: false, status: 404, json: async () => null })),
  );
  // jsdom n'a pas window.scrollTo, que le routeur appelle à chaque navigation.
  vi.stubGlobal('scrollTo', vi.fn());
});
afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

/** Rend une navigation dans un routeur qui a les mêmes chemins que l'application. */
async function renderAt(url: string, Nav: () => JSX.Element) {
  const rootRoute = createRootRoute({
    component: () => (
      <>
        <Nav />
        <Outlet />
      </>
    ),
  });
  const children = APP_ROUTE_PATHS.map((path) =>
    createRoute({ getParentRoute: () => rootRoute, path, component: () => null }),
  );
  const router = createRouter({
    routeTree: rootRoute.addChildren(children),
    history: createMemoryHistory({ initialEntries: [url] }),
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  // Sélecteur CSS plutôt que findAllByRole : le calcul des rôles est lent sous jsdom.
  await waitFor(() => expect(document.querySelector('a[href]')).not.toBeNull());
  return router;
}

const label = (a: Element) => a.textContent?.trim() ?? '';
const internalLinks = (root: Element) => [...root.querySelectorAll<HTMLAnchorElement>('a[href^="/"]')];
const isCurrent = (a: Element) => a.getAttribute('aria-current') === 'page';
const currentLabels = (links: Element[]) => links.filter(isCurrent).map(label);

/** Style actif de la barre latérale et du panneau « Plus » : fond de l'entrée (FC Noobz a le sien). */
const hasActiveBackground = (a: Element) => a.classList.contains('bg-surface-2') || a.classList.contains('bg-[#03040a]');
/** Style actif de la barre du bas : libellé et icône en rouge OL. */
const hasActiveTint = (a: Element) => a.classList.contains('text-ol-red-bright');

/** Le style actif et aria-current désignent les mêmes liens. */
function expectStyleAgrees(links: Element[], looksActive: (a: Element) => boolean) {
  expect(links.filter(looksActive).map(label)).toEqual(currentLabels(links));
}

const sidebar = () => <Sidebar eventStreamStatus="connected" />;
/** Lien du logo, en tête de barre latérale : il pointe vers « / » comme « Dashboard ». */
const logoLink = () => document.querySelector('aside img[alt="OL Companion"]')!.closest('a')!;
const dashboardLink = (links: Element[]) => links.find((a) => label(a) === 'Dashboard')!;
/** Entrées de navigation de la barre latérale : tous les liens internes sauf le logo. */
const sidebarEntries = () => internalLinks(document.querySelector('aside')!).filter((a) => a !== logoLink());
const barLinks = () => internalLinks(document.querySelector('nav[aria-label="Navigation principale"]')!);

describe('arbre de routes de test', () => {
  it('reprend les routes de l’application, dont une page par entrée de navigation', () => {
    expect(APP_ROUTE_PATHS).toContain('/');
    for (const { to } of SIDEBAR_ENTRIES) expect(APP_ROUTE_PATHS).toContain(to);
    expect(APP_URLS).toContain('/player/1');
    expect(APP_URLS).toContain('/match/1');
  });
});

describe('page actuelle — barre latérale (bureau)', () => {
  it('a 11 entrées, plus le lien du logo vers « / »', async () => {
    await renderAt('/fixtures', sidebar);
    expect(sidebarEntries().map(label)).toEqual(SIDEBAR_ENTRIES.map((e) => e.label));
    expect(logoLink()).toHaveAttribute('href', '/');
  });

  it.each(SIDEBAR_ENTRIES)('sur $to, seule « $label » porte aria-current="page" et le style actif', async ({ to, label: expected }) => {
    await renderAt(to, sidebar);
    expect(currentLabels(sidebarEntries())).toEqual([expected]);
    expectStyleAgrees(sidebarEntries(), hasActiveBackground);
    // Les deux liens vers « / » : ni « Dashboard » ni le logo hors du tableau de bord.
    expect(isCurrent(dashboardLink(sidebarEntries()))).toBe(to === '/');
    if (to !== '/') expect(logoLink()).not.toHaveAttribute('aria-current');
  });

  // Aucune entrée n'a de sous-route dans l'application ; ces deux pages ne sont sous
  // aucune entrée : « / » ne doit pas les revendiquer.
  it.each(['/match/1', '/player/1'])('sur %s, « Dashboard » et le logo ne sont pas la page actuelle', async (url) => {
    await renderAt(url, sidebar);
    expect(dashboardLink(sidebarEntries())).not.toHaveAttribute('aria-current');
    expect(logoLink()).not.toHaveAttribute('aria-current');
    expectStyleAgrees(sidebarEntries(), hasActiveBackground);
  });

  // Piège de activeOptions={{ exact: true }} seul : il compare aussi la chaîne de requête.
  it('sur /?x=1, « Dashboard » reste la page actuelle', async () => {
    await renderAt('/?x=1', sidebar);
    expect(currentLabels(sidebarEntries())).toEqual(['Dashboard']);
    expectStyleAgrees(sidebarEntries(), hasActiveBackground);
  });

  it('sur /fixtures?x=1, « Calendrier » est la page actuelle, pas « Dashboard »', async () => {
    await renderAt('/fixtures?x=1', sidebar);
    expect(currentLabels(sidebarEntries())).toEqual(['Calendrier']);
    expectStyleAgrees(sidebarEntries(), hasActiveBackground);
  });

  // La page Plan de travail renvoie vers /nouveautes#<entrée>.
  it('sur /nouveautes#une-entree, « Nouveautés » est la page actuelle', async () => {
    await renderAt('/nouveautes#une-entree', sidebar);
    expect(currentLabels(sidebarEntries())).toEqual(['Nouveautés']);
    expectStyleAgrees(sidebarEntries(), hasActiveBackground);
  });

  it.each(APP_URLS)('sur %s (route réelle), au plus une entrée est la page actuelle, et « Dashboard » seulement sur « / »', async (url) => {
    await renderAt(url, sidebar);
    const current = currentLabels(sidebarEntries());
    expect(current.length).toBeLessThanOrEqual(1);
    expect(current.includes('Dashboard')).toBe(url === '/');
    if (url !== '/') expect(logoLink()).not.toHaveAttribute('aria-current');
    expectStyleAgrees(sidebarEntries(), hasActiveBackground);
  });
});

describe('page actuelle — barre du bas (téléphone)', () => {
  it.each(BAR_ENTRIES)('sur $to, seule « $label » porte aria-current="page" et la teinte active', async ({ to, label: expected }) => {
    await renderAt(to, () => <BottomNav />);
    expect(currentLabels(barLinks())).toEqual([expected]);
    expectStyleAgrees(barLinks(), hasActiveTint);
  });

  it.each(MORE_ENTRIES)('sur $to (page du panneau « Plus »), aucune case de la barre n’est la page actuelle, « Dashboard » compris', async ({ to }) => {
    await renderAt(to, () => <BottomNav />);
    expect(currentLabels(barLinks())).toEqual([]);
    expectStyleAgrees(barLinks(), hasActiveTint);
  });

  it.each(['/match/1', '/player/1'])('sur %s, « Dashboard » n’est pas la page actuelle', async (url) => {
    await renderAt(url, () => <BottomNav />);
    expect(currentLabels(barLinks())).toEqual([]);
    expectStyleAgrees(barLinks(), hasActiveTint);
  });

  it('sur /?x=1, « Dashboard » reste la page actuelle', async () => {
    await renderAt('/?x=1', () => <BottomNav />);
    expect(currentLabels(barLinks())).toEqual(['Dashboard']);
    expectStyleAgrees(barLinks(), hasActiveTint);
  });

  it.each(APP_URLS)('sur %s (route réelle), au plus une case est la page actuelle, et « Dashboard » seulement sur « / »', async (url) => {
    await renderAt(url, () => <BottomNav />);
    const current = currentLabels(barLinks());
    expect(current.length).toBeLessThanOrEqual(1);
    expect(current.includes('Dashboard')).toBe(url === '/');
    expectStyleAgrees(barLinks(), hasActiveTint);
  });
});

describe('page actuelle — panneau « Plus » (téléphone)', () => {
  async function openSheet(url: string) {
    const user = userEvent.setup();
    await renderAt(url, () => <BottomNav />);
    await user.click(screen.getByRole('button', { name: /^Plus/ }));
    return internalLinks(screen.getByRole('dialog', { name: 'Plus de pages' }));
  }

  it.each(MORE_ENTRIES)('sur $to, seule « $label » porte aria-current="page" et le style actif ; aucune case de la barre', async ({ to, label: expected }) => {
    const sheetLinks = await openSheet(to);
    expect(sheetLinks.map(label)).toEqual(MORE_ENTRIES.map((e) => e.label));
    expect(currentLabels(sheetLinks)).toEqual([expected]);
    expectStyleAgrees(sheetLinks, hasActiveBackground);
    expect(currentLabels(barLinks())).toEqual([]);
  });

  it('sur /nouveautes#une-entree, « Nouveautés » est la page actuelle', async () => {
    const sheetLinks = await openSheet('/nouveautes#une-entree');
    expect(currentLabels(sheetLinks)).toEqual(['Nouveautés']);
    expectStyleAgrees(sheetLinks, hasActiveBackground);
  });

  // Ouvrir le panneau ne change pas de page : la case de la barre reste la page actuelle.
  it.each(BAR_ENTRIES)('sur $to, panneau ouvert : aucune page du panneau n’est actuelle, « $label » le reste dans la barre', async ({ to, label: expected }) => {
    const sheetLinks = await openSheet(to);
    expect(currentLabels(sheetLinks)).toEqual([]);
    expectStyleAgrees(sheetLinks, hasActiveBackground);
    expect(currentLabels(barLinks())).toEqual([expected]);
  });
});
