import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LastResult } from './last-result';
import { CeQueCaChange } from './ce-que-ca-change';

// L265 — « Ce que ça change » : le bloc lit /api/match-impact (football-data.org) et dit toujours son état.

const IMPACT = {
  matchday: 9, finished: true, homeTeam: 'Lyon', awayTeam: 'Nice', score: { home: 2, away: 1 },
  before: { position: 5, points: 14 }, after: { position: 3, points: 17 },
  remaining: 2, remainingInMatchday: 2,
  above: { place: 1, gap: 2 }, below: { place: 3, margin: 1 },
  updatedAt: '2026-11-02T22:00:00Z',
};

const L1_MATCH = {
  id: 1, date: '2026-11-01T19:45:00Z', homeTeam: 'Olympique Lyonnais', homeTeamId: 523, awayTeam: 'Nice', awayTeamId: 522,
  homeScore: 2, awayScore: 1, competition: 'Ligue 1', competitionCode: 'L1', competitionId: 35, status: 'FINISHED', matchday: 9,
};

type Reponse = { status: number; body?: unknown };
let urls: string[] = [];

function stub(routes: (url: string) => Reponse) {
  urls = [];
  vi.stubGlobal('fetch', vi.fn((url: string) => {
    urls.push(url);
    const r = routes(url);
    return Promise.resolve({ ok: r.status < 400, status: r.status, json: async () => r.body });
  }));
}

function withClient(ui: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

afterEach(() => vi.unstubAllGlobals());

describe('<CeQueCaChange /> (L265)', () => {
  it('demande le match par son instant et affiche la phrase et le marquage provisoire', async () => {
    stub(() => ({ status: 200, body: IMPACT }));
    withClient(<CeQueCaChange at="2026-11-01T19:45:00Z" />);
    expect((await screen.findByTestId('ce-que-ca-change-phrase')).textContent).toBe(
      'Lyon passe de 5e à 3e, à 2 points de la 1re place et 1 point d’avance sur la 4e place.',
    );
    expect(screen.getByTestId('ce-que-ca-change-provisoire').textContent).toBe('Classement provisoire : 2 matchs de la 9e journée restent à jouer.');
    expect(screen.getByRole('region', { name: /Ce que ça change/ }).textContent).toContain('Provisoire');
    expect(urls).toEqual(['/api/match-impact?at=2026-11-01T19%3A45%3A00Z']);
  });

  it('journée complète : ni badge ni ligne provisoire', async () => {
    stub(() => ({ status: 200, body: { ...IMPACT, remaining: 0, remainingInMatchday: 0 } }));
    withClient(<CeQueCaChange at="2026-11-01T19:45:00Z" />);
    await screen.findByTestId('ce-que-ca-change-phrase');
    expect(screen.queryByTestId('ce-que-ca-change-provisoire')).toBeNull();
    expect(screen.getByTestId('ce-que-ca-change').textContent).not.toContain('Provisoire');
  });

  it('résultat pas encore chez football-data : le bloc le dit', async () => {
    stub(() => ({ status: 200, body: { ...IMPACT, finished: false, before: null, after: null, above: null, below: null } }));
    withClient(<CeQueCaChange at="2026-11-01T19:45:00Z" />);
    expect((await screen.findByTestId('ce-que-ca-change-attente')).textContent).toBe('Classement en attente du résultat officiel.');
  });

  it('panne (503) : message visible, jamais un bloc vide', async () => {
    stub(() => ({ status: 503 }));
    withClient(<CeQueCaChange at="2026-11-01T19:45:00Z" />);
    // Le hook rejoue une fois une panne (pas un 404), après 1 s.
    expect((await screen.findByTestId('ce-que-ca-change-erreur', {}, { timeout: 4000 })).textContent).toMatch(/indisponible/);
  });

  it('match inconnu de football-data (404) : rien', async () => {
    stub(() => ({ status: 404 }));
    withClient(<CeQueCaChange at="2026-11-01T19:45:00Z" />);
    await waitFor(() => expect(urls).toHaveLength(1));
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByTestId('ce-que-ca-change')).toBeNull();
  });
});

describe('<LastResult /> — « Ce que ça change » (L265)', () => {
  it('Ligue 1 : la phrase est dans la carte, entre le score et le pied', async () => {
    stub((url) => (url.startsWith('/api/match-impact') ? { status: 200, body: IMPACT } : { status: 200, body: [L1_MATCH] }));
    withClient(<LastResult />);
    const bloc = await screen.findByTestId('ce-que-ca-change');
    const carte = screen.getByTestId('dernier-resultat');
    expect(carte.contains(bloc)).toBe(true);
    expect(bloc.nextElementSibling?.tagName).toBe('FOOTER');
    expect(urls).toContain('/api/match-impact?at=2026-11-01T19%3A45%3A00Z');
  });

  it('hors Ligue 1 : aucun appel, aucun bloc', async () => {
    stub(() => ({ status: 200, body: [{ ...L1_MATCH, competition: 'Coupe de France', competitionCode: 'CDF', competitionId: 37, matchday: null }] }));
    withClient(<LastResult />);
    await screen.findByTestId('dernier-resultat');
    expect(screen.queryByTestId('ce-que-ca-change')).toBeNull();
    expect(urls.some((u) => u.startsWith('/api/match-impact'))).toBe(false);
  });
});
