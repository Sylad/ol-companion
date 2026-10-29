import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createMemoryHistory, createRootRoute, createRouter } from '@tanstack/react-router';
import { EquipeDeFrancePage } from './equipe-de-france';

// L167 — acceptation de l'écran page-match-equipe-de-france, côté /equipe-de-france (R1, R2).
// Appel simulé (A2) : GET /api/france. Horloge : seul Date est simulé.
// Stabilité (L231) : rouges à la porte du 29-10, verts au rejeu — le premier rendu (routeur, requête simulée)
// dépassait les 1 s de `findBy` sous charge, et les rendus d'une boucle restaient montés
// (leur minuteur de `useNow` vivait encore). D'où : délai d'attente large, un seul rendu monté à la
// fois, horloge réinstallée proprement à chaque rendu.
// Non couvert ici (voir le rapport) : les cas « back » de R1 (FranceService, jest dans backend/).

const FR = { id: 5061, name: 'France' };
const BE = { id: 2373, name: 'Belgique' };
const UK = { id: 2, name: 'Ukraine' };
const RESULTS = [
  { id: 4672325, date: '2026-10-05T18:45:00.000Z', home: FR, away: BE, homeScore: 4, awayScore: 1, franceIsHome: true, competition: 'Qualifications Coupe du monde' },
  { id: 4672000, date: '2026-09-03T18:45:00.000Z', home: UK, away: FR, homeScore: 0, awayScore: 2, franceIsHome: false, competition: 'Qualifications Coupe du monde' },
];
const nextMatch = (date: string) => ({ id: 4999, date, timeConfirmed: true, home: FR, away: { id: 7, name: 'Azerbaïdjan' }, competition: 'Qualifications Coupe du monde' });

const ATTENTE_MS = 15_000;

async function renderPage(next: string, now: string) {
  cleanup();
  vi.useRealTimers();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(now));
  vi.stubGlobal('fetch', vi.fn(async (url: string) =>
    String(url).includes('/france')
      ? { ok: true, status: 200, json: async () => ({ nextMatch: nextMatch(next), results: RESULTS, squad: [] }) }
      : { ok: false, status: 404, json: async () => null }));
  const root = createRootRoute({ component: EquipeDeFrancePage });
  const router = createRouter({ routeTree: root, history: createMemoryHistory({ initialEntries: ['/equipe-de-france'] }) });
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return screen.findByTestId('prochain-match', undefined, { timeout: ATTENTE_MS });
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
beforeEach(() => {
  document.body.className = '';
});
vi.setConfig({ testTimeout: 30_000 });

const KICKOFF = '2026-11-12T20:00:00Z'; // jeu. 12/11 21:00 à Paris
const url = (a: Element) => new URL(a.getAttribute('href')!, 'http://x');

