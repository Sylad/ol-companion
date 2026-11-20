import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { LiveMatchStats } from '@/types/api';

// L265 — « Ce que ça change » sur la page d'un match : seulement sous un match de Ligue 1 de l'OL terminé,
// avec la mention football-data.org dans la note des sources tant que le bloc montre une donnée de football-data.

// Le setup commun garde ce hook « en chargement » ; ici, le vrai, servi par un fetch simulé.
vi.unmock('@/hooks/use-match-impact');

let courant: LiveMatchStats;
let matchup = '523-3250-4672325';

vi.mock('@tanstack/react-router', () => ({
  useParams: () => ({ gameId: '4672325' }),
  useSearch: () => ({ matchupId: matchup }),
  Link: ({ children }: { children: React.ReactNode }) => <a href="/">{children}</a>,
}));
vi.mock('@/hooks/use-match-event-burst', () => ({ useMatchEventBurst: () => null }));
vi.mock('@/components/match-event-burst', () => ({ MatchEventBurst: () => null }));
vi.mock('@/hooks/use-live-match', () => ({ useLiveMatchStats: () => ({ isLoading: false, isError: false, data: courant }) }));

import { MatchPage } from './match';

(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };

const IMPACT = {
  matchday: 9, finished: true, homeTeam: 'Lyon', awayTeam: 'Nice', score: { home: 2, away: 1 },
  before: { position: 5, points: 14 }, after: { position: 3, points: 17 },
  remaining: 0, remainingInMatchday: 0,
  above: { place: 1, gap: 2 }, below: { place: 3, margin: 1 },
  updatedAt: '2026-10-05T22:00:00Z',
};

function stats(over: Partial<LiveMatchStats>): LiveMatchStats {
  return {
    gameId: 4672325, matchupId: '523-3250-4672325', competitionId: 35, competitionName: 'Ligue 1', status: 'ended',
    statusGroup: 4, statusText: 'Terminé', gameTime: 90, gameTimeDisplay: "90'", startTime: '2026-10-05T20:45:00+02:00',
    home: { id: 523, name: 'Lyon', symbolicName: 'OL', imageVersion: 1, score: 2 },
    away: { id: 3250, name: 'Nice', symbolicName: 'NIC', imageVersion: 1, score: 1 },
    teamStats: { home: {}, away: {} }, events: [], topPerformers: [], shots: [], updatedAt: '2026-10-05T23:00:00Z',
    standings: [
      { position: 2, teamId: 1, name: 'Lens', played: 9, points: 18, goalDifference: 6, isLive: false, isOl: false },
      { position: 3, teamId: 465, name: 'Lyon', played: 9, points: 17, goalDifference: 5, isLive: false, isOl: true },
      { position: 4, teamId: 2, name: 'Nice', played: 9, points: 16, goalDifference: 2, isLive: false, isOl: false },
    ],
    ...over,
  } as unknown as LiveMatchStats;
}

let urls: string[] = [];
/** fetch simulé : `/api/match-impact` répond `reponse` (ou reste en attente si `null`). */
function stub(reponse: { status: number; body?: unknown } | null) {
  urls = [];
  vi.stubGlobal('fetch', vi.fn((url: string) => {
    urls.push(url);
    if (reponse === null) return new Promise(() => {});
    return Promise.resolve({ ok: reponse.status < 400, status: reponse.status, json: async () => reponse.body });
  }));
}

function page() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><MatchPage /></QueryClientProvider>);
}

const MENTION = /Ce que ça change \(classement\) : Football data provided by the Football-Data\.org API\./;
const appelsImpact = () => urls.filter((u) => u.startsWith('/api/match-impact'));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  matchup = '523-3250-4672325';
});

