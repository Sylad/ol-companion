import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createMemoryHistory, createRootRoute, createRouter } from '@tanstack/react-router';
import { BottomNav } from '@/components/layout/bottom-nav';
import { Sidebar } from '@/components/layout/sidebar';

// Acceptation L25 — écran « Jeux vidéo » (/fcnoobz/jeux-video), écrit d'après la fiche et la maquette.
// Page : composant exporté (premier export fonction) par src/routes/jeux-video.tsx.
// Source : GET /jeux-video-data/football-manager.json
//   { verifieLe: 'AAAA-MM-JJ', sources: ['https://…'], prochaineSortie: { nom, date: 'AAAA-MM-JJ' | null, plateformes?: string } | null,
//     editions: [{ nom, date }], nouveautes: [{ titre, description }] }

const DATA = {
  verifieLe: '2026-10-11',
  sources: ['https://www.footballmanager.com/'],
  prochaineSortie: { nom: 'Football Manager 27', date: '2026-11-03', plateformes: 'PC, Mac · consoles à confirmer' },
  editions: [
    { nom: 'Football Manager 26', date: '2025-11-04' },
    { nom: 'Football Manager 24', date: '2024-11-08' },
  ],
  nouveautes: [
    { titre: 'Première nouveauté de test', description: 'Description de la première nouveauté.' },
    { titre: 'Seconde nouveauté de test', description: 'Description de la seconde nouveauté.' },
  ],
};

let calls: string[] = [];
let handler: () => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;
const okJson = (body: unknown) => async () => ({ ok: true, status: 200, json: async () => body });

