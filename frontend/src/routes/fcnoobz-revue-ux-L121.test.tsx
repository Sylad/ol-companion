import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Outlet, RouterProvider, createMemoryHistory, createRootRoute, createRouter } from '@tanstack/react-router';
import { PannesProvider } from '@/components/retry-message';
import { FcNoobzCarrieresPage } from './fcnoobz-carrieres';
import { JeuxVideoPage } from './jeux-video';
import { FcNoobzPage } from './fcnoobz';

// L121 — correctifs de la revue UX (rapport ol-L121-ux) :
// M1 (WCAG 2.4.3) : après « Réessayer » sur Mes carrières ET Jeux vidéo, le focus ne tombe jamais sur <body> ;
// m1 (WCAG 2.3.3) : ni rotation de l'indicateur ni zoom de tuile si l'utilisateur demande moins d'animation ;
// m2 : l'état vide dit quand des carrières apparaîtront.

type Rep = { ok: boolean; status: number; json: () => Promise<unknown> };
const rep = (ok: boolean, status: number, body: unknown): Promise<Rep> => Promise.resolve({ ok, status, json: () => Promise.resolve(body) });
let handler: () => Promise<Rep>;

beforeEach(() => {
  handler = () => rep(false, 500, null);
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => (/fcnoobz-data|jeux-video-data/.test(String(url)) ? handler() : rep(false, 404, null))),
  );
});
afterEach(() => vi.unstubAllGlobals());

/** La page dans la coque de l'app : <main tabIndex=-1> et le fournisseur des pannes, comme app-shell.tsx. */
function renderDansLaCoque(path: string, Page: () => JSX.Element) {
  const rootRoute = createRootRoute({
    component: () => (
      <main id="contenu" tabIndex={-1}>
        <PannesProvider>
          <Outlet />
        </PannesProvider>
      </main>
    ),
  });
  const rootWithPage = rootRoute.addChildren([]);
  const router = createRouter({
    routeTree: createRootRoute({ component: () => (
      <main id="contenu" tabIndex={-1}>
        <PannesProvider>
          <Page />
        </PannesProvider>
      </main>
    ) }) ?? rootWithPage,
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe.each([
  ['Mes carrières', '/fcnoobz/carrieres', FcNoobzCarrieresPage],
  ['Jeux vidéo', '/fcnoobz/jeux-video', JeuxVideoPage],
] as const)('L121 M1 — %s : focus après « Réessayer »', (_, path, Page) => {
  it("le focus n'est jamais sur body : <main> pendant la relecture, puis « Réessayer » quand l'erreur revient", async () => {
    const user = userEvent.setup();
    renderDansLaCoque(path, Page);
    const bouton = await screen.findByTestId('bouton-reessayer');
    bouton.focus();
    expect(document.activeElement).toBe(bouton);

    let rendre: (r: Rep) => void = () => {};
    handler = () => new Promise<Rep>((r) => { rendre = r; });
    await user.click(bouton);

    await screen.findByTestId('message-chargement');
    expect(document.activeElement).not.toBe(document.body);
    expect(document.activeElement).toBe(document.getElementById('contenu'));

    await act(async () => {
      rendre({ ok: false, status: 500, json: () => Promise.resolve(null) });
      await Promise.resolve();
    });
    const retour = await screen.findByTestId('bouton-reessayer');
    await waitFor(() => expect(document.activeElement).toBe(retour));
  });
});

describe('L121 m1 — mouvement réduit', () => {
  it("l'indicateur de chargement ne tourne que sous motion-safe", async () => {
    handler = () => new Promise(() => {});
    renderDansLaCoque('/fcnoobz/carrieres', FcNoobzCarrieresPage);
    const indicateur = await screen.findByTestId('indicateur-chargement');
    const classes = indicateur.getAttribute('class')!.split(/\s+/);
    expect(classes).toContain('motion-safe:animate-spin');
    expect(classes).not.toContain('animate-spin');
  });
  it('les tuiles de /fcnoobz ne grossissent au survol que sous motion-safe', async () => {
    renderDansLaCoque('/fcnoobz', FcNoobzPage);
    for (const id of ['tuile-carrieres', 'tuile-jeux-video']) {
      const classes = (await screen.findByTestId(id)).getAttribute('class')!.split(/\s+/);
      expect(classes.filter((c) => c.includes('scale'))).toEqual(['motion-safe:hover:scale-[1.01]']);
    }
  });
});

describe('L121 m2 — état vide', () => {
  it('dit quand des carrières apparaîtront : après le prochain import local', async () => {
    handler = () => rep(true, 200, { releveLe: null, editions: [] });
    renderDansLaCoque('/fcnoobz/carrieres', FcNoobzCarrieresPage);
    expect(await screen.findByTestId('message-vide')).toHaveTextContent('Aucune carrière importée pour le moment.');
    const suite = screen.getByTestId('message-vide-suite');
    expect(suite).toHaveTextContent('apparaîtront ici après le prochain import');
    expect(suite).toHaveTextContent('en local depuis les sauvegardes de Football Manager');
  });
});
