import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createMemoryHistory, createRootRoute, createRouter } from '@tanstack/react-router';
import { Sidebar } from '@/components/layout/sidebar';
import { FcNoobzCarrieresPage } from './fcnoobz-carrieres';
import { FcNoobzPage } from './fcnoobz';
import { pageTitle } from '@/lib/page-title';

// Acceptation L121 — « Mes carrières » (/fcnoobz/carrieres), d'après docs/specs/fcnoobz-carrieres/fiche.yaml.
// Données d'exemple fabriquées pour le test : aucune vient d'une sauvegarde.

const DATA = {
  releveLe: '2026-11-25',
  editions: [
    {
      edition: 24,
      clubs: [
        {
          club: 'Club Test B',
          saisons: [
            { saison: '2024-2025', division: 'Division Test 2', place: 1, titres: ['Champion de Division Test 2'], provenance: 'saisie' },
            { saison: '2023-2024', division: 'Division Test 2', place: null, provenance: 'saisie' },
          ],
        },
      ],
    },
    {
      edition: 26,
      clubs: [
        {
          club: 'Club Test A',
          saisons: [
            { saison: '2025-2026', division: 'Division Test 1', place: 3, titres: ['Coupe Test', 'Super Coupe Test'], provenance: 'sauvegarde' },
            { saison: '2026-2027', division: 'Division Test 1', place: 2, enCours: true, provenance: 'sauvegarde' },
          ],
        },
        { club: 'Club Test C', saisons: [{ saison: '2025-2026', division: 'Division Test 3', place: 12, provenance: 'sauvegarde' }] },
      ],
    },
  ],
};

let calls: string[] = [];
let handler: () => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>
type Rep = { ok: boolean; status: number; json: () => Promise<unknown> };
const rep = (ok: boolean, status: number, body: unknown): Promise<Rep> => Promise.resolve({ ok, status, json: () => Promise.resolve(body) });
const okJson = (body: unknown) => () => rep(true, 200, body);

