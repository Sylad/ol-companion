import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import type { PlayerSeasonStats } from '@/types/api';

// L7/t4 — onglet et tri dans l'URL (?onglet=stats&tri=buts), gardés par les liens vers la fiche, « Retour à l'effectif »
// et le retour du navigateur (l'URL est dans l'historique).

let search: Record<string, string | undefined> = {};
const navigate = vi.fn();
vi.mock('@tanstack/react-router', () => ({
  useSearch: () => search,
  useNavigate: () => navigate,
  useParams: () => ({ athleteId: '9' }),
  Link: ({ children, to, search: s }: { children: React.ReactNode; to: string; search?: unknown }) => (
    <a href={to} data-search={JSON.stringify(s ?? null)}>{children}</a>
  ),
}));
vi.mock('@/hooks/use-lineup', () => ({
  useLineup: () => ({ data: null, isLoading: false, isError: false, refetch: vi.fn() }),
}));
let stats: PlayerSeasonStats[];
vi.mock('@/hooks/use-player-stats', () => ({
  useSeasonStats: () => ({ data: stats, isLoading: false, isError: false, refetch: vi.fn() }),
  usePlayerSeasonStats: () => ({ data: stats[0], isLoading: false, isError: false }),
}));
vi.mock('@/components/team-logo', () => ({ TeamLogo: () => null }));
vi.mock('@/components/knowledge-header', () => ({ KnowledgeHeader: () => null }));
vi.mock('recharts', () => {
  const Null = () => null;
  return { LineChart: Null, Line: Null, XAxis: Null, YAxis: Null, CartesianGrid: Null, Tooltip: Null, ResponsiveContainer: Null };
});

import { PlayersPage } from './players';
import { PlayerDetailPage } from './player.$athleteId';

const joueur = (n: number, buts: number, passes: number) => ({
  athleteId: n, memberId: n, name: `Joueur ${n}`, shortName: `J. ${n}`, jerseyNumber: n, position: 'Attaquant',
  positionShort: 'ATT', imageVersion: null, matchesPlayed: 3, matchesStarted: 3, minutesPlayed: 270, goals: buts,
  assists: passes, goalContributions: buts + passes, shots: 4, shotsOnTarget: 2, shotAccuracy: 50, yellowCards: 0,
  redCards: 0, averageRating: 6.5, byMatch: [],
}) as unknown as PlayerSeasonStats;

// B+P : A 5, B 4, C 3 — Buts : C 3, B 2, A 1.
beforeEach(() => {
  search = {};
  navigate.mockClear();
  stats = [joueur(1, 1, 4), joueur(2, 2, 2), joueur(3, 3, 0)];
});

const ordre = () =>
  within(screen.getByRole('table')).getAllByRole('row').slice(1).map((r) => r.textContent?.match(/Joueur \d/)?.[0]);

describe('<PlayersPage /> — onglet et tri dans l’URL (L7/t4)', () => {
  it('l’onglet vient de l’URL : ?onglet=stats ouvre Stats saison', () => {
    search = { onglet: 'stats' };
    render(<PlayersPage />);
    expect(screen.getByRole('tab', { name: 'Stats saison' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('table')).toBeInTheDocument();
  });


  it('cliquer un onglet écrit l’onglet dans l’URL (sans empiler l’historique)', () => {
    render(<PlayersPage />);
    fireEvent.click(screen.getByRole('tab', { name: 'Effectif' }));
    expect(navigate).toHaveBeenCalledWith({ to: '/players', search: { onglet: 'effectif', tri: undefined }, replace: true });
  });

  it('revenir à Composition ou au tri B+P efface le paramètre (l’URL par défaut reste propre)', () => {
    search = { onglet: 'stats', tri: 'buts' };
    render(<PlayersPage />);
    fireEvent.click(screen.getByRole('tab', { name: 'Composition' }));
    expect(navigate).toHaveBeenLastCalledWith({ to: '/players', search: { onglet: undefined, tri: 'buts' }, replace: true });
    fireEvent.click(within(screen.getAllByRole('columnheader').find((h) => h.textContent === 'B+P')!).getByRole('button'));
    expect(navigate).toHaveBeenLastCalledWith({ to: '/players', search: { onglet: 'stats', tri: undefined }, replace: true });
  });

  it('?tri=buts trie par buts ; cliquer une colonne écrit le tri en gardant l’onglet', () => {
    search = { onglet: 'stats', tri: 'buts' };
    render(<PlayersPage />);
    expect(ordre()).toEqual(['Joueur 3', 'Joueur 2', 'Joueur 1']);
    fireEvent.click(within(screen.getAllByRole('columnheader').find((h) => h.textContent === 'Passes D.')!).getByRole('button'));
    expect(navigate).toHaveBeenCalledWith({ to: '/players', search: { onglet: 'stats', tri: 'passes' }, replace: true });
  });

  it('sans tri dans l’URL, B+P trie : le défaut', () => {
    search = { onglet: 'stats' };
    render(<PlayersPage />);
    expect(ordre()).toEqual(['Joueur 1', 'Joueur 2', 'Joueur 3']);
  });

  it('Stats saison : les liens vers la fiche emportent l’onglet et le tri', () => {
    search = { onglet: 'stats', tri: 'buts' };
    render(<PlayersPage />);
    const liens = screen.getAllByRole('link');
    expect(liens.length).toBe(3);
    for (const lien of liens) expect(JSON.parse(lien.getAttribute('data-search')!)).toEqual({ onglet: 'stats', tri: 'buts' });
  });

  it('le lien de retour de la fiche (« Retour aux stats de la saison ») rend l’onglet et le tri reçus', () => {
    search = { onglet: 'stats', tri: 'buts' };
    render(<PlayerDetailPage />);
    const retour = screen.getByRole('link', { name: /Retour aux stats de la saison/ });
    expect(JSON.parse(retour.getAttribute('data-search')!)).toEqual({ onglet: 'stats', tri: 'buts' });
  });
});
