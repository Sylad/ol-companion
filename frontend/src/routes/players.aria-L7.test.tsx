import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import type { PlayerSeasonStats } from '@/types/api';

// L7/t3 — onglets en tablist (role=tab, aria-selected, tabpanel relié) et aria-sort sur la colonne triée de Stats saison
// (WCAG 4.1.2 et 1.3.1).

let search: Record<string, string> = {};
vi.mock('@tanstack/react-router', () => ({
  useSearch: () => search,
  useNavigate: () => vi.fn(),
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => <a href={to}>{children}</a>,
}));
vi.mock('@/hooks/use-lineup', () => ({
  useLineup: () => ({ data: null, isLoading: false, isError: false, refetch: vi.fn() }),
}));
let stats: PlayerSeasonStats[];
vi.mock('@/hooks/use-player-stats', () => ({
  useSeasonStats: () => ({ data: stats, isLoading: false, isError: false, refetch: vi.fn() }),
}));
vi.mock('@/components/knowledge-header', () => ({ KnowledgeHeader: () => null }));

import { PlayersPage } from './players';

const joueur = (n: number, buts: number) => ({
  athleteId: n, memberId: n, name: `Joueur ${n}`, shortName: `J. ${n}`, jerseyNumber: n, position: 'Attaquant',
  positionShort: 'ATT', imageVersion: null, matchesPlayed: 3, matchesStarted: 3, minutesPlayed: 270, goals: buts,
  assists: 0, goalContributions: buts, shots: 4, shotsOnTarget: 2, shotAccuracy: 50, yellowCards: 0, redCards: 0,
  averageRating: 6.5, byMatch: [],
}) as unknown as PlayerSeasonStats;

beforeEach(() => { search = {}; stats = [joueur(9, 3), joueur(7, 1)]; });

describe('<PlayersPage /> — ARIA (L7/t3)', () => {
  it('les trois onglets forment une tablist, un seul aria-selected, et le panneau est relié à son onglet', () => {
    render(<PlayersPage />);
    const liste = screen.getByRole('tablist');
    const onglets = within(liste).getAllByRole('tab');
    expect(onglets.map((o) => o.textContent)).toEqual(['Composition', 'Effectif', 'Stats saison']);
    expect(onglets.map((o) => o.getAttribute('aria-selected'))).toEqual(['true', 'false', 'false']);
    const panneau = screen.getByRole('tabpanel');
    expect(panneau).toHaveAttribute('aria-labelledby', onglets[0].id);
    expect(onglets[0]).toHaveAttribute('aria-controls', panneau.id);
  });

  it('l’onglet de l’URL porte aria-selected et le panneau', () => {
    search = { onglet: 'stats' };
    render(<PlayersPage />);
    expect(screen.getByRole('tab', { name: 'Stats saison' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Composition' })).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', screen.getByRole('tab', { name: 'Stats saison' }).id);
  });

  it('Stats saison : seule la colonne triée porte aria-sort="descending", les autres n’en portent pas', () => {
    search = { onglet: 'stats' };
    render(<PlayersPage />);
    const entetes = screen.getAllByRole('columnheader');
    const triees = entetes.filter((h) => h.hasAttribute('aria-sort'));
    expect(triees).toHaveLength(1);
    expect(triees[0]).toHaveAttribute('aria-sort', 'descending');
    expect(triees[0]).toHaveTextContent('B+P');
    search = { onglet: 'stats', tri: 'buts' };
    cleanup();
    render(<PlayersPage />);
    const apres = screen.getAllByRole('columnheader').filter((h) => h.hasAttribute('aria-sort'));
    expect(apres).toHaveLength(1);
    expect(apres[0]).toHaveTextContent('Buts');
  });
});