beforeEach(() => {
  calls = [];
  handler = okJson(DATA);
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      calls.push(String(url));
      if (String(url).includes('/fcnoobz-data/carrieres.json')) return handler();
      return rep(false, 404, null);
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

function renderAt(path: string, Component: () => JSX.Element) {
  const rootRoute = createRootRoute({ component: Component });
  const router = createRouter({ routeTree: rootRoute, history: createMemoryHistory({ initialEntries: [path] }) });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}
const renderPage = () => renderAt('/fcnoobz/carrieres', FcNoobzCarrieresPage);
const tid = (id: string) => screen.getByTestId(id);
const dataCalls = () => calls.filter((u) => u.includes('/fcnoobz-data/carrieres.json'));

describe('R1 — chargement', () => {
  it("R1 — chargement : le message s'affiche dans un role=status, aucun bloc d'édition", async () => {
    handler = () => new Promise(() => {});
    renderPage();
    const msg = await screen.findByTestId('message-chargement');
    expect(msg).toHaveTextContent('Chargement des carrières…');
    expect(msg.closest('[role="status"]')).not.toBeNull();
    expect(document.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(tid('titre-page')).toHaveTextContent('Mes carrières');
    expect(screen.queryByTestId('edition')).toBeNull();
  });
});

describe('R2 — erreur', () => {
  it('R2 — erreur : message et bouton Réessayer, pas de message vide', async () => {
    handler = () => rep(false, 500, null);
    renderPage();
    expect(await screen.findByTestId('message-erreur')).toHaveTextContent('Impossible de charger les carrières.');
    expect(tid('bouton-reessayer')).toHaveTextContent('Réessayer');
    expect(screen.queryByTestId('message-vide')).toBeNull();
    expect(screen.queryByTestId('edition')).toBeNull();
  });
  it('R2 — un fichier illisible est une erreur, pas un état vide', async () => {
    handler = okJson({ editions: 'pas une liste' });
    renderPage();
    expect(await screen.findByTestId('message-erreur')).toBeInTheDocument();
    expect(screen.queryByTestId('message-vide')).toBeNull();
  });
  it('R2 — Réessayer relit le fichier', async () => {
    const user = userEvent.setup();
    handler = () => rep(false, 500, null);
    renderPage();
    await screen.findByTestId('message-erreur');
    const before = dataCalls().length;
    handler = okJson(DATA);
    await user.click(tid('bouton-reessayer'));
    await waitFor(() => expect(dataCalls().length).toBeGreaterThan(before));
    expect(await screen.findAllByTestId('edition')).toHaveLength(2);
  });
});

describe('R3 — vide', () => {
  it("R3 — vide : le message s'affiche, aucun bloc d'édition ni ligne de provenance", async () => {
    handler = okJson({ releveLe: null, editions: [] });
    renderPage();
    expect(await screen.findByTestId('message-vide')).toHaveTextContent('Aucune carrière importée pour le moment.');
    expect(tid('avertissement-jeu')).toHaveTextContent('pas de vrais matchs');
    expect(screen.queryByTestId('edition')).toBeNull();
    expect(screen.queryByTestId('provenance')).toBeNull();
  });
  it('R3 — des éditions sans saison comptent comme vide', async () => {
    handler = okJson({ releveLe: '2026-11-25', editions: [{ edition: 27, clubs: [{ club: 'Club Test', saisons: [] }] }] });
    renderPage();
    expect(await screen.findByTestId('message-vide')).toBeInTheDocument();
  });
});

describe('R4 — chargé', () => {
  it("R4 — chargé : un bloc par édition, la plus récente en tête, nommée d'après son numéro", async () => {
    renderPage();
    const editions = await screen.findAllByTestId('edition');
    expect(editions.map((e) => within(e).getByTestId('edition-nom').textContent)).toEqual(['Football Manager 26', 'Football Manager 24']);
    expect(within(editions[0]).getByRole('heading', { level: 2 })).toHaveTextContent('Football Manager 26');
    expect(document.body).toHaveClass('theme-fcnoobz');
  });
  it('R4 — une carte par club avec son résumé, saisons dans l’ordre chronologique', async () => {
    renderPage();
    const [fm26] = await screen.findAllByTestId('edition');
    const clubs = within(fm26).getAllByTestId('club');
    expect(clubs).toHaveLength(2);
    expect(within(clubs[0]).getByRole('heading', { level: 3 })).toHaveTextContent('Club Test A');
    expect(within(clubs[0]).getByTestId('club-resume')).toHaveTextContent('2 saisons · 2 titres');
    expect(within(clubs[1]).getByTestId('club-resume')).toHaveTextContent('1 saison · aucun titre');
    expect(within(clubs[0]).getAllByTestId('saison-annee').map((s) => s.textContent)).toEqual(['2025-2026', '2026-2027']);
    expect(within(clubs[0]).getAllByTestId('saison-division')[0]).toHaveTextContent('Division Test 1');
  });
});

describe('R5 — places et titres', () => {
  it('R5 — place ordinale, « Place non relevée » sans place', async () => {
    renderPage();
    const [, fm24] = await screen.findAllByTestId('edition');
    expect(within(fm24).getAllByTestId('saison-place').map((p) => p.textContent)).toEqual(['Place non relevée', '1er']);
    const [fm26] = screen.getAllByTestId('edition');
    expect(within(fm26).getAllByTestId('saison-place')[0]).toHaveTextContent(/^3e$/);
  });
  it('R5 — saison en cours : marque « En cours » et place provisoire', async () => {
    renderPage();
    const marques = await screen.findAllByTestId('saison-en-cours');
    expect(marques).toHaveLength(1);
    const ligne = marques[0].closest('[data-testid="saison-ligne"]') as HTMLElement;
    expect(marques[0]).toHaveTextContent('En cours');
    expect(within(ligne).getByTestId('saison-place')).toHaveTextContent('2e pour l’instant');
  });
  it('R5 — titres écrits en toutes lettres', async () => {
    renderPage();
    const [fm26] = await screen.findAllByTestId('edition');
    const titres = within(fm26).getByTestId('saison-titres');
    expect(titres).toHaveTextContent('Coupe Test');
    expect(titres).toHaveTextContent('Super Coupe Test');
    for (const svg of titres.querySelectorAll('svg')) expect(svg).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('R6 — provenance', () => {
  it('R6 — provenance : date du relevé et sources des saisons montrées seulement', async () => {
    renderPage();
    expect(await screen.findByTestId('provenance')).toHaveTextContent(
      'Relevé du 25/11/2026, importé en local depuis les sauvegardes de Football Manager et saisi à la main.',
    );
  });
  it('R6 — une seule provenance : l’autre n’est pas citée', async () => {
    handler = okJson({ releveLe: '2026-11-20', editions: [DATA.editions[0]] });
    renderPage();
    const p = await screen.findByTestId('provenance');
    expect(p).toHaveTextContent('Relevé du 20/11/2026, saisi à la main.');
    expect(p).not.toHaveTextContent('sauvegardes');
  });
});

describe('R8 — liens avec FC Noobz', () => {
  it('R8 — la tuile de /fcnoobz mène à la page', async () => {
    renderAt('/fcnoobz', FcNoobzPage);
    const tile = await screen.findByTestId('tuile-carrieres');
    expect(tile).toHaveTextContent('Mes carrières');
    expect(tile).toHaveTextContent('Voir la page →');
    expect(tile).toHaveAttribute('href', '/fcnoobz/carrieres');
    expect(screen.queryByText('Palmarès virtuel')).toBeNull();
  });
  it("R8 — FC Noobz est l'entrée courante de la barre latérale", async () => {
    renderAt('/fcnoobz/carrieres', () => <Sidebar eventStreamStatus="connected" />);
    const entry = await screen.findByTestId('entree-navigation');
    expect(entry).toHaveTextContent('FC Noobz');
    expect(entry).toHaveAttribute('aria-current', 'page');
  });
  it('R8 — lien de retour et titre d’onglet', async () => {
    renderPage();
    expect(await screen.findByTestId('lien-retour')).toHaveAttribute('href', '/fcnoobz');
    expect(pageTitle('/fcnoobz/carrieres')).toBe('Mes carrières · OL Companion');
  });
});
