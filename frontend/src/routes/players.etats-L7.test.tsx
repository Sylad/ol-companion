import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import type { LineupResponse, PlayerSeasonStats } from '@/types/api';

// L7/t1 — la carte et ses onglets restent affichés quand /api/lineup échoue ou rend null ;
// l'erreur et le vide sont dans le panneau de l'onglet concerné, avec « Réessayer » ; Stats saison a son propre endpoint.

let search: Record<string, string> = {};
vi.mock('@tanstack/react-router', () => ({
  useSearch: () => search,
  useNavigate: () => vi.fn(),
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => <a href={to}>{children}</a>,
}));
const refetchLineup = vi.fn();
const refetchStats = vi.fn();
let lineup: { data: LineupResponse | null | undefined; isLoading: boolean; isError: boolean };
let stats: { data: PlayerSeasonStats[] | undefined; isLoading: boolean; isError: boolean };
vi.mock('@/hooks/use-lineup', () => ({ useLineup: () => ({ ...lineup, refetch: refetchLineup }) }));
vi.mock('@/hooks/use-player-stats', () => ({ useSeasonStats: () => ({ ...stats, refetch: refetchStats }) }));
vi.mock('@/components/knowledge-header', () => ({ KnowledgeHeader: () => null }));

import { PlayersPage } from './players';

const joueur = (n: number, buts: number) => ({
  athleteId: n, memberId: n, name: `Joueur ${n}`, shortName: `J. ${n}`, jerseyNumber: n, position: 'Attaquant',
  positionShort: 'ATT', imageVersion: null, matchesPlayed: 3, matchesStarted: 3, minutesPlayed: 270, goals: buts,
  assists: 0, goalContributions: buts, shots: 4, shotsOnTarget: 2, shotAccuracy: 50, yellowCards: 0, redCards: 0,
  averageRating: 6.5, byMatch: [],
}) as PlayerSeasonStats;

beforeEach(() => {
  search = {};
  refetchLineup.mockClear();
  refetchStats.mockClear();
  stats = { data: [joueur(9, 3), joueur(7, 1)], isLoading: false, isError: false };
});

describe('<PlayersPage /> — lineup en erreur ou vide (L7/t1)', () => {
  it('erreur : les trois onglets restent, le panneau dit quoi faire et Réessayer relance /api/lineup', () => {
    lineup = { data: undefined, isLoading: false, isError: true };
    render(<PlayersPage />);
    for (const nom of ['Composition', 'Effectif', 'Stats saison']) {
      expect(screen.getByText(nom)).toBeInTheDocument();
    }
    const panneau = screen.getByRole('status');
    expect(panneau).toHaveTextContent(/n’a pas pu être chargée/);
    expect(panneau.textContent).not.toMatch(/cache/i);
    fireEvent.click(within(panneau).getByRole('button', { name: 'Réessayer' }));
    expect(refetchLineup).toHaveBeenCalledTimes(1);
  });

  it('lineup null : message de vide dans le panneau, avec Réessayer, onglets présents', () => {
    lineup = { data: null, isLoading: false, isError: false };
    render(<PlayersPage />);
    const panneau = screen.getByRole('status');
    expect(panneau).toHaveTextContent(/Aucune composition/);
    fireEvent.click(within(panneau).getByRole('button', { name: 'Réessayer' }));
    expect(refetchLineup).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Stats saison')).toBeInTheDocument();
  });

  it('Stats saison reste lisible quand /api/lineup échoue', () => {
    lineup = { data: undefined, isLoading: false, isError: true };
    search = { onglet: 'stats' };
    render(<PlayersPage />);
    expect(screen.getByText('Joueur 9')).toBeInTheDocument();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('erreur de Stats saison : message dans le panneau et Réessayer relance /api/players/season-stats', () => {
    lineup = { data: undefined, isLoading: false, isError: true };
    stats = { data: undefined, isLoading: false, isError: true };
    search = { onglet: 'stats' };
    render(<PlayersPage />);
    fireEvent.click(within(screen.getByRole('status')).getByRole('button', { name: 'Réessayer' }));
    expect(refetchStats).toHaveBeenCalledTimes(1);
    expect(refetchLineup).not.toHaveBeenCalled();
  });
});
