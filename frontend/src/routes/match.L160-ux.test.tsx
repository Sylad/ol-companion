import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';

// L160 — revue UX de conformité : 365scores renvoie un sigle vide, le repli affichait « LYO » pour l'OL
// sous chaque minute des faits du match. Le club suivi est toujours « OL », l'adversaire garde le repli.

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
      home: { id: 465, name: 'Lyon', symbolicName: '', score: 1 },
      away: { id: 1, name: 'Rennes', symbolicName: '', score: 1 },
      teamStats: { home: {}, away: {} },
      events: [
        { competitorId: 465, gameTime: 12, gameTimeDisplay: "12'", type: 'goal', isMajor: true, playerId: 5, extraPlayerId: null, playerName: 'A B', playerShortName: 'B', extraPlayerName: null, description: 'But' },
        { competitorId: 1, gameTime: 60, gameTimeDisplay: "60'", type: 'goal', isMajor: true, playerId: 6, extraPlayerId: null, playerName: 'C D', playerShortName: 'D', extraPlayerName: null, description: 'But' },
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

describe('<MatchPage /> — sigles des faits du match (L160)', () => {
  it('R5 — sous chaque minute : « OL » pour le club suivi (jamais « LYO »), le repli « REN » pour l\'adversaire', () => {
    render(<MatchPage />);
    const faits = screen.getByTestId('faits-match');
    expect(within(faits).getByText("12'").nextElementSibling).toHaveTextContent(/^OL$/);
    expect(within(faits).getByText("60'").nextElementSibling).toHaveTextContent(/^REN$/);
    expect(faits.textContent).not.toContain('LYO');
  });
});
