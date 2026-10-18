import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import type { LineupPlayer, LineupResponse, PlayerSeasonStats } from '@/types/api';
import { ratingColor, ratingTextColor } from '@/components/formation-field';

// L7 — branches de PlayersPage avec une composition chargée (en-tête « Dernier match », terrain, cartes de l'Effectif qui
// emportent onglet et tri) et vide de Stats saison (message sans jargon, Réessayer, role=status).

let search: Record<string, string | undefined> = {};
vi.mock('@tanstack/react-router', () => ({
  useSearch: () => search,
  useNavigate: () => vi.fn(),
  Link: ({ children, to, search: s }: { children: React.ReactNode; to: string; search?: unknown }) => (
    <a href={to} data-search={JSON.stringify(s ?? null)}>{children}</a>
  ),
}));
const refetchStats = vi.fn();
let lineup: LineupResponse;
let stats: PlayerSeasonStats[];
vi.mock('@/hooks/use-lineup', () => ({ useLineup: () => ({ data: lineup, isLoading: false, isError: false, refetch: vi.fn() }) }));
vi.mock('@/hooks/use-player-stats', () => ({
  useSeasonStats: () => ({ data: stats, isLoading: false, isError: false, refetch: refetchStats }),
}));
vi.mock('@/components/knowledge-header', () => ({ KnowledgeHeader: () => null }));
vi.mock('@/components/team-logo', () => ({ TeamLogo: () => null }));
vi.mock('@/components/player-card', () => ({ PlayerCard: ({ player }: { player: LineupPlayer }) => <span>{player.name}</span> }));

import { PlayersPage } from './players';

const titulaire = (n: number, ranking: number | null): LineupPlayer => ({
  id: n, athleteId: 100 + n, name: `Titulaire ${n}`, shortName: `T. ${n}`, jerseyNumber: n, position: 'Milieu',
  positionShort: 'M', yardLine: 2, yardSide: 20 * n, ranking, isStarting: true,
});

beforeEach(() => {
  search = {};
  refetchStats.mockClear();
  stats = [];
  lineup = {
    gameId: 1, date: '2026-10-10T19:00:00Z', competition: 'Ligue 1', matchday: 8, opponent: 'Lens', opponentId: 7,
    isHome: true, homeScore: 2, awayScore: 1, formation: '4-3-3',
    starters: [titulaire(1, 8.4), titulaire(2, 6.2)],
    bench: [{ ...titulaire(3, null), isStarting: false }],
    injured: [],
  };
});

describe('<PlayersPage /> — composition chargée (L7)', () => {
  it('Composition : en-tête « Dernier match » avec la formation, et pastilles de note au chiffre du meilleur contraste', () => {
    render(<PlayersPage />);
    expect(screen.getByText('Dernier match')).toBeInTheDocument();
    expect(screen.getAllByText('4-3-3').length).toBeGreaterThan(0);
    for (const [txt, note] of [['8.4', 8.4], ['6.2', 6.2]] as const) {
      const pastille = screen.getByText(txt);
      expect(pastille).toHaveStyle({ backgroundColor: ratingColor(note), color: ratingTextColor(note) });
    }
  });

  it('Effectif : les cartes vers la fiche emportent onglet et tri pour que « Retour à l\'effectif » rouvre Effectif', () => {
    search = { onglet: 'effectif', tri: 'buts' };
    render(<PlayersPage />);
    const lien = screen.getByText('Titulaire 1').closest('a')!;
    expect(lien).toHaveAttribute('href', '/player/$athleteId');
    expect(JSON.parse(lien.getAttribute('data-search')!)).toEqual({ onglet: 'effectif', tri: 'buts' });
  });

  it('Stats saison vide : message sans jargon dans le panneau, avec Réessayer qui relance /api/players/season-stats', () => {
    search = { onglet: 'stats' };
    render(<PlayersPage />);
    const panneau = screen.getByRole('status');
    expect(panneau).toHaveTextContent(/Aucune statistique/);
    expect(panneau.textContent).not.toMatch(/cache/i);
    fireEvent.click(within(panneau).getByRole('button', { name: 'Réessayer' }));
    expect(refetchStats).toHaveBeenCalledTimes(1);
  });
});
