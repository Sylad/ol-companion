import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { RouterProvider, createMemoryHistory, createRouter } from '@tanstack/react-router';

// L180 — route inconnue (dont /match sans identifiant) : page en français avec h1 et liens, jamais « Not Found ».

vi.mock('./components/layout/app-shell', async () => {
  const { Outlet } = await import('@tanstack/react-router');
  return { AppShell: () => <Outlet /> };
});

import { router as routeurApplication } from './router';

// Budget de chaque test : monter l'arbre complet (14 routes) puis lire la page prend ~50 ms. Les requêtes
// par rôle ARIA (findByRole/getByRole) recalculent les noms accessibles de tout le document, lent sous
// jsdom : on lit le DOM par sélecteur CSS, comme navigation-current.test.tsx, et l'attente du h1 garde les
// 3 s des autres tests qui montent un routeur (accueil.*-L131/L85/L135). Le délai du test (15 s) n'est
// qu'une marge pour un runner lent : le blocage de la CI du 18-10 n'était PAS de la lenteur, voir ouvrir().
const DELAI_ATTENTE = 3000;
const DELAI_TEST = 15_000;

beforeEach(() => {
  // jsdom n'a pas window.scrollTo, que le routeur appelle à chaque navigation (erreur « Not implemented »
  // journalisée sinon, comme dans les autres tests qui montent le routeur).
  window.scrollTo = (() => {}) as typeof window.scrollTo;
});

/** Le h1 de la page, une fois affiché. */
async function titre() {
  return waitFor(
    () => {
      const h1 = document.querySelector('h1');
      expect(h1).not.toBeNull();
      return h1 as HTMLHeadingElement;
    },
    { timeout: DELAI_ATTENTE },
  );
}

/** Le lien de la page dont le texte est exactement `nom`. */
function lien(nom: string) {
  const trouves = [...document.querySelectorAll<HTMLAnchorElement>('a[href]')].filter((a) => a.textContent?.trim() === nom);
  expect(trouves).toHaveLength(1);
  return trouves[0];
}

/**
 * Monte l'arbre de routes de l'application dans un routeur NEUF, à l'URL `chemin`. Réutiliser le routeur
 * singleton de './router' avec router.update({ history }) puis router.load() bloque dès le deuxième test
 * avec @tanstack/react-router >= 1.170 (que la CI installe, faute de package-lock.json) : le routeur dont
 * le rendu a été démonté par le nettoyage de testing-library ne termine plus jamais load() (reproduit
 * avec 1.170.45, Node 20 ; 1.169.2 s'en accommode). Un routeur par test, comme les autres tests de
 * routeur du dépôt (accueil.*-L131/L85/L135, navigation-current), n'a pas d'état hérité du test précédent.
 */
async function ouvrir(chemin: string) {
  const router = createRouter({
    routeTree: routeurApplication.routeTree,
    history: createMemoryHistory({ initialEntries: [chemin] }),
  });
  await router.load();
  render(<RouterProvider router={router} />);
}

describe('Route inconnue (L180)', () => {
  it('R1 — /match sans identifiant : h1 français, aucun « Not Found »', async () => {
    await ouvrir('/match');
    expect((await titre()).textContent?.trim()).toBe('Page introuvable');
    expect(document.querySelectorAll('h1')).toHaveLength(1);
    expect(document.body.textContent).not.toMatch(/not found/i);
  }, DELAI_TEST);

  it('R2 — une route inconnue propose les liens Accueil et Calendrier', async () => {
    await ouvrir('/nimporte-quoi');
    await titre();
    expect(lien('Accueil').getAttribute('href')).toBe('/');
    expect(lien('Calendrier').getAttribute('href')).toBe('/fixtures');
  }, DELAI_TEST);
});
