import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router';
import { AppShell } from './app-shell';

vi.mock('@/hooks/use-event-stream', () => ({ useEventStream: () => 'open' }));
vi.mock('@/hooks/use-match-notifications', () => ({ useMatchNotifications: () => undefined }));
vi.mock('@/components/page-backdrop', () => ({ PageBackdrop: () => null }));
vi.mock('@/components/demo-banner', () => ({ DemoBanner: () => <a href="/demo">Démo</a> }));
vi.mock('./sidebar', () => ({ Sidebar: () => <a href="/standings">Classement</a> }));
vi.mock('./bottom-nav', () => ({ BottomNav: () => null }));

afterEach(cleanup);

async function renderShell() {
  const root = createRootRoute({ component: AppShell });
  const index = createRoute({ getParentRoute: () => root, path: '/', component: () => <h1>Accueil</h1> });
  const router = createRouter({
    routeTree: root.addChildren([index]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  });
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return screen.findByRole('link', { name: 'Aller au contenu' });
}

describe('AppShell — lien d’évitement (L207)', () => {
  it('R1 — « Aller au contenu » est le premier élément focalisable de la page', async () => {
    const lien = await renderShell();
    const focalisables = Array.from(document.body.querySelectorAll<HTMLElement>('a[href], button, [tabindex]:not([tabindex="-1"])'));
    expect(focalisables[0]).toBe(lien);
  });

  it('R2 — il pointe vers le <main>, focalisable par programme (tabIndex=-1) et sans contour parasite', async () => {
    const lien = await renderShell();
    const main = document.querySelector('main') as HTMLElement;
    expect(main.id).toBe('contenu');
    expect(lien.getAttribute('href')).toBe('#contenu');
    expect(main.getAttribute('tabindex')).toBe('-1');
    expect(main.className).toMatch(/(^| )outline-none( |$)/);
  });

  it('R3 — masqué visuellement hors focus (sr-only), visible au focus (focus:not-sr-only)', async () => {
    const lien = await renderShell();
    expect(lien.className).toMatch(/(^| )sr-only( |$)/);
    expect(lien.className).toMatch(/(^| )focus:not-sr-only( |$)/);
  });

  it('R4 — l’activer place le focus sur le <main>', async () => {
    const lien = await renderShell();
    lien.focus();
    fireEvent.click(lien);
    expect(document.activeElement).toBe(document.querySelector('main'));
  });
});
