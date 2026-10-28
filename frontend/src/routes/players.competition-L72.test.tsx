import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { LineupResponse } from '@/types/api';

// L72 — « Dernier match » de /players passe par le glossaire, pas par le nom brut 365scores.
vi.mock('@tanstack/react-router', () => ({
  useSearch: () => ({}),
  useNavigate: () => vi.fn(),
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => <a href={to}>{children}</a>,
}));
const lineup = {
  gameId: 1, date: '2026-10-10T19:00:00Z', competitionId: 35, competition: 'France, Ligue 1', matchday: 8, opponent: 'Lens', opponentId: 7,
  isHome: true, homeScore: 2, awayScore: 1, formation: '4-3-3', starters: [], bench: [], injured: [],
} as LineupResponse;
vi.mock('@/hooks/use-lineup', () => ({ useLineup: () => ({ data: lineup, isLoading: false, isError: false, refetch: vi.fn() }) }));
vi.mock('@/hooks/use-player-stats', () => ({ useSeasonStats: () => ({ data: [], isLoading: false, isError: false, refetch: vi.fn() }) }));
vi.mock('@/hooks/use-squad', () => ({ useSquad: () => ({ data: undefined, isLoading: false, isError: true, refetch: vi.fn() }) }));
vi.mock('@/components/knowledge-header', () => ({ KnowledgeHeader: () => null }));
vi.mock('@/components/team-logo', () => ({ TeamLogo: () => null }));

import { PlayersPage } from './players';

describe('<PlayersPage /> — compétition du dernier match (L72)', () => {
  it('R5 — « Ligue 1 · J8 », jamais « France, Ligue 1 »', () => {
    render(<PlayersPage />);
    expect(screen.getByText(/Ligue 1 · J8/)).toBeInTheDocument();
    expect(screen.queryByText(/France, Ligue 1/)).toBeNull();
  });
});
