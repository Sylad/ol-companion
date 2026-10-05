import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router';
import { AppShell } from './app-shell';

vi.mock('@/hooks/use-event-stream', () => ({ useEventStream: () => 'reconnecting' }));
vi.mock('@/hooks/use-match-notifications', () => ({ useMatchNotifications: () => undefined }));
vi.mock('@/components/page-backdrop', () => ({ PageBackdrop: () => null }));
vi.mock('@/components/demo-banner', () => ({ DemoBanner: () => null }));
vi.mock('./sidebar', () => ({ Sidebar: () => null, NAV_ITEMS: [], DIVIDER: 'divider' }));
vi.mock('./bottom-nav', () => ({ BottomNav: () => null }));

afterEach(cleanup);

async function renderShell() {
  const root = createRootRoute({ component: AppShell });
  const index = createRoute({
    getParentRoute: () => root,
    path: '/',
    component: () => <h1>Olympique Lyonnais</h1>,
  });
  const router = createRouter({
    routeTree: root.addChildren([index]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  });
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return screen.findByText('Live reconnecte');
}

describe('AppShell — pastille du direct sur téléphone (L30)', () => {
  it('ne flotte pas au-dessus du contenu : ni fixed ni absolute sur elle ni sur ses parents', async () => {
    const label = await renderShell();
    for (let el: HTMLElement | null = label; el && el !== document.body; el = el.parentElement) {
      expect(el.className).not.toMatch(/(^|\s)(fixed|absolute|sticky)(\s|$)/);
    }
  });

  it('est rendue dans <main>, avant le titre de la page, et masquée au bureau', async () => {
    const label = await renderShell();
    const badge = label.closest('[title]') as HTMLElement;
    const main = document.querySelector('main') as HTMLElement;
    expect(main.contains(badge)).toBe(true);
    const title = screen.getByRole('heading', { name: 'Olympique Lyonnais' });
    expect(badge.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(badge.closest('.lg\\:hidden')).not.toBeNull();
  });
});
