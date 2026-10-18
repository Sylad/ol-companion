import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { createMemoryHistory, createRootRoute, createRoute, createRouter, RouterProvider } from '@tanstack/react-router';
import { ErreurPage } from './erreur-page';

// L184 — jamais l'écran d'erreur anglais de TanStack (« Something went wrong! »).

const rechargement = vi.hoisted(() => ({ rechargerUneFois: vi.fn() }));
vi.mock('../lib/rechargement-module', async (orig) => ({
  ...(await orig<typeof import('../lib/rechargement-module')>()),
  rechargerUneFois: rechargement.rechargerUneFois,
}));

afterEach(() => rechargement.rechargerUneFois.mockReset());

describe('Page d\'erreur (L184)', () => {
  it('R6 — erreur de module : tente le rechargement unique, puis (garde atteinte) page française avec « Recharger »', () => {
    rechargement.rechargerUneFois.mockReturnValue(false);
    const { container } = render(
      <ErreurPage error={new TypeError('Failed to fetch dynamically imported module: /assets/match-abc.js')} reset={() => {}} />,
    );
    expect(rechargement.rechargerUneFois).toHaveBeenCalledTimes(1);
    expect(container.querySelector('h1')?.textContent).toMatch(/nouvelle version/i);
    const bouton = [...container.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Recharger');
    expect(bouton).toBeDefined();
    expect(document.body.textContent).not.toMatch(/something went wrong|failed to fetch/i);
  });

  it('R7 — « Recharger » recharge la page', () => {
    rechargement.rechargerUneFois.mockReturnValue(false);
    const recharger = vi.fn();
    const { container } = render(<ErreurPage error={new Error('boum')} reset={() => {}} recharger={recharger} />);
    fireEvent.click([...container.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Recharger')!);
    expect(recharger).toHaveBeenCalledTimes(1);
  });

  it('R8 — une erreur ordinaire ne déclenche aucun rechargement automatique mais s\'affiche en français', () => {
    const { container } = render(<ErreurPage error={new Error('Cannot read properties of undefined')} reset={() => {}} />);
    expect(rechargement.rechargerUneFois).not.toHaveBeenCalled();
    expect(container.querySelector('h1')?.textContent).toBe('Un problème est survenu');
    expect(document.body.textContent).not.toMatch(/something went wrong|cannot read/i);
  });

  it('R9 — le routeur de l\'application rend ErreurPage (et non le composant anglais par défaut) quand une route échoue', async () => {
    window.scrollTo = (() => {}) as typeof window.scrollTo;
    const { router: appli } = await import('../router');
    const defaut = appli.options.defaultErrorComponent;
    expect(defaut).toBe(ErreurPage);

    const racine = createRootRoute();
    const casse = createRoute({
      getParentRoute: () => racine,
      path: '/',
      component: () => { throw new Error('boum'); },
    });
    const router = createRouter({
      routeTree: racine.addChildren([casse]),
      history: createMemoryHistory({ initialEntries: ['/'] }),
      defaultErrorComponent: defaut,
    });
    await router.load();
    const vue = render(<RouterProvider router={router} />);
    await vi.waitFor(() => expect(vue.container.querySelector('h1')?.textContent).toBe('Un problème est survenu'));
  });
});
