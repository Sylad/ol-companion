import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import type { LiveMatchStats } from '@/types/api';

// L266 — « Moussa Niakhate · Tacles : 0,1 » (Lille – Lyon, 20-11) : 365scores donnait `Tackles 0.1` (type 38),
// une moyenne de tacles gagnés par match sur la saison. Les joueurs ci-dessous sont la réponse de
// /api/live-match/4735207/stats calculée par le backend depuis la réponse réelle
// (backend/test/fixtures/365_game_lille_lyon_upcoming_L266.json, spec top-performer-stats.spec.ts).

let data: LiveMatchStats;
vi.mock('@tanstack/react-router', () => ({
  useParams: () => ({ gameId: '4735207' }),
  useSearch: () => ({ matchupId: '478-465-4735207' }),
  Link: ({ children, to, ...rest }: { children: React.ReactNode; to: string }) => <a href={to} {...(rest as object)}>{children}</a>,
}));
vi.mock('@/hooks/use-match-event-burst', () => ({ useMatchEventBurst: () => null }));
// L265 : « Ce que ça change » a sa propre requête (football-data), testée à part.
vi.mock('@/hooks/use-match-impact', () => ({ useMatchImpact: () => ({ isPending: true, data: undefined, error: null }) }));
vi.mock('@/hooks/use-live-match', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/hooks/use-live-match')>()),
  useLiveMatchStats: () => ({ isLoading: false, isError: false, data }),
}));
vi.mock('@/components/match-event-burst', () => ({ MatchEventBurst: () => null }));

import { MatchPage } from './match';

(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };

const p = (id: number, name: string, statName: string, statValue: string) => ({ id, name, statName, statValue });

const lilleLyon = (topPerformers: unknown[]): LiveMatchStats => ({
  gameId: 4735207, matchupId: '478-465-4735207', competitionId: 35, competitionName: 'Ligue 1',
  status: 'upcoming', statusGroup: 2, statusText: 'Prévu', gameTime: 0, gameTimeDisplay: '',
  startTime: '2026-11-21T19:45:00Z', timeConfirmed: true,
  home: { id: 478, name: 'Lille', symbolicName: 'LIL', imageVersion: 1, score: null },
  away: { id: 465, name: 'Lyon', symbolicName: 'LYO', imageVersion: 1, score: null },
  teamStats: { home: {}, away: {} }, events: [], topPerformers, shots: [],
  updatedAt: '2026-11-20T12:00:00Z',
} as unknown as LiveMatchStats);

describe('Joueurs en vue — sens des chiffres (L266)', () => {
  it('Niakhate : « Tacles gagnés par match : 0,1 », jamais « Tacles : 0,1 »', () => {
    data = lilleLyon([
      { role: 'Attaquant', homePlayer: p(197896, 'Soriba Diaoune', 'Buts', '1'), awayPlayer: p(115749, 'Ernest Nuamah', 'Buts', '4') },
      { role: 'Défenseur', homePlayer: p(113061, 'Alexsandro Ribeiro', 'Tacles gagnés par match', '1.0'), awayPlayer: p(49112, 'Moussa Niakhate', 'Tacles gagnés par match', '0.1') },
    ]);
    render(<MatchPage />);
    const bloc = screen.getByTestId('joueurs-en-vue');
    const lignes = [...bloc.querySelectorAll('[data-stat-ligne]')].map((l) => l.textContent?.replace(/\s+/g, ' ').trim());
    expect(lignes).toEqual(['Buts : 1', 'Buts : 4', 'Tacles gagnés par match : 1,0', 'Tacles gagnés par match : 0,1']);
    expect(bloc.textContent).not.toMatch(/Tacles : /);
    expect(within(bloc).getByText(/Chiffres de la saison/)).toBeInTheDocument();
  });

  it('un chiffre au sens non établi (nom vide) : le joueur est nommé, sans ligne de chiffre', () => {
    data = lilleLyon([{ role: 'Défenseur', homePlayer: p(1, 'Joueur-Domicile', '', ''), awayPlayer: p(49112, 'Moussa Niakhate', 'Tacles gagnés par match', '0.1') }]);
    render(<MatchPage />);
    const bloc = screen.getByTestId('joueurs-en-vue');
    expect(within(bloc).getByText('Joueur-Domicile')).toBeInTheDocument();
    expect(bloc.querySelectorAll('[data-stat-ligne]').length).toBe(1);
    expect(bloc.textContent).not.toMatch(/ : $| :\s*Moussa/);
  });
});