beforeEach(() => {
  calls = [];
  handler = okJson(DATA);
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      calls.push(String(url));
      if (String(url).includes('/jeux-video-data/football-manager.json')) return handler();
      return { ok: false, status: 404, json: async () => null };
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

const dataCalls = () => calls.filter((u) => u.includes('/jeux-video-data/football-manager.json'));

async function renderAt(path: string, Component: () => JSX.Element) {
  const rootRoute = createRootRoute({ component: Component });
  const router = createRouter({ routeTree: rootRoute, history: createMemoryHistory({ initialEntries: [path] }) });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

type Glob = { glob: (p: string, o: object) => Record<string, unknown> };
// import.meta.glob : un fichier absent ne casse pas la collecte, chaque test échoue séparément.
const pageModule = Object.values((import.meta as unknown as Glob).glob('./jeux-video.tsx', { eager: true }))[0] ?? {};
const fcnoobzModule = Object.values((import.meta as unknown as Glob).glob('./fcnoobz.tsx', { eager: true }))[0] ?? {};

function PageComponent(): JSX.Element {
  const Comp = Object.values(pageModule as Record<string, unknown>).find((v) => typeof v === 'function') as (() => JSX.Element) | undefined;
  if (!Comp) throw new Error('jeux-video.tsx doit exporter le composant de page');
  return <Comp />;
}
function FcNoobzComponent(): JSX.Element {
  const Comp = (fcnoobzModule as Record<string, unknown>).FcNoobzPage as () => JSX.Element;
  return <Comp />;
}
const renderPage = () => renderAt('/fcnoobz/jeux-video', PageComponent);
const tid = (id: string) => screen.getByTestId(id);
const loaded = async () => screen.findByTestId('prochaine-sortie');
const DATA_BLOCKS = ['prochaine-sortie', 'editions', 'nouveautes-annoncees', 'source-verification'];

describe('R1 — chargement', () => {
  beforeEach(() => {
    handler = () => new Promise(() => {});
  });
  it("R1 — chargement : le message s'affiche, aucun bloc de données", async () => {
    await renderPage();
    expect(await screen.findByTestId('message-chargement')).toHaveTextContent('Chargement de Football Manager…');
    expect(tid('titre-page')).toHaveTextContent('Jeux vidéo');
    expect(tid('sous-titre-page')).toBeInTheDocument();
    for (const id of [...DATA_BLOCKS, 'serie']) expect(screen.queryByTestId(id)).toBeNull();
  });
  it('R1 — le message est dans un conteneur role=status', async () => {
    await renderPage();
    const msg = await screen.findByTestId('message-chargement');
    expect(msg.closest('[role="status"]')).not.toBeNull();
    expect(document.querySelector('[aria-busy="true"]')).not.toBeNull();
  });
});

describe('R2 — erreur', () => {
  beforeEach(() => {
    handler = async () => ({ ok: false, status: 500, json: async () => null });
  });
  it('R2 — erreur : message et bouton Réessayer', async () => {
    await renderPage();
    expect(await screen.findByTestId('message-erreur')).toHaveTextContent('Impossible de charger les infos Football Manager.');
    expect(tid('bouton-reessayer')).toHaveTextContent('Réessayer');
    for (const id of DATA_BLOCKS) expect(screen.queryByTestId(id)).toBeNull();
  });
  it("R2 — Réessayer relance l'appel", async () => {
    const user = userEvent.setup();
    await renderPage();
    await screen.findByTestId('message-erreur');
    const before = dataCalls().length;
    handler = okJson(DATA);
    await user.click(tid('bouton-reessayer'));
    await waitFor(() => expect(dataCalls().length).toBeGreaterThan(before));
    expect(await screen.findByTestId('prochaine-sortie')).toBeInTheDocument();
    expect(screen.queryByTestId('message-erreur')).toBeNull();
  });
});

describe('R3 — vide', () => {
  beforeEach(() => {
    handler = okJson({ ...DATA, prochaineSortie: null, editions: [], nouveautes: [] });
  });
  it("R3 — vide : le message s'affiche, pas de bloc de données", async () => {
    await renderPage();
    expect(await screen.findByTestId('message-vide')).toHaveTextContent('Aucune info Football Manager pour le moment.');
    for (const id of DATA_BLOCKS) expect(screen.queryByTestId(id)).toBeNull();
  });
  it('R3 — vide : le bloc La série reste affiché', async () => {
    await renderPage();
    await screen.findByTestId('message-vide');
    expect(tid('serie')).toBeInTheDocument();
    expect(tid('surtitre-serie')).toBeInTheDocument();
    expect(tid('titre-serie')).toHaveTextContent('Football Manager');
    expect(tid('serie-presentation').textContent?.trim().length).toBeGreaterThan(0);
  });
});

describe('R4 — chargé', () => {
  it('R4 — chargé : prochaine sortie, éditions, nouveautés et série présentes', async () => {
    await renderPage();
    await loaded();
    expect(tid('surtitre-page')).toHaveTextContent('FC Noobz');
    expect(tid('titre-page')).toHaveTextContent('Jeux vidéo');
    expect(tid('sous-titre-page')).toBeInTheDocument();
    expect(tid('lien-retour')).toHaveTextContent('← FC Noobz');
    expect(tid('lien-retour')).toHaveAttribute('href', '/fcnoobz');
    for (const id of ['surtitre-prochaine-sortie', 'titre-prochaine-sortie', 'sortie-nom', 'sortie-date', 'editions', 'surtitre-editions', 'titre-editions', 'nouveautes-annoncees', 'surtitre-nouveautes', 'titre-nouveautes', 'serie', 'surtitre-serie', 'titre-serie', 'serie-presentation', 'source-verification']) {
      expect(tid(id)).toBeInTheDocument();
    }
    expect(tid('titre-prochaine-sortie')).toHaveTextContent('Prochaine sortie');
    expect(tid('titre-editions')).toHaveTextContent('Éditions précédentes');
    expect(tid('titre-nouveautes')).toHaveTextContent('Nouveautés annoncées');
    expect(tid('titre-serie')).toHaveTextContent('Football Manager');
    expect(tid('sortie-nom')).toHaveTextContent('Football Manager 27');
    const rows = screen.getAllByTestId('edition-ligne');
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByTestId('edition-nom')).toHaveTextContent('Football Manager 26');
    expect(within(rows[1]).getByTestId('edition-nom')).toHaveTextContent('Football Manager 24');
    const news = screen.getAllByTestId('nouveaute-ligne');
    expect(news).toHaveLength(2);
    expect(within(news[0]).getByTestId('nouveaute-titre')).toHaveTextContent('Première nouveauté de test');
    expect(within(news[1]).getByTestId('nouveaute-description')).toHaveTextContent('Description de la seconde nouveauté.');
    expect(screen.queryByTestId('message-chargement')).toBeNull();
    expect(screen.queryByTestId('message-vide')).toBeNull();
    expect(screen.queryByTestId('message-erreur')).toBeNull();
  });
  it('R4 — le thème FC Noobz est actif sur la page', async () => {
    await renderPage();
    await loaded();
    expect(document.body.classList.contains('theme-fcnoobz')).toBe(true);
  });
  it("R4 — un seul appel, au fichier statique (ni backend ni service externe)", async () => {
    await renderPage();
    await loaded();
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatch(/^\/jeux-video-data\/football-manager\.json(\?.*)?$/);
  });
});

describe('R5 — dates et vérification', () => {
  it('R5 — la date s\'affiche avec son jour de la semaine', async () => {
    await renderPage();
    await loaded();
    expect(tid('sortie-date')).toHaveTextContent('Mar. 03/11/2026');
    const rows = screen.getAllByTestId('edition-ligne');
    expect(within(rows[0]).getByTestId('edition-date')).toHaveTextContent('Mar. 04/11/2025');
    expect(within(rows[1]).getByTestId('edition-date')).toHaveTextContent('Ven. 08/11/2024');
    expect(tid('sortie-plateformes')).toHaveTextContent('PC, Mac · consoles à confirmer');
  });
  it('R5 — date non annoncée : « Date à confirmer »', async () => {
    handler = okJson({ ...DATA, prochaineSortie: { nom: 'Football Manager 27', date: null } });
    await renderPage();
    await loaded();
    expect(tid('sortie-date')).toHaveTextContent('Date à confirmer');
    expect(tid('sortie-date').textContent).not.toMatch(/\d{2}\/\d{2}\/\d{4}/);
    expect(tid('sortie-date').textContent).not.toMatch(/\d{1,2}h\d{2}/);
    expect(screen.queryByTestId('sortie-plateformes')).toBeNull();
  });
  it('R5 — la vérification (date et site) est affichée', async () => {
    await renderPage();
    await loaded();
    const src = tid('source-verification');
    expect(src).toHaveTextContent('Infos vérifiées le 11/10/2026');
    expect(src).toHaveTextContent('footballmanager.com');
    expect(src).toHaveTextContent('Les dates peuvent changer.');
  });
});

describe('R6 — liens avec FC Noobz', () => {
  it('R6 — la tuile de /fcnoobz mène à la page', async () => {
    await renderAt('/fcnoobz', FcNoobzComponent);
    const tile = await screen.findByTestId('tuile-jeux-video');
    expect(tile).toHaveTextContent('Jeux vidéo');
    expect(tile).toHaveAttribute('href', '/fcnoobz/jeux-video');
  });
  it("R6 — FC Noobz est l'entrée courante de la barre latérale", async () => {
    await renderAt('/fcnoobz/jeux-video', () => <Sidebar eventStreamStatus="connected" />);
    const entry = await screen.findByTestId('entree-navigation');
    expect(entry).toHaveTextContent('FC Noobz');
    expect(entry).toHaveAttribute('aria-current', 'page');
  });
  it('R6 — « Plus » est actif avec le nom « Plus, page actuelle : FC Noobz »', async () => {
    await renderAt('/fcnoobz/jeux-video', () => <BottomNav />);
    const plus = await screen.findByTestId('bouton-plus');
    expect(plus).toHaveAttribute('aria-label', 'Plus, page actuelle : FC Noobz');
  });
});
