import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// L66 — la page match porte un h1 (attendu par docs/qa/expectations.md, section *) :
// masqué visuellement, il nomme la rencontre pour les lecteurs d'écran.

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
      teamStats: { home: {}, away: {} },
      events: [],
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

describe('<MatchPage /> — titre de page (L66)', () => {
  it('un seul h1, masqué visuellement, qui nomme la rencontre', () => {
    render(<MatchPage />);
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1).toHaveClass('sr-only');
    expect(h1).toHaveTextContent('Lyon – Nice');
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });
});
