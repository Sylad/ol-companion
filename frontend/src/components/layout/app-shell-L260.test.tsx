import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router';
import { AppShell } from './app-shell';
import { Sidebar } from './sidebar';
import { NotFoundPage } from '@/routes/not-found';

// L260 — mineurs de la revue UX L255 : titre explicite de la 404 (WCAG 2.4.2), logo de la barre latérale
// à côté du nom « OL Companion » (alt vide, WCAG 1.1.1) et entrée « Accueil » (plus « Dashboard »).

vi.mock('@/hooks/use-event-stream', () => ({ useEventStream: () => 'open' }));
vi.mock('@/hooks/use-match-notifications', () => ({ useMatchNotifications: () => undefined }));
vi.mock('@/components/page-backdrop', () => ({ PageBackdrop: () => null }));
vi.mock('@/components/demo-banner', () => ({ DemoBanner: () => null }));
vi.mock('./bottom-nav', () => ({ BottomNav: () => null }));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function monter(url: string, racine: () => JSX.Element) {
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: false, status: 404, json: async () => ({}) })));
  window.scrollTo = (() => {}) as typeof window.scrollTo;
  const root = createRootRoute({ component: racine, notFoundComponent: NotFoundPage });
  const index = createRoute({ getParentRoute: () => root, path: '/', component: () => <h1>Accueil</h1> });
  const match = createRoute({ getParentRoute: () => root, path: '/match/$gameId', component: () => <h1>Match</h1> });
  const router = createRouter({ routeTree: root.addChildren([index, match]), history: createMemoryHistory({ initialEntries: [url] }) });
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

describe('L260 — titre de la page introuvable', () => {
  it.each(['/inconnue', '/match'])('%s : « Page introuvable · OL Companion »', async (url) => {
    monter(url, AppShell);
    await screen.findByRole('heading', { level: 1, name: 'Page introuvable' });
    await waitFor(() => expect(document.title).toBe('Page introuvable · OL Companion'));
  });

  it('en quittant la 404, la page suivante reprend son titre', async () => {
    const router = monter('/inconnue', AppShell);
    await waitFor(() => expect(document.title).toBe('Page introuvable · OL Companion'));
    await router.navigate({ to: '/' });
    await waitFor(() => expect(document.title).toBe('Accueil · OL Companion'));
  });
});

describe('L260 — barre latérale', () => {
  const avecBarre = () => (
    <>
      <Sidebar eventStreamStatus="connected" />
      <Outlet />
    </>
  );

  it('le logo posé à côté de « OL Companion » a un alt vide ; le lien garde son nom par le texte', async () => {
    monter('/', avecBarre);
    const logo = await waitFor(() => {
      const img = document.querySelector('aside img[src="/icon.png"]');
      expect(img).not.toBeNull();
      return img!;
    });
    expect(logo).toHaveAttribute('alt', '');
    expect(logo.closest('a')).toHaveAccessibleName(/OL Companion/);
  });

  it('la première entrée est « Accueil », plus « Dashboard »', async () => {
    monter('/', avecBarre);
    expect(await screen.findByRole('link', { name: /^Accueil/ })).toBeInTheDocument();
    expect(document.querySelector('aside')?.textContent).not.toMatch(/Dashboard/);
  });

  it('L260/t1 : le site d’actu des supporters porte son nom, plus le libellé anglais « OL News »', async () => {
    monter('/', avecBarre);
    const lien = await screen.findByRole('link', { name: /^Olympique et Lyonnais/ });
    expect(lien).toHaveAttribute('href', 'https://www.olympique-et-lyonnais.com/rubrique/une');
    expect(document.querySelector('aside')?.textContent).not.toMatch(/OL News/);
  });
});
