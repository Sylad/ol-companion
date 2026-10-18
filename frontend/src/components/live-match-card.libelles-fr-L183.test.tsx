import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { LiveMatchStats, LiveMatchSummary } from '@/types/api';

// L183 — carte du direct de l'accueil : xG à virgule, événements en français (revue L179).

let stats: LiveMatchStats;
const summary = {
  gameId: 1, matchupId: '523-1234-1', competitionName: 'Ligue 1', status: 'live', statusGroup: 3,
  statusText: '2e mi-temps', gameTime: 60, gameTimeDisplay: "60'", startTime: '2026-10-17T19:00:00Z',
  home: { id: 465, name: 'Lyon', symbolicName: 'OL', imageVersion: 1, score: 1 },
  away: { id: 1234, name: 'Lens', symbolicName: 'RCL', imageVersion: 1, score: 0 },
} as unknown as LiveMatchSummary;

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => <a href={to}>{children}</a>,
}));
vi.mock('@/hooks/use-live-match', () => ({
  useCurrentLiveMatch: () => ({ isLoading: false, data: summary }),
  useLiveMatchStats: () => ({ data: stats }),
}));

import { LiveMatchCard } from './live-match-card';

const ev = (type: string, description: string, gameTimeDisplay: string) => ({
  gameTime: 1, gameTimeDisplay, type, description, isMajor: true, competitorId: 465,
  playerId: null, extraPlayerId: null, playerName: null, playerShortName: null, extraPlayerName: null, extraPlayerShortName: null,
});

stats = {
  teamStats: { home: { Touches: 60, 'Tirs au total': 9, 'Buts attendus': 1.87 }, away: { Touches: 40, 'Tirs au total': 4, 'Buts attendus': 0.5 } },
  events: [ev('woodwork', 'Woodwork', "50'"), ev('substitution', 'Substitution', "55'"), ev('goal_cancelled', 'But annulé — Var', "58'")],
} as unknown as LiveMatchStats;

describe('LiveMatchCard — libellés français (L183)', () => {
  it('xG à virgule comme la page du match (1,87), jamais 1.87', () => {
    const { container } = render(<LiveMatchCard />);
    expect(screen.getByText('1,87')).toBeInTheDocument();
    expect(screen.getByText('0,50')).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/1\.87/);
  });

  it('événements : Poteau, Remplacement, But annulé (VAR), aucun libellé anglais brut', () => {
    const { container } = render(<LiveMatchCard />);
    expect(screen.getByText(/Poteau/)).toBeInTheDocument();
    expect(screen.getByText(/Remplacement/)).toBeInTheDocument();
    expect(screen.getByText(/But annulé \(VAR\)/)).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/Woodwork|Substitution|Var\b/);
  });
});
