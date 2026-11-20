import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';

// L9 t1 — revue UX : remplacement lisible (entrant ↔ sortant dans la ligne), libellés français
// pour Poteau et But annulé (VAR), aucun libellé anglais brut.

vi.mock('@tanstack/react-router', () => ({
  useParams: () => ({ gameId: '10' }),
  useSearch: () => ({ matchupId: '465-1-10' }),
  Link: ({ children }: { children: React.ReactNode }) => <a href="/">{children}</a>,
}));
vi.mock('@/hooks/use-match-event-burst', () => ({ useMatchEventBurst: () => null }));

const ev = (over: Record<string, unknown>) => ({
  competitorId: 465, gameTime: 46, gameTimeDisplay: "46'", type: 'substitution', isMajor: false,
  playerId: 1, extraPlayerId: 2, playerName: 'Marco Kana', playerShortName: 'Kana',
  extraPlayerName: 'Amane Romeo', extraPlayerShortName: 'Romeo', description: 'Substitution', ...over,
});

vi.mock('@/hooks/use-live-match', () => ({
  useLiveMatchStats: () => ({
    isLoading: false,
    isError: false,
    data: {
      status: 'finished',
      competitionName: 'Ligue 1',
      home: { id: 465, name: 'Lyon', symbolicName: 'OL', score: 1 },
      away: { id: 1, name: 'Rennes', symbolicName: 'REN', score: 1 },
      teamStats: { home: {}, away: {} },
      events: [
        ev({}),
        ev({ gameTime: 52, gameTimeDisplay: "52'", type: 'woodwork', playerId: 3, extraPlayerId: null, playerName: 'Rayan Cherki', playerShortName: 'Cherki', extraPlayerName: null, extraPlayerShortName: null, description: 'Woodwork' }),
        ev({ gameTime: 53, gameTimeDisplay: "53'", type: 'goal_cancelled', playerId: null, extraPlayerId: null, playerName: null, playerShortName: null, extraPlayerName: null, extraPlayerShortName: null, description: 'But annulé — Var' }),
      ],
      topPerformers: [],
      shots: [],
    },
  }),
}));
vi.mock('@/components/shot-map', () => ({ ShotMap: () => null }));
vi.mock('@/components/momentum-chart', () => ({ MomentumChart: () => null }));
vi.mock('@/components/lineup-card', () => ({ LineupCard: () => null }));
vi.mock('@/components/mini-standings', () => ({ MiniStandings: () => null }));
vi.mock('@/components/match-event-burst', () => ({ MatchEventBurst: () => null }));

import { MatchPage } from './match';

describe('<MatchPage /> — faits du match (L9 t1)', () => {
  it('remplacement : entrant ↔ sortant dans la ligne elle-même, pas seulement au survol', () => {
    render(<MatchPage />);
    const faits = screen.getByTestId('faits-match');
    const ligne = within(faits).getByText(/Remplacement/);
    expect(ligne).toHaveTextContent('↔ Remplacement · Kana ↔ Romeo');
    expect(ligne).toHaveAttribute('title', 'Marco Kana (entrant) ↔ Amane Romeo (sortant)');
  });

  it('Poteau et But annulé (VAR) en français, sans « Woodwork » ni « Var » bruts', () => {
    render(<MatchPage />);
    const faits = screen.getByTestId('faits-match');
    expect(within(faits).getByText(/Poteau · Cherki/)).toBeInTheDocument();
    expect(within(faits).getByText(/But annulé \(VAR\)/)).toBeInTheDocument();
    expect(faits.textContent).not.toMatch(/Woodwork|Substitution/);
  });
});
