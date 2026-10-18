import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createMemoryHistory } from '@tanstack/react-router';

// L180 — route inconnue (dont /match sans identifiant) : page en français avec h1 et liens, jamais « Not Found ».

vi.mock('./components/layout/app-shell', async () => {
  const { Outlet } = await import('@tanstack/react-router');
  return { AppShell: () => <Outlet /> };
});

import { AppRouter, router } from './router';

async function ouvrir(chemin: string) {
  router.update({ history: createMemoryHistory({ initialEntries: [chemin] }) });
  await router.load();
  render(<AppRouter />);
}

describe('Route inconnue (L180)', () => {
  it('R1 — /match sans identifiant : h1 français, aucun « Not Found »', async () => {
    await ouvrir('/match');
    expect(await screen.findByRole('heading', { level: 1, name: 'Page introuvable' })).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/not found/i);
  });

  it('R2 — une route inconnue propose les liens Accueil et Calendrier', async () => {
    await ouvrir('/nimporte-quoi');
    await screen.findByRole('heading', { level: 1 });
    expect(screen.getByRole('link', { name: 'Accueil' }).getAttribute('href')).toBe('/');
    expect(screen.getByRole('link', { name: 'Calendrier' }).getAttribute('href')).toBe('/fixtures');
  });
});
