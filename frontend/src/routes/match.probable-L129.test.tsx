import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import type { LiveMatchLineup, LiveMatchLineupPlayer, LiveMatchStats } from '@/types/api';

// L129 — match à venir : composition étiquetée « probable », numéro de maillot 0 masqué.
// Fichier à part : le test d'acceptation de L43 (match.composition-L43.test.tsx) est scellé
// (docs/specs/composition-match/acceptation-L43.json) et ne doit pas changer.
// Appel simulé : GET /api/live-match/{gameId}/stats, via le hook useLiveMatchStats.

type HookResult = { isLoading: boolean; isError: boolean; data: LiveMatchStats | undefined };
let hook: HookResult;

vi.mock('@tanstack/react-router', () => ({
  useParams: () => ({ gameId: '10' }),
  useSearch: () => ({ matchupId: '465-1-10' }),
  Link: ({ children }: { children: React.ReactNode }) => <a href="/">{children}</a>,
}));
vi.mock('@/hooks/use-match-event-burst', () => ({ useMatchEventBurst: () => null }));
vi.mock('@/hooks/use-live-match', () => ({ useLiveMatchStats: () => hook }));
vi.mock('@/components/shot-map', () => ({ ShotMap: () => null }));
vi.mock('@/components/momentum-chart', () => ({ MomentumChart: () => null }));
vi.mock('@/components/mini-standings', () => ({ MiniStandings: () => null }));
vi.mock('@/components/match-event-burst', () => ({ MatchEventBurst: () => null }));

import { MatchPage } from './match';

let nextId = 1;
const p = (name: string, jersey: number, yardLine: number, yardSide: number, pos = 'CM'): LiveMatchLineupPlayer => ({
  id: nextId++, name, shortName: name, jerseyNumber: jersey, positionShort: pos, yardLine, yardSide, ranking: null,
});

// Ordre volontairement mélangé : le découpage doit venir du tri yardLine puis yardSide.
const OL_421: LiveMatchLineupPlayer[] = [
  p('Lucas Perri', 1, 1, 50, 'GK'),
  p('Maitland-Niles', 2, 2, 85, 'RB'), p('Tagliafico', 3, 2, 15, 'LB'), p('Niakhaté', 4, 2, 40, 'CB'), p('Mata', 5, 2, 60, 'CB'),
  p('Matic', 8, 3, 35, 'DM'), p('Tessmann', 6, 3, 65, 'DM'),
  p('Cherki', 11, 4, 50, 'AM'), p('Fofana', 7, 4, 80, 'RW'), p('Tolisso', 10, 5, 20, 'LW'),
  p('Lacazette', 9, 7, 50, 'CF'),
];
const BENCH_OL = [p('Descamps', 30, 0, 0, 'GK'), p('Mikautadze', 14, 0, 0), p('Nuamah', 17, 0, 0), p('Morton', 21, 0, 0)];

const OPP_4141: LiveMatchLineupPlayer[] = [
  p('Samba', 1, 1, 50, 'GK'),
  p('Gradit', 3, 2, 15), p('Danso', 5, 2, 40), p('Medina', 2, 2, 60), p('Frankowski', 22, 2, 85),
  p('Machado', 8, 3, 50),
  p('Thauvin', 11, 4, 10), p('Sotoca', 10, 4, 35), p('Fulgini', 7, 5, 65), p('Said', 14, 5, 90),
  p('Wahi', 9, 7, 50),
];
const BENCH_OPP = [p('Leca', 16, 0, 0), p('Abdul Samed', 6, 0, 0)];

const lineup = (formation: string, starters: LiveMatchLineupPlayer[], bench: LiveMatchLineupPlayer[]): LiveMatchLineup => ({
  formation, starters, bench,
});

function stats(lineups?: LiveMatchStats['lineups']): LiveMatchStats {
  return {
    status: 'finished',
    competitionName: 'Ligue 1',
    home: { id: 465, name: 'Lyon', score: 2 },
    away: { id: 1, name: 'Lens', score: 1 },
    teamStats: { home: {}, away: {} },
    events: [],
    topPerformers: [],
    shots: [],
    lineups,
    updatedAt: '2026-10-11T20:00:00Z',
  } as unknown as LiveMatchStats;
}

const setWidth = (w: number) => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: w });
  window.dispatchEvent(new Event('resize'));
};

const blocks = () => screen.getAllByTestId('bloc-composition');

beforeEach(() => {
  nextId = 1000;
  setWidth(1440);
});

describe('Page match — match à venir (L129)', () => {
  it('composition probable : libellé « Composition probable », sinon rien', () => {
    hook = { isLoading: false, isError: false, data: stats({
      home: { ...lineup('4-2-3-1', OL_421, BENCH_OL), probable: true },
      away: lineup('4-1-4-1', OPP_4141, BENCH_OPP),
    }) };
    render(<MatchPage />);
    const [ol, opp] = blocks();
    expect(within(ol).getByTestId('etiquette-probable')).toHaveTextContent('Composition probable');
    expect(within(opp).queryByTestId('etiquette-probable')).toBeNull();
  });

  it('numéro 0 : jamais affiché (titulaire ni banc)', () => {
    const zero = (x: LiveMatchLineupPlayer) => ({ ...x, jerseyNumber: 0 });
    hook = { isLoading: false, isError: false, data: stats({
      home: lineup('4-2-3-1', OL_421.map(zero), BENCH_OL.map(zero)),
      away: lineup('4-1-4-1', OPP_4141, BENCH_OPP),
    }) };
    render(<MatchPage />);
    const ol = blocks()[0];
    expect(within(ol).queryByText('0')).toBeNull();
    expect(within(ol).getByTestId('banc-composition').textContent).not.toMatch(/\b0\b/);
  });
});
