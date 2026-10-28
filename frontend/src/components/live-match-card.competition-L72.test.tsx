import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { LiveMatchSummary } from '@/types/api';

// L72 — la carte du direct passe par le glossaire des compétitions, jamais par le nom brut 365scores.

let summary: LiveMatchSummary;

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => <a href={to}>{children}</a>,
}));
vi.mock('@/hooks/use-live-match', () => ({
  useCurrentLiveMatch: () => ({ isLoading: false, data: summary }),
  useLiveMatchStats: () => ({ data: undefined }),
}));

import { LiveMatchCard } from './live-match-card';

const make = (competitionId: number | undefined): LiveMatchSummary => ({
  gameId: 1, matchupId: '523-1234-1', competitionId, competitionName: 'France, Ligue 1', status: 'live', statusGroup: 3,
  statusText: '2e mi-temps', gameTime: 60, gameTimeDisplay: "60'", startTime: '2026-10-17T19:00:00Z',
  home: { id: 465, name: 'Lyon', symbolicName: 'OL', imageVersion: 1, score: 1 },
  away: { id: 1234, name: 'Lens', symbolicName: 'RCL', imageVersion: 1, score: 0 },
} as unknown as LiveMatchSummary);

describe('LiveMatchCard — nom de la compétition (L72)', () => {
  it('competitionId 35 et nom brut « France, Ligue 1 » : « Ligue 1 » affiché, le nom brut absent', () => {
    summary = make(35);
    const { container } = render(<LiveMatchCard />);
    expect(screen.getByText('Ligue 1')).toBeInTheDocument();
    expect(container.textContent).not.toContain('France, Ligue 1');
  });
});