describe('L265 — « Ce que ça change » sur la page du match', () => {
  it('Ligue 1 terminé : le bloc dit la place avant/après, en dernière rangée du centre (sous le mini-classement), et la note cite football-data', async () => {
    courant = stats({});
    stub({ status: 200, body: IMPACT });
    page();
    const phrase = await screen.findByTestId('ce-que-ca-change-phrase');
    expect(phrase.textContent).toBe('Lyon passe de 5e à 3e, à 2 points de la 1re place et 1 point d’avance sur la 4e place.');
    expect(appelsImpact()).toEqual(['/api/match-impact?at=2026-10-05T20%3A45%3A00%2B02%3A00']);
    // Revue UX r1 : rangée à part, dernière du centre, sous la rangée Carte des tirs | pile (hors de la pile étroite).
    const bloc = screen.getByTestId('ce-que-ca-change');
    expect(bloc.parentElement).toBe(screen.getByTestId('colonne-centre'));
    expect(bloc.previousElementSibling).toBe(screen.getByTestId('rangee-tirs-joueurs'));
    expect(bloc.nextElementSibling).toBeNull();
    expect(screen.getByTestId('colonne-centre-bas').contains(bloc)).toBe(false);
    expect(bloc.querySelector('h2')?.textContent).toMatch(/Ce que ça change/);
    expect(screen.getByTestId('ce-que-ca-change-gabarit')).toBeInTheDocument(); // place du cas le plus long (M1)
    expect(screen.queryByTestId('ce-que-ca-change-provisoire')).toBeNull();
    const note = screen.getByTestId('sources-match');
    expect(note.textContent).toMatch(MENTION);
    expect(note.textContent).toMatch(/365scores/);
  });

  it('journée incomplète : badge « Provisoire » et matchs restants', async () => {
    courant = stats({});
    stub({ status: 200, body: { ...IMPACT, remaining: 2, remainingInMatchday: 2 } });
    page();
    expect((await screen.findByTestId('ce-que-ca-change-provisoire')).textContent).toBe(
      'Classement provisoire : 2 matchs de la 9e journée restent à jouer.',
    );
    expect(screen.getByRole('region', { name: /Ce que ça change/ }).textContent).toContain('Provisoire');
  });

  it('chargement : la place du bloc est réservée (aria-busy), sans mention football-data tant que rien n’est affiché', () => {
    courant = stats({});
    stub(null);
    page();
    const bloc = screen.getByTestId('ce-que-ca-change');
    expect(bloc.getAttribute('aria-busy')).toBe('true');
    expect(screen.getByTestId('ce-que-ca-change-chargement')).toBeInTheDocument();
    expect(screen.getByTestId('sources-match').textContent).not.toMatch(/football-data/i);
  });

  it('match inconnu de football-data (404) : ni bloc, ni rangée vide, ni mention', async () => {
    courant = stats({});
    stub({ status: 404 });
    page();
    expect(screen.getByTestId('ce-que-ca-change')).toBeInTheDocument(); // place réservée pendant le chargement
    await waitFor(() => expect(screen.queryByTestId('ce-que-ca-change')).toBeNull());
    expect(appelsImpact()).toHaveLength(1);
    expect(screen.getByTestId('sources-match').textContent).not.toMatch(/football-data/i);
    // Le bloc ne crée plus de pile : sans Joueurs en vue ni classement, aucune pile, même pendant le chargement.
    cleanup();
    courant = stats({ standings: undefined });
    stub(null);
    page();
    expect(screen.getByTestId('ce-que-ca-change')).toBeInTheDocument();
    expect(screen.queryByTestId('colonne-centre-bas')).toBeNull();
  });

  it('panne (503) : le bloc le dit, la note ne cite pas football-data', async () => {
    courant = stats({});
    stub({ status: 503 });
    page();
    // Le hook rejoue une fois une panne (pas un 404), après 1 s.
    expect((await screen.findByTestId('ce-que-ca-change-erreur', {}, { timeout: 4000 })).textContent).toMatch(/indisponible/);
    expect(screen.getByTestId('sources-match').textContent).not.toMatch(/football-data/i);
  });

  it.each([
    ['Coupe de France terminée', () => stats({ competitionId: 37, competitionName: 'Coupe de France' })],
    ['Ligue Europa terminée', () => stats({ competitionId: 573, competitionName: 'Ligue Europa' })],
    ['Ligue 1 à venir', () => stats({ status: 'upcoming', statusGroup: 2, home: { id: 523, name: 'Lyon', symbolicName: 'OL', imageVersion: 1 }, away: { id: 3250, name: 'Nice', symbolicName: 'NIC', imageVersion: 1 } } as Partial<LiveMatchStats>)],
    ['Ligue 1 en direct', () => stats({ status: 'live', statusGroup: 3, statusText: '1re mi-temps', gameTime: 30, gameTimeDisplay: "30'" })],
  ])('%s : aucun appel à /api/match-impact, aucun bloc', async (_nom, faire) => {
    courant = faire();
    stub({ status: 200, body: IMPACT });
    page();
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByTestId('ce-que-ca-change')).toBeNull();
    expect(appelsImpact()).toEqual([]);
    expect(screen.getByTestId('sources-match').textContent).not.toMatch(/Ce que ça change/);
  });

  it('match des Bleus terminé : aucun appel, aucun bloc', async () => {
    matchup = '5061-5054-4672325';
    courant = stats({
      matchupId: matchup, competitionId: 35,
      home: { id: 5061, name: 'France', symbolicName: 'FRA', imageVersion: 1, score: 2 },
      away: { id: 5054, name: 'Italie', symbolicName: 'ITA', imageVersion: 1, score: 1 },
    } as Partial<LiveMatchStats>);
    stub({ status: 200, body: IMPACT });
    page();
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByTestId('ce-que-ca-change')).toBeNull();
    expect(appelsImpact()).toEqual([]);
  });
});
