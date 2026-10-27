import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query';
import type { LineupResponse } from '@/types/api';

// L178 — un convoqué qui n'a pas encore joué a un lien vers sa fiche : GET /api/players/<id>/season-stats rend 404.
// Un 404 n'est pas une erreur (état neutre, sans role=alert, sans rouge) ; un 5xx ou le réseau en sont une (Réessayer).
// Le hook réel et un fetch simulé sont utilisés : c'est le statut HTTP qui décide.

let search: Record<string, string | undefined> = {};
let idRoute = '133157';
vi.mock('@tanstack/react-router', () => ({
  useParams: () => ({ athleteId: idRoute }),
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
let squadStatus = 503;
let squadBody: unknown = [];
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
  idRoute = '133157';
  statsStatus = 404;
  lineupBody = feuille;
  currentBody = null;
  statsBody = {};
  squadStatus = 503;
  squadBody = [];
  fetchMock.mockReset();
  fetchMock.mockImplementation((url: string) =>
    Promise.resolve(
      String(url).includes('/lineup') ? reponse(200, lineupBody)
      : String(url).includes('/players/squad') ? reponse(squadStatus, squadBody)
      : String(url).includes('/live-match/current') ? reponse(200, currentBody)
      : String(url).includes('/live-match/') ? reponse(200, statsBody)
      : reponse(statsStatus),
    ),
  );
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  onlineManager.setOnline(true);
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

  it.each([-1, 0])('L213 R1 — numéro %i (inconnu chez 365scores) : aucun « #%i » sous le nom', async (numero) => {
    lineupBody = { ...feuille, bench: [{ ...feuille.bench[0], jerseyNumber: numero }] } as unknown as LineupResponse;
    monter();
    const etat = await screen.findByTestId('joueur-sans-stats');
    expect(await screen.findByRole('heading', { name: 'Justin Bengui' })).toBeInTheDocument();
    expect(etat).toHaveTextContent('Gardien');
    expect(etat).not.toHaveTextContent(/#\s*-?\d/);
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

describe('<PlayerDetailPage /> — la cause de l\'échec est dite (L60)', () => {
  it('L60 R1 — 500 : le serveur est en cause, pas le réseau de l\'utilisateur', async () => {
    statsStatus = 500;
    monter();
    const alerte = await screen.findByRole('alert');
    expect(alerte).toHaveTextContent('Le serveur n’a pas pu répondre');
    expect(alerte).not.toHaveTextContent(/connexion/i);
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeInTheDocument();
  });

  it('L60 R2 — réseau coupé : la connexion est en cause, pas le joueur ni le serveur', async () => {
    fetchMock.mockImplementation((url: string) =>
      String(url).includes('/lineup') ? Promise.resolve(reponse(200, feuille)) : Promise.reject(new TypeError('Failed to fetch')),
    );
    monter();
    const alerte = await screen.findByRole('alert');
    expect(alerte).toHaveTextContent('Connexion impossible');
    expect(alerte).not.toHaveTextContent('Le serveur n’a pas pu répondre');
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeInTheDocument();
  });

  it('L60 R3 — Réessayer après une panne réseau charge la fiche quand la connexion revient', async () => {
    let coupe = true;
    fetchMock.mockImplementation((url: string) =>
      String(url).includes('/lineup') ? Promise.resolve(reponse(200, feuille))
      : coupe ? Promise.reject(new TypeError('Failed to fetch'))
      : Promise.resolve(reponse(404)),
    );
    monter();
    await screen.findByRole('alert');
    coupe = false;
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(await screen.findByTestId('joueur-sans-stats')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('L60 R4 — 404 : ni « connexion » ni « serveur », état neutre sans Réessayer', async () => {
    monter();
    const etat = await screen.findByTestId('joueur-sans-stats');
    expect(etat).not.toHaveTextContent(/connexion|serveur/i);
    expect(screen.queryByRole('button', { name: 'Réessayer' })).toBeNull();
  });

  it.each(['abc', '0', '-3'])('L60 R5 — identifiant « %s » : le joueur est inconnu, pas la connexion, et aucun appel ne part', async (id) => {
    idRoute = id;
    monter();
    const alerte = await screen.findByRole('alert');
    expect(alerte).toHaveTextContent('Joueur inconnu');
    expect(alerte).not.toHaveTextContent(/connexion|serveur/i);
    expect(screen.queryByRole('button', { name: 'Réessayer' })).toBeNull();
    expect(screen.getByRole('link', { name: /Retour/ })).toBeInTheDocument();
    expect(appelsStats()).toBe(0);
  });

  it('L60 R6 — hors ligne (requête en pause) : « Connexion impossible » avec Réessayer, aucun appel season-stats', async () => {
    onlineManager.setOnline(false);
    monter();
    const alerte = await screen.findByRole('alert');
    expect(alerte).toHaveTextContent('Connexion impossible');
    expect(alerte).not.toHaveTextContent('Le serveur n’a pas pu répondre');
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeInTheDocument();
    expect(appelsStats()).toBe(0);
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
// Forme réelle de /api/live-match/<gameId>/stats : équipes en identifiants 365scores (OL = 465), `id` d'un joueur = identifiant
// de membre du match (68071622), distinct de l'`athleteId` de la route (133157).
const joueurProbable = (id: number, athleteId: number | undefined, name: string) => ({
  id, athleteId, name, shortName: name, jerseyNumber: 40, positionShort: 'GK', yardLine: 0, yardSide: 0, ranking: null,
});
const feuilleVide = { formation: '4-3-3', probable: true, starters: [], bench: [] };
const probable = (olALExterieur: boolean, bengui: ReturnType<typeof joueurProbable>) => {
  const ol = { ...feuilleVide, bench: [bengui] };
  const autre = { ...feuilleVide, starters: [joueurProbable(5, 133157, 'Joueur Adverse')] };
  return {
    gameId: 9, matchupId: '9-1', status: 'scheduled',
    home: { id: olALExterieur ? 351 : 465 }, away: { id: olALExterieur ? 465 : 351 },
    lineups: olALExterieur ? { home: autre, away: ol } : { home: ol, away: autre },
  };
};

describe('<PlayerDetailPage /> — nom toujours affiché (L209)', () => {
  it.each([[true, 'OL à l\'extérieur'], [false, 'OL à domicile']])('R1 — absent de la dernière feuille mais sur la feuille probable du prochain match (%s) : son nom est le h1, retrouvé par athleteId et dans la feuille de l\'OL', async (olALExterieur) => {
    lineupBody = { ...feuille, bench: [] } as LineupResponse;
    currentBody = { gameId: 9, matchupId: '9-1' };
    statsBody = probable(olALExterieur, joueurProbable(68071622, 133157, 'Justin Bengui'));
    monter();
    expect(await screen.findByRole('heading', { level: 1, name: 'Justin Bengui' })).toBeInTheDocument();
    expect(screen.getByTestId('joueur-sans-stats')).toHaveTextContent('Justin Bengui n’a pas encore joué cette saison');
    // Le poste de la feuille probable est un code (« GK », abbreviatePosition) : affiché en français comme sur la dernière feuille.
    expect(screen.getByTestId('joueur-sans-stats')).toHaveTextContent('Gardien · #40');
    expect(screen.getByTestId('joueur-sans-stats')).not.toHaveTextContent('GK');
  });

  it('R1 — un id de membre égal à l\'athleteId de la route, sans athleteId, ne désigne pas ce joueur', async () => {
    lineupBody = null;
    currentBody = { gameId: 9, matchupId: '9-1' };
    statsBody = probable(true, joueurProbable(133157, undefined, 'Autre Joueur'));
    monter();
    // Le h1 « Joueur » est déjà là au premier rendu : attendre la réponse de la feuille probable avant de conclure.
    await waitFor(() => expect(fetchMock.mock.calls.some(([u]) => String(u).includes('/live-match/9/stats'))).toBe(true));
    await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/^Joueur$/);
    expect(screen.queryByText('Autre Joueur')).toBeNull();
  });

  it('R2 — nulle part : h1 « Joueur » non vide, jamais de page sans h1', async () => {
    lineupBody = null;
    monter();
    expect(await screen.findByRole('heading', { level: 1, name: 'Joueur' })).toBeInTheDocument();
    expect(screen.getByTestId('joueur-sans-stats')).toHaveTextContent('Ce joueur n’a pas encore joué cette saison');
  });

  it('R3 — la feuille du dernier match prime sur la feuille probable', async () => {
    currentBody = { gameId: 9, matchupId: '9-1' };
    statsBody = probable(true, joueurProbable(68071622, 133157, 'Nom Probable'));
    monter();
    expect(await screen.findByRole('heading', { level: 1, name: 'Justin Bengui' })).toBeInTheDocument();
    await waitFor(() => expect(fetchMock.mock.calls.some(([u]) => String(u).includes('/live-match/9'))).toBe(true));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Justin Bengui');
  });
});

// L210 — hors des 24 h avant un match, aucune feuille probable n'est publiée : le nom vient de l'effectif de l'OL
// (GET /api/players/squad, lu sur /web/squads competitors=465), où tout joueur sous contrat figure, blessé ou absent compris.
const effectif = [
  { athleteId: 133157, name: 'Justin Bengui', position: 'Goalkeeper', jerseyNumber: 25 },
  { athleteId: 4569, name: 'Clinton Mata', position: 'Defender', jerseyNumber: null },
];

describe('<PlayerDetailPage /> — nom lu dans l\'effectif (L210)', () => {
  it('R1 — un jour sans match (ni feuille, ni match en cours) : le nom, le poste et le numéro de l\'effectif', async () => {
    lineupBody = null;
    currentBody = null;
    squadStatus = 200;
    squadBody = effectif;
    monter();
    expect(await screen.findByRole('heading', { level: 1, name: 'Justin Bengui' })).toBeInTheDocument();
    const etat = screen.getByTestId('joueur-sans-stats');
    expect(etat).toHaveTextContent('Justin Bengui n’a pas encore joué cette saison');
    expect(etat).toHaveTextContent('Gardien · #25');
    expect(etat).not.toHaveTextContent('Goalkeeper');
  });

  it('R2 — un joueur de l\'effectif sans numéro : nom et poste, pas de « # »', async () => {
    search = {};
    lineupBody = null;
    squadStatus = 200;
    squadBody = [{ ...effectif[0], jerseyNumber: null }];
    monter();
    const etat = await screen.findByTestId('joueur-sans-stats');
    await screen.findByRole('heading', { level: 1, name: 'Justin Bengui' });
    expect(etat).toHaveTextContent('Gardien');
    expect(etat).not.toHaveTextContent('#');
  });

  it('R3 — la feuille du dernier match prime sur l\'effectif', async () => {
    squadStatus = 200;
    squadBody = [{ ...effectif[0], name: 'Nom Effectif' }];
    monter();
    expect(await screen.findByRole('heading', { level: 1, name: 'Justin Bengui' })).toBeInTheDocument();
    await waitFor(() => expect(fetchMock.mock.calls.some(([u]) => String(u).includes('/players/squad'))).toBe(true));
    await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Justin Bengui');
  });

  it('R3 — la feuille probable du prochain match prime sur l\'effectif (poste et numéro de la feuille, #40 et non #25)', async () => {
    lineupBody = null;
    currentBody = { gameId: 9, matchupId: '9-1' };
    statsBody = probable(true, joueurProbable(68071622, 133157, 'Nom Probable'));
    squadStatus = 200;
    squadBody = [{ ...effectif[0], name: 'Nom Effectif' }];
    monter();
    expect(await screen.findByRole('heading', { level: 1, name: 'Nom Probable' })).toBeInTheDocument();
    await waitFor(() => expect(fetchMock.mock.calls.some(([u]) => String(u).includes('/players/squad'))).toBe(true));
    await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Nom Probable');
    expect(screen.getByTestId('joueur-sans-stats')).toHaveTextContent('Gardien · #40');
  });

  it('R4 — effectif en échec : h1 « Joueur » et état neutre, jamais d\'alerte (on ne conclut pas sur une absence de réponse)', async () => {
    lineupBody = null;
    squadStatus = 503;
    monter();
    expect(await screen.findByRole('heading', { level: 1, name: 'Joueur' })).toBeInTheDocument();
    await waitFor(() => expect(fetchMock.mock.calls.some(([u]) => String(u).includes('/players/squad'))).toBe(true));
    await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/^Joueur$/);
    expect(screen.getByTestId('joueur-sans-stats')).toHaveTextContent('Ce joueur n’a pas encore joué cette saison');
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

// L60 — constat 2 : un 404 pour un joueur que ni la dernière feuille, ni la feuille probable, ni l'effectif ne connaissent
// est un joueur inconnu (/player/999999), pas un joueur « qui n'a pas encore joué ».
describe('<PlayerDetailPage /> — joueur inconnu de toutes les sources (L60)', () => {
  it('R7 — effectif répondu sans ce joueur, feuilles sans lui : h1 « Joueur inconnu », pas « n\'a pas encore joué »', async () => {
    idRoute = '999999';
    squadStatus = 200;
    squadBody = effectif;
    monter();
    expect(await screen.findByRole('heading', { level: 1, name: 'Joueur inconnu' })).toBeInTheDocument();
    const bloc = screen.getByRole('alert');
    expect(bloc).toHaveTextContent('ne figure pas dans l’effectif');
    expect(bloc).not.toHaveTextContent(/pas encore joué|connexion|serveur/i);
    expect(screen.queryByTestId('joueur-sans-stats')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Réessayer' })).toBeNull();
    expect(screen.getByRole('link', { name: /Retour/ })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('R7 — l\'état « Joueur inconnu » est posé sur --surface (lisible sur la photo de fond)', async () => {
    idRoute = '999999';
    squadStatus = 200;
    squadBody = effectif;
    monter();
    const bloc = (await screen.findByRole('heading', { level: 1, name: 'Joueur inconnu' })).closest('section')!;
    expect(bloc).toHaveClass('bg-surface');
  });

  it('R7 — le joueur est dans l\'effectif seulement : état neutre sous son nom, pas « inconnu »', async () => {
    lineupBody = null;
    squadStatus = 200;
    squadBody = effectif;
    monter();
    expect(await screen.findByRole('heading', { level: 1, name: 'Justin Bengui' })).toBeInTheDocument();
    expect(screen.queryByText('Joueur inconnu')).toBeNull();
  });

  it('R7 — le joueur est sur la feuille du dernier match mais pas dans l\'effectif : connu, état neutre', async () => {
    squadStatus = 200;
    squadBody = [effectif[1]];
    monter();
    expect(await screen.findByRole('heading', { level: 1, name: 'Justin Bengui' })).toBeInTheDocument();
    await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
    expect(screen.queryByText('Joueur inconnu')).toBeNull();
  });

  it('R7 — l\'effectif a répondu mais la feuille probable est encore attendue : on ne conclut pas « inconnu »', async () => {
    lineupBody = null;
    currentBody = { gameId: 9, matchupId: '9-1' };
    statsBody = probable(true, joueurProbable(68071622, 133157, 'Justin Bengui'));
    squadStatus = 200;
    squadBody = [effectif[1]];
    monter();
    expect(await screen.findByRole('heading', { level: 1, name: 'Justin Bengui' })).toBeInTheDocument();
    expect(screen.queryByText('Joueur inconnu')).toBeNull();
  });
});

// L60 — constat 3 : pendant le nouvel essai, le bloc d'erreur, le bouton et le lien restent ; le focus ne bouge pas.
describe('<PlayerDetailPage /> — Réessayer garde le bloc d\'erreur et le focus (L60)', () => {
  function reseauCoupeJusqu() {
    let relache!: (v: ReturnType<typeof reponse>) => void;
    const enAttente = new Promise<ReturnType<typeof reponse>>((r) => { relache = r; });
    let essais = 0;
    fetchMock.mockImplementation((url: string) => {
      const u = String(url);
      if (u.includes('/lineup')) return Promise.resolve(reponse(200, feuille));
      if (u.includes('/season-stats')) {
        essais += 1;
        return essais <= 2 ? Promise.reject(new TypeError('Failed to fetch')) : enAttente;
      }
      return Promise.resolve(reponse(200, null));
    });
    return relache;
  }

  it('R8 — pendant le nouvel essai : bloc, bouton « Nouvel essai… » aria-disabled et lien Retour restent, focus sur le bouton, pas de « Chargement du joueur… »', async () => {
    const relache = reseauCoupeJusqu();
    monter();
    const alerte = await screen.findByRole('alert');
    const bouton = screen.getByRole('button', { name: 'Réessayer' });
    expect(bouton).toHaveAttribute('aria-disabled', 'false');
    bouton.focus();
    expect(bouton).toHaveFocus();
    fireEvent.click(bouton);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Nouvel essai…' })).toBeInTheDocument());
    const apres = screen.getByRole('button', { name: 'Nouvel essai…' });
    expect(apres).toBe(bouton); // même élément DOM : le focus n'est pas perdu
    expect(apres).toHaveFocus();
    expect(apres).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('alert')).toBe(alerte); // zone aria-live inchangée, qui annonce le nouvel libellé
    expect(alerte).toContainElement(apres);
    expect(alerte).toHaveTextContent('Connexion impossible');
    expect(screen.getByRole('link', { name: /Retour/ })).toBeInTheDocument();
    expect(screen.queryByText(/Chargement du joueur/)).toBeNull();
    relache(reponse(404));
    expect(await screen.findByTestId('joueur-sans-stats')).toBeInTheDocument();
  });

  it('R8 — aria-disabled : un clic pendant le nouvel essai ne relance rien', async () => {
    const relache = reseauCoupeJusqu();
    monter();
    await screen.findByRole('alert');
    const avant = () => appelsStats();
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    const bouton = await screen.findByRole('button', { name: 'Nouvel essai…' });
    const n = avant();
    fireEvent.click(bouton);
    fireEvent.click(bouton);
    expect(avant()).toBe(n);
    relache(reponse(404));
    await screen.findByTestId('joueur-sans-stats');
  });

  it('R8 — le nouvel essai échoue encore : le bouton redevient « Réessayer », toujours le même, focus gardé', async () => {
    fetchMock.mockImplementation((url: string) =>
      String(url).includes('/lineup') ? Promise.resolve(reponse(200, feuille)) : Promise.reject(new TypeError('Failed to fetch')),
    );
    monter();
    await screen.findByRole('alert');
    const bouton = screen.getByRole('button', { name: 'Réessayer' });
    bouton.focus();
    fireEvent.click(bouton);
    await screen.findByRole('button', { name: 'Nouvel essai…' });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Réessayer' })).toHaveAttribute('aria-disabled', 'false'));
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBe(bouton);
    expect(bouton).toHaveFocus();
  });
});

// L60 — constat 5 : jamais une fiche sans h1 (L209) ; constat 4 : le bloc d'erreur est posé sur --surface ;
// constat 1 : contour de focus visible en --ol-red-bright (WCAG 2.4.7, 1.4.11).
describe('<PlayerDetailPage /> — h1, fond et focus des états d\'erreur (L60)', () => {
  it('R9 — « Statistiques indisponibles » a un h1 unique, sur --surface, titre et message en text-loss-fg lisibles', async () => {
    statsStatus = 500;
    monter();
    const h1 = await screen.findByRole('heading', { level: 1, name: 'Statistiques indisponibles' });
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(h1.closest('section')).toHaveClass('bg-surface');
    expect(screen.getByRole('alert').querySelector('.text-loss-fg')).not.toBeNull();
  });

  it.each(['abc', '0'])('R9 — identifiant « %s » : h1 « Joueur inconnu » sur --surface', async (id) => {
    idRoute = id;
    monter();
    const h1 = await screen.findByRole('heading', { level: 1, name: 'Joueur inconnu' });
    expect(h1.closest('section')).toHaveClass('bg-surface');
  });

  it('R10 — « Réessayer » : contour focus-visible --ol-red-bright, plus de focus:outline-none ni de focus:ring', async () => {
    statsStatus = 500;
    monter();
    const bouton = await screen.findByRole('button', { name: 'Réessayer' });
    expect(bouton.className).toContain('focus-visible:outline-2');
    expect(bouton.className).toContain('focus-visible:outline-[hsl(var(--ol-red-bright))]');
    expect(bouton.className).not.toMatch(/focus:outline-none|focus:ring/);
  });
});
