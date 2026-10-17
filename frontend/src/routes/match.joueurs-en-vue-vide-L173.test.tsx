import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import type { LiveMatchStats } from '@/types/api';

// L173 — « Joueurs en vue » reste affiché avec un état vide explicite sur un match à venir sans topPerformers ;
// il disparaît toujours sur un match terminé (R4 de L160, « aucun trou »).

let data: LiveMatchStats;
vi.mock('@tanstack/react-router', () => ({
  useParams: () => ({ gameId: '4672325' }),
  useSearch: () => ({ matchupId: '523-1234-4672325' }),
  Link: ({ children, to, ...rest }: { children: React.ReactNode; to: string }) => <a href={to} {...(rest as object)}>{children}</a>,
}));
vi.mock('@/hooks/use-match-event-burst', () => ({ useMatchEventBurst: () => null }));
vi.mock('@/hooks/use-live-match', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/hooks/use-live-match')>()),
  useLiveMatchStats: () => ({ isLoading: false, isError: false, data }),
}));
vi.mock('@/components/match-event-burst', () => ({ MatchEventBurst: () => null }));

import { MatchPage } from './match';

(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };

const match = (status: 'upcoming' | 'finished'): LiveMatchStats => ({
  gameId: 4672325, matchupId: '523-1234-4672325', competitionId: 573, competitionName: 'Ligue Europa',
  status, statusGroup: status === 'upcoming' ? 1 : 4, statusText: 'x', gameTime: 0, gameTimeDisplay: '',
  startTime: '2026-11-12T20:00:00Z',
  home: { id: 465, name: 'Lyon', symbolicName: 'LYO', imageVersion: 1, score: null },
  away: { id: 1234, name: 'Lillestrom', symbolicName: 'LIL', imageVersion: 1, score: null },
  teamStats: { home: {}, away: {} }, events: [], topPerformers: [], shots: [], updatedAt: '2026-10-17T12:00:00Z',
} as unknown as LiveMatchStats);

describe('Joueurs en vue sans topPerformers (L173)', () => {
  it('match à venir : le bloc reste, avec son titre et le message d’état vide', () => {
    data = match('upcoming');
    render(<MatchPage />);
    const bloc = screen.getByTestId('joueurs-en-vue');
    expect(within(bloc).getByText('Joueurs en vue')).toBeInTheDocument();
    expect(within(bloc).getByTestId('message-joueurs-en-vue-vide')).toHaveTextContent(
      'Les joueurs en vue apparaîtront avec les statistiques du match.',
    );
  });

  it('match terminé : le bloc disparaît, pas de message', () => {
    data = match('finished');
    render(<MatchPage />);
    expect(screen.queryByTestId('joueurs-en-vue')).toBeNull();
    expect(screen.queryByTestId('message-joueurs-en-vue-vide')).toBeNull();
  });
});
