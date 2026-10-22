import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { LineupResponse } from '@/types/api';

// L178 — un convoqué qui n'a pas encore joué a un lien vers sa fiche : GET /api/players/<id>/season-stats rend 404.
// Un 404 n'est pas une erreur (état neutre, sans role=alert, sans rouge) ; un 5xx ou le réseau en sont une (Réessayer).
// Le hook réel et un fetch simulé sont utilisés : c'est le statut HTTP qui décide.

let search: Record<string, string | undefined> = {};
vi.mock('@tanstack/react-router', () => ({
  useParams: () => ({ athleteId: '133157' }),
  useSearch: () => search,
  Link: ({ children, search: s, className }: { children: React.ReactNode; search?: unknown; className?: string }) => (
    <a href="/players" data-search={JSON.stringify(s ?? null)} className={className}>{children}</a>
  ),
}));
vi.mock('recharts', () => {
  const Null = () => null;
  return { LineChart: Null, Line: Null, XAxis: Null, YAxis: Null, CartesianGrid: Null, Tooltip: Null, ResponsiveContainer: Null };
});

import { PlayerDetailPage } from './player.$athleteId';

const feuille: LineupResponse = {
  gameId: 1, date: '2026-10-10T19:00:00Z', competition: 'Ligue 1', matchday: 8, opponent: 'Lens', opponentId: 7,
  isHome: true, homeScore: 2, awayScore: 1, formation: '4-3-3', starters: [], injured: [],
  bench: [{
    id: 1, athleteId: 133157, name: 'Justin Bengui', shortName: 'J. Bengui', jerseyNumber: 40, position: 'Goalkeeper',
    positionShort: 'GK', yardLine: 0, yardSide: 0, ranking: null, isStarting: false,
  }],
} as unknown as LineupResponse;

const reponse = (status: number, body: unknown = {}) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
let statsStatus = 404;
let lineupBody: LineupResponse | null = feuille;
let currentBody: unknown = null;
let statsBody: unknown = {};
const fetchMock = vi.fn();

