import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import type { LiveMatchLineupPlayer, LiveMatchStats } from '@/types/api';

// L43 — R5 : formation renseignée mais inexploitable (somme ≠ 10, ou ≠ 10 joueurs de champ).
// Complète match.composition-L43.test.tsx (scellé), qui ne couvre que la formation vide.

let hook: { isLoading: boolean; isError: boolean; data: LiveMatchStats | undefined };

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
const p = (name: string, yardLine: number, yardSide: number, pos = 'CM'): LiveMatchLineupPlayer => ({
  id: nextId++, name, shortName: name, jerseyNumber: nextId, positionShort: pos, yardLine, yardSide, ranking: null,
});

// 1, 4, 2, 3, 1 par yardLine : 11 titulaires.
const ELEVEN = [
  p('Samba', 1, 50, 'GK'),
  p('Gradit', 2, 15), p('Danso', 2, 40), p('Medina', 2, 60), p('Frankowski', 2, 85),
  p('Machado', 3, 35), p('Thauvin', 3, 65),
  p('Sotoca', 4, 20), p('Fulgini', 4, 50), p('Said', 4, 80),
  p('Wahi', 5, 50),
];

const show = (formation: string, starters: LiveMatchLineupPlayer[]) => {
  const lineups = {
    home: { formation: '4-2-3-1', starters: ELEVEN, bench: [] },
    away: { formation, starters, bench: [] },
  };
  hook = {
    isLoading: false,
    isError: false,
    data: {
      status: 'finished', competitionName: 'Ligue 1',
      home: { id: 465, name: 'Lyon', score: 2 }, away: { id: 1, name: 'Lens', score: 1 },
      teamStats: { home: {}, away: {} }, events: [], topPerformers: [], shots: [], lineups,
      updatedAt: '2026-10-11T20:00:00Z',
    } as unknown as LiveMatchStats,
  };
  render(<MatchPage />);
  return screen.getAllByTestId('bloc-composition')[1];
};

const sizes = (block: HTMLElement) =>
  within(block).getAllByTestId('rangee-composition').map((r) => r.children.length);

describe('Page match — repli de formation invalide (L43)', () => {
  it('R5 — formation qui ne totalise pas 10 : rangées par yardLine, note visible, pas de pastille', () => {
    const opp = show('4-4-3', ELEVEN);
    expect(sizes(opp)).toEqual([1, 3, 2, 4, 1]);
    expect(within(opp).queryByTestId('formation-composition')).toBeNull();
    expect(within(opp).getByTestId('note-repli')).toBeInTheDocument();
  });

  it('R5 — formation de 10 mais 9 joueurs de champ : rangées par yardLine, note visible, pas de pastille', () => {
    const opp = show('4-2-3-1', ELEVEN.slice(0, 10));
    expect(sizes(opp)).toEqual([3, 2, 4, 1]);
    expect(within(opp).queryByTestId('formation-composition')).toBeNull();
    expect(within(opp).getByTestId('note-repli')).toBeInTheDocument();
  });
});