describe('R1 — accès depuis /equipe-de-france', () => {
  it('R1 — chaque ligne de résultat est un lien d’au moins 44 px', async () => {
    await renderPage(KICKOFF, '2026-11-10T10:00:00Z');
    const lignes = await screen.findAllByTestId('resultat-ligne', undefined, { timeout: ATTENTE_MS });
    expect(lignes).toHaveLength(RESULTS.length);
    for (const li of lignes) {
      const lien = within(li).getByTestId('lien-resultat-match');
      // R1 — « chaque ligne des « Derniers résultats » est un lien (toute la ligne, … chevron « › ») »
      expect(lien).toHaveTextContent('›');
      for (const id of ['resultat-rencontre', 'resultat-score', 'resultat-date']) expect(lien).toContainElement(within(li).getByTestId(id));
      // R1 — « 44 px de haut au moins » (jsdom ne mesure rien : on lit la classe ou le style de hauteur minimale)
      const hauteur = `${lien.className} ${lien.getAttribute('style') ?? ''}`;
      expect(hauteur).toMatch(/min-h-\[(4[4-9]|[5-9]\d)px\]|min-h-(1[1-9]|[2-9]\d)\b|min-height:\s*(4[4-9]|[5-9]\d)px/);
    }
  });

  it('R1 — dans la fenêtre (00:00 Paris le jour J → coup d’envoi + 3 h), le prochain match a un lien « Voir le match »', async () => {
    for (const now of ['2026-11-11T23:30:00Z' /* 00:30 Paris le jour J */, '2026-11-12T20:30:00Z', '2026-11-12T22:59:00Z']) {
      const bloc = await renderPage(KICKOFF, now);
      // R1 — « le bloc « Prochain match » porte un bouton-lien « Voir le match » … de 00:00 (heure de Paris) le jour du coup d’envoi jusqu’à 3 h après le coup d’envoi »
      expect(within(bloc).getByTestId('lien-prochain-match')).toHaveTextContent('Voir le match');
    }
  });

  it('R1 — hors fenêtre (demain 20:45 vu aujourd’hui 21:00, ou veille du match) : pas de bouton, date conservée', async () => {
    // (témoin : dans la fenêtre, le bouton existe)
    expect(within(await renderPage(KICKOFF, '2026-11-12T10:00:00Z')).getByTestId('lien-prochain-match')).toBeInTheDocument();
    for (const [next, now] of [['2026-11-12T19:45:00Z', '2026-11-11T20:00:00Z'], [KICKOFF, '2026-11-11T10:00:00Z'], [KICKOFF, '2026-11-12T23:30:00Z']]) {
      const bloc = await renderPage(next, now);
      if (now < '2026-11-12') {
        // R1 — « hors fenêtre (veille, ou autre jour) la date reste affichée »
        expect(within(bloc).getByTestId('prochain-match-date').textContent).toMatch(/\d{2}\/\d{2}/);
      }
      // R1 — « seulement dans une fenêtre … hors fenêtre … »
      expect(within(bloc).queryByTestId('lien-prochain-match')).toBeNull();
    }
  });

  it('R1 — avant le coup d’envoi, la date est « Jeu. 12/11 · 21h00 » (format L113, jamais « Aujourd’hui »), après : pastille « En direct »', async () => {
    let bloc = await renderPage(KICKOFF, '2026-11-12T10:00:00Z');
    // R1 — « avant le coup d’envoi la date reste affichée au format de L113, jamais « Aujourd’hui » (« Jeu. 12/11 · 21h00 ») »
    expect(within(bloc).getByTestId('prochain-match-date')).toHaveTextContent('Jeu. 12/11 · 21h00');
    expect(bloc).not.toHaveTextContent('Aujourd’hui');
    expect(within(bloc).queryByTestId('prochain-match-en-direct')).toBeNull();
    bloc = await renderPage(KICKOFF, '2026-11-12T20:30:00Z');
    // R1 — « une fois le coup d’envoi passé la pastille « En direct » la remplace »
    expect(within(bloc).getByTestId('prochain-match-en-direct')).toHaveTextContent('En direct');
    expect(within(bloc).queryByTestId('prochain-match-date')).toBeNull();
  });

  it('R1 — les résultats restent une liste <ul>/<li> avec les testid de L113', async () => {
    await renderPage(KICKOFF, '2026-11-10T10:00:00Z');
    const lignes = await screen.findAllByTestId('resultat-ligne', undefined, { timeout: ATTENTE_MS });
    // R1 — « Les lignes de résultat sont des <li data-testid=resultat-ligne> d’une <ul>, chacune contenant le lien »
    for (const li of lignes) {
      expect(li.tagName).toBe('LI');
      expect(li.parentElement?.tagName).toBe('UL');
      expect(within(li).getByTestId('lien-resultat-match').tagName).toBe('A');
      // R1 — « les testid de L113 (resultat-badge, resultat-rencontre, resultat-competition, resultat-date, resultat-score) sont conservés »
      for (const id of ['resultat-badge', 'resultat-rencontre', 'resultat-competition', 'resultat-date', 'resultat-score']) expect(within(li).getByTestId(id)).toBeInTheDocument();
    }
  });
});

describe('R2 — format du lien', () => {
  it('R2 — le lien d’un résultat pointe vers /match/<id>?matchupId=<home>-<away>-<id>', async () => {
    await renderPage(KICKOFF, '2026-11-10T10:00:00Z');
    const liens = await screen.findAllByTestId('lien-resultat-match', undefined, { timeout: ATTENTE_MS });
    // R2 — « /match/<id>?matchupId=<idDomicile>-<idExtérieur>-<id> »
    expect(url(liens[0]).pathname).toBe('/match/4672325');
    expect(url(liens[0]).searchParams.get('matchupId')).toBe('5061-2373-4672325');
    expect(url(liens[1]).pathname).toBe('/match/4672000');
    expect(url(liens[1]).searchParams.get('matchupId')).toBe('2-5061-4672000');
  });

  it('R2 — le lien du prochain match suit le même format', async () => {
    const bloc = await renderPage(KICKOFF, '2026-11-12T10:00:00Z');
    const lien = within(bloc).getByTestId('lien-prochain-match');
    // R2 — « /match/<id>?matchupId=<idDomicile>-<idExtérieur>-<id>, lu dans /api/france »
    expect(url(lien).pathname).toBe('/match/4999');
    expect(url(lien).searchParams.get('matchupId')).toBe('5061-7-4999');
  });
});
