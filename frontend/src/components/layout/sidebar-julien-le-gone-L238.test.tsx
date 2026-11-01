import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createMemoryHistory, createRootRoute, createRouter } from '@tanstack/react-router';
import { SidebarLinks } from './sidebar-links';

async function rendreRessources() {
  const router = createRouter({
    routeTree: createRootRoute({ component: SidebarLinks }),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  });
  await router.load();
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return screen.findByRole('group', { name: 'Ressources' });
}

describe('Ressources — Julien le Gone (L238)', () => {
  afterEach(cleanup);

  it('R1 — le lien Julien le Gone pointe vers julienlegone.fr, juste après Sofascore', async () => {
    const res = await rendreRessources();
    const liens = within(res).getAllByRole('link');
    const noms = liens.map((a) => a.textContent?.trim());
    expect(noms.indexOf('Julien le Gone')).toBe(noms.indexOf('Sofascore') + 1);
    expect(liens[noms.indexOf('Julien le Gone')]).toHaveAttribute('href', 'https://julienlegone.fr/');
  });

  it('R2 — il s\'ouvre dans un nouvel onglet avec noopener noreferrer, comme les autres ressources', async () => {
    const res = await rendreRessources();
    const lien = within(res).getByRole('link', { name: 'Julien le Gone' });
    expect(lien).toHaveAttribute('target', '_blank');
    expect(lien.getAttribute('rel')).toContain('noopener');
    expect(lien.getAttribute('rel')).toContain('noreferrer');
    expect(lien.querySelector('svg')).not.toBeNull();
  });
});
