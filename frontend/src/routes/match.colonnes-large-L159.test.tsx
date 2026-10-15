import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';

// L159 — à partir de xl, BalancedColumns mesure les blocs (offsetHeight), les répartit et
// observe leur taille. Un bloc qui change de colonne garde son nœud (pas de remontage) et
// reste observé : sa croissance relance l'équilibrage.

vi.mock('@tanstack/react-router', () => ({
  useParams: () => ({ gameId: '10' }),
  useSearch: () => ({ matchupId: '465-1-10' }),
  Link: ({ children }: { children: React.ReactNode }) => <a href="/">{children}</a>,
}));
vi.mock('@/hooks/use-match-event-burst', () => ({ useMatchEventBurst: () => null }));
vi.mock('@/hooks/use-live-match', () => ({
  useLiveMatchStats: () => ({
    isLoading: false,
    isError: false,
    data: {
      status: 'finished',
      competitionName: 'Ligue 1',
      home: { id: 465, name: 'Lyon', score: 2 },
      away: { id: 1, name: 'Nice', score: 1 },
      teamStats: { home: { Touches: 50 }, away: { Touches: 40 } },
      events: [],
      topPerformers: [],
      shots: [{}],
      momentum: [{}],
      standings: [{}],
      lineups: { home: { starters: [], bench: [] }, away: { starters: [], bench: [] } },
    },
  }),
}));
vi.mock('@/components/shot-map', () => ({ ShotMap: () => <div data-testid="carte-tirs" /> }));
vi.mock('@/components/momentum-chart', () => ({ MomentumChart: () => <div data-testid="momentum" /> }));
vi.mock('@/components/lineup-card', () => ({ LineupCard: () => <div data-testid="compo" /> }));
vi.mock('@/components/mini-standings', () => ({ MiniStandings: () => <div data-testid="classement" /> }));
vi.mock('@/components/match-event-burst', () => ({ MatchEventBurst: () => null }));

import { MatchPage } from './match';

// Hauteur simulée par bloc (clé = data-bloc du conteneur).
const hauteurs: Record<string, number> = {};
let rappels: (() => void)[] = [];
let observes = new Set<Element>();

beforeEach(() => {
  for (const k of Object.keys(hauteurs)) delete hauteurs[k];
  rappels = [];
  observes = new Set();
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: true,
    media: q,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(cb: () => void) {
        rappels.push(cb);
      }
      observe(el: Element) {
        observes.add(el);
      }
      unobserve(el: Element) {
        observes.delete(el);
      }
      disconnect() {
        observes.clear();
      }
    },
  );
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
    configurable: true,
    get(this: HTMLElement) {
      return hauteurs[this.dataset.bloc ?? ''] ?? 0;
    },
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  // @ts-expect-error retire la surcharge de test
  delete HTMLElement.prototype.offsetHeight;
});

const bloc = (k: string) => document.querySelector(`[data-bloc="${k}"]`) as HTMLElement;
const colonneDe = (k: string) => bloc(k).parentElement!.dataset.testid;
const notifier = () => act(() => rappels.forEach((cb) => cb()));

describe('<MatchPage /> — colonnes mesurées à partir de xl (L159)', () => {
  it('garde la disposition par défaut quand elle tient la cible', () => {
    Object.assign(hauteurs, { momentum: 300, tirs: 400, 'compo-ol': 300, stats: 500, 'compo-adverse': 300, classement: 200 });
    render(<MatchPage />);
    notifier();
    expect(colonneDe('momentum')).toBe('colonne-centre');
    expect(colonneDe('classement')).toBe('colonne-droite');
  });

  it('rééquilibre quand la disposition par défaut dépasse la cible, et observe tous les blocs', () => {
    Object.assign(hauteurs, { momentum: 400, tirs: 400, 'compo-ol': 400, stats: 400, 'compo-adverse': 400, classement: 400 });
    render(<MatchPage />);
    notifier();
    const hauts = ['colonne-gauche', 'colonne-centre', 'colonne-droite'].map((c) => {
      const col = screen.getByTestId(c);
      return [...col.children].reduce((t, el) => t + (hauteurs[(el as HTMLElement).dataset.bloc!] ?? 0) + 16, -16);
    });
    expect(Math.max(...hauts) - Math.min(...hauts)).toBeLessThan(150);
    for (const k of Object.keys(hauteurs)) expect(observes.has(bloc(k))).toBe(true);
  });

  it('un bloc déplacé garde son nœud, reste observé, et sa croissance relance l\'équilibrage', () => {
    Object.assign(hauteurs, { momentum: 200, tirs: 300, 'compo-ol': 200, stats: 400, 'compo-adverse': 600, classement: 700 });
    render(<MatchPage />);
    notifier();
    const noeuds = Object.fromEntries(Object.keys(hauteurs).map((k) => [k, bloc(k)]));
    const colonnes = Object.fromEntries(Object.keys(hauteurs).map((k) => [k, colonneDe(k)]));
    hauteurs.classement = 100;
    hauteurs.momentum = 900;
    notifier();
    for (const k of Object.keys(hauteurs)) {
      expect(bloc(k)).toBe(noeuds[k]);
      expect(observes.has(bloc(k))).toBe(true);
    }
    const apres = Object.keys(hauteurs).map(colonneDe);
    expect(apres).not.toEqual(Object.values(colonnes));
    // le bloc grandi reste dans une colonne : la page contient toujours chaque bloc une fois
    expect(within(screen.getByTestId('colonne-gauche')).queryAllByTestId('momentum').length
      + within(screen.getByTestId('colonne-centre')).queryAllByTestId('momentum').length
      + within(screen.getByTestId('colonne-droite')).queryAllByTestId('momentum').length).toBe(1);
  });
});