function monter() {
  const client = new QueryClient({ defaultOptions: { queries: { retryDelay: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <PlayerDetailPage />
    </QueryClientProvider>,
  );
}
const appelsStats = () => fetchMock.mock.calls.filter(([url]) => String(url).includes('/season-stats')).length;

beforeEach(() => {
  search = {};
  statsStatus = 404;
  lineupBody = feuille;
  currentBody = null;
  statsBody = {};
  fetchMock.mockReset();
  fetchMock.mockImplementation((url: string) =>
    Promise.resolve(
      String(url).includes('/lineup') ? reponse(200, lineupBody)
      : String(url).includes('/live-match/current') ? reponse(200, currentBody)
      : String(url).includes('/live-match/') ? reponse(200, statsBody)
      : reponse(statsStatus),
    ),
  );
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('<PlayerDetailPage /> — joueur sans minute (L178)', () => {
  it('404 : état neutre (pas role=alert, pas de rouge), « n\'a pas encore joué cette saison », nom et poste de la feuille', async () => {
    monter();
    const etat = await screen.findByTestId('joueur-sans-stats');
    // le nom vient de la feuille de match (/api/lineup, déjà en cache depuis Composition), qui peut arriver après le 404
    expect(await screen.findByRole('heading', { name: 'Justin Bengui' })).toBeInTheDocument();
    expect(etat).toHaveTextContent('Justin Bengui n’a pas encore joué cette saison');
    expect(etat).toHaveTextContent('Gardien');
    expect(etat).toHaveTextContent('#40');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(document.querySelector('.text-loss-fg')).toBeNull();
    expect(screen.queryByText(/Aucune statistique trouvée/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Réessayer' })).toBeNull();
  });

  it('404 : pas de nouvelle tentative (une seule requête season-stats, pas d\'écran de chargement qui traîne)', async () => {
    monter();
    await screen.findByTestId('joueur-sans-stats');
    expect(appelsStats()).toBe(1);
  });

  it('404 sans feuille de match : état neutre générique, le lien Retour reste', async () => {
    lineupBody = null;
    search = { onglet: 'effectif', tri: 'buts' };
    monter();
    const etat = await screen.findByTestId('joueur-sans-stats');
    expect(etat).toHaveTextContent('Ce joueur n’a pas encore joué cette saison');
    const retour = screen.getByRole('link', { name: /Retour à l'effectif/ });
    expect(JSON.parse(retour.getAttribute('data-search')!)).toEqual({ onglet: 'effectif', tri: 'buts' });
  });

  it('500 : vraie erreur (role=alert, rouge) avec Réessayer qui relance la requête', async () => {
    statsStatus = 500;
    monter();
    const alerte = await screen.findByRole('alert');
    expect(alerte).toHaveTextContent('n’ont pas pu être chargées');
    expect(alerte.querySelector('.text-loss-fg')).not.toBeNull();
    expect(screen.queryByTestId('joueur-sans-stats')).toBeNull();
    expect(screen.getByRole('link', { name: /Retour/ })).toBeInTheDocument();
    const avant = appelsStats();
    expect(avant).toBe(2); // un essai + une nouvelle tentative automatique
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    await waitFor(() => expect(appelsStats()).toBeGreaterThan(avant));
  });

  it('réseau coupé (fetch rejette) : même état d\'erreur avec Réessayer', async () => {
    fetchMock.mockImplementation((url: string) =>
      String(url).includes('/lineup') ? Promise.resolve(reponse(200, feuille)) : Promise.reject(new TypeError('Failed to fetch')),
    );
    monter();
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeInTheDocument();
  });
});

describe('<PlayerDetailPage /> — libellé du lien de retour (L178)', () => {
  it.each([
    [{}, 'Retour à la composition'],
    [{ onglet: 'effectif' }, "Retour à l'effectif"],
    [{ onglet: 'stats', tri: 'buts' }, 'Retour aux stats de la saison'],
  ])('depuis %j : « %s », qui garde onglet et tri', async (recu, libelle) => {
    search = recu;
    monter();
    const retour = await screen.findByRole('link', { name: libelle });
    expect(JSON.parse(retour.getAttribute('data-search')!)).toEqual(recu);
  });
});

// L209 — Bengui (133157) n'est pas sur la feuille du dernier match : le nom et le h1 manquaient (## * exige un h1 non vide).
const probable = {
  gameId: 9, matchupId: '9-1', status: 'scheduled', home: { id: 523 }, away: { id: 7 },
  lineups: {
    home: { formation: '4-3-3', probable: true, starters: [], bench: [{ id: 133157, name: 'Justin Bengui', shortName: 'J. Bengui', jerseyNumber: 40, positionShort: 'GK', yardLine: 0, yardSide: 0, ranking: null }] },
    away: { formation: '4-4-2', probable: true, starters: [{ id: 5, name: 'Autre Club', shortName: 'A. Club', jerseyNumber: 9, positionShort: 'FW', yardLine: 0, yardSide: 0, ranking: null }], bench: [] },
  },
};

describe('<PlayerDetailPage /> — nom toujours affiché (L209)', () => {
  it('R1 — absent de la dernière feuille mais sur la feuille probable du prochain match : son nom est le h1', async () => {
    lineupBody = { ...feuille, bench: [] } as LineupResponse;
    currentBody = { gameId: 9, matchupId: '9-1' };
    statsBody = probable;
    monter();
    expect(await screen.findByRole('heading', { level: 1, name: 'Justin Bengui' })).toBeInTheDocument();
    expect(screen.getByTestId('joueur-sans-stats')).toHaveTextContent('Justin Bengui n’a pas encore joué cette saison');
  });

  it('R2 — nulle part : h1 « Joueur » non vide, jamais de page sans h1', async () => {
    lineupBody = null;
    monter();
    expect(await screen.findByRole('heading', { level: 1, name: 'Joueur' })).toBeInTheDocument();
    expect(screen.getByTestId('joueur-sans-stats')).toHaveTextContent('Ce joueur n’a pas encore joué cette saison');
  });

  it('R3 — la feuille du dernier match prime sur la feuille probable', async () => {
    currentBody = { gameId: 9, matchupId: '9-1' };
    statsBody = { ...probable, lineups: { ...probable.lineups, home: { ...probable.lineups.home, bench: [{ ...probable.lineups.home.bench[0], name: 'Nom Probable' }] } } };
    monter();
    expect(await screen.findByRole('heading', { level: 1, name: 'Justin Bengui' })).toBeInTheDocument();
  });
});
