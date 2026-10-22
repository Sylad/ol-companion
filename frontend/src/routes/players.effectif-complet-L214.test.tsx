import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { LineupResponse, PlayerSeasonStats, SquadPlayer } from '@/types/api';
import { FormationField } from '@/components/formation-field';

// L214 — l'onglet Effectif liste l'effectif complet de /api/players/squad (joueurs sans minute compris), chacun avec un
// lien vers sa fiche ; les stats de saison n'y ajoutent que la note moyenne ; squad indisponible : repli sur L178.

let search: Record<string, string | undefined> = {};
vi.mock('@tanstack/react-router', () => ({
  useSearch: () => search,
  useNavigate: () => vi.fn(),
  Link: ({ children, params, search: s, className, 'aria-label': label }: { children: React.ReactNode; params?: { athleteId: string }; search?: unknown; className?: string; 'aria-label'?: string }) => (
    <a href={`/player/${params?.athleteId}`} data-search={JSON.stringify(s ?? null)} className={className} aria-label={label}>{children}</a>
  ),
}));
let lineup: LineupResponse | undefined;
let stats: PlayerSeasonStats[] | undefined;
let squad: SquadPlayer[] | undefined;
let squadEtat = { isLoading: false, isError: false };
vi.mock('@/hooks/use-lineup', () => ({ useLineup: () => ({ data: lineup, isLoading: false, isError: false, refetch: vi.fn() }) }));
vi.mock('@/hooks/use-player-stats', () => ({
  useSeasonStats: () => ({ data: stats, isLoading: false, isError: false, refetch: vi.fn() }),
}));
vi.mock('@/hooks/use-squad', () => ({ useSquad: () => ({ data: squad, ...squadEtat, refetch: vi.fn() }) }));
vi.mock('@/components/knowledge-header', () => ({ KnowledgeHeader: () => null }));
vi.mock('@/components/team-logo', () => ({ TeamLogo: () => null }));

import { PlayersPage } from './players';

const membre = (athleteId: number, name: string, jerseyNumber: number | null, position = 'Midfielder'): SquadPlayer => ({ athleteId, name, position, jerseyNumber });
const saison = (athleteId: number, name: string, note: number | null): PlayerSeasonStats => ({
  athleteId, memberId: athleteId, name, shortName: name, jerseyNumber: 9, position: 'Attacker', positionShort: 'ATT',
  imageVersion: null, matchesPlayed: 10, matchesStarted: 8, minutesPlayed: 700, goals: 3, assists: 2, goalContributions: 5,
  shots: 21, shotsOnTarget: 11, shotAccuracy: 52, yellowCards: 0, redCards: 0, averageRating: note, byMatch: [],
}) as unknown as PlayerSeasonStats;

beforeEach(() => {
  search = { onglet: 'effectif' };
  squadEtat = { isLoading: false, isError: false };
  squad = [
    membre(9, 'Openda', 9, 'Attacker'),
    membre(133157, 'Justin Bengui', 25, 'Goalkeeper'),
    membre(51163, 'Paul Akouokou', null),
    membre(77, 'Sans Numéro', null, 'Defender'),
  ];
  stats = [saison(9, 'Openda', 7.3)];
  lineup = undefined;
});

describe('Effectif complet (L214)', () => {
  it('R1 — l\'Effectif liste tout l\'effectif de /api/players/squad, joueurs sans minute compris, chacun avec un lien vers sa fiche', () => {
    render(<PlayersPage />);
    const liens = screen.getAllByRole('link');
    expect(liens.map((a) => a.getAttribute('href'))).toEqual(['/player/9', '/player/133157', '/player/51163', '/player/77']);
    for (const nom of ['Openda', 'Justin Bengui', 'Paul Akouokou', 'Sans Numéro']) expect(screen.getByText(nom)).toBeInTheDocument();
    expect(JSON.parse(screen.getByText('Paul Akouokou').closest('a')!.getAttribute('data-search')!)).toEqual({ onglet: 'effectif' });
  });

  it('R2 — la note moyenne vient des stats de saison ; un joueur sans minute n\'a pas de note, son poste est ramené à GB / DEF / MIL / ATT', () => {
    render(<PlayersPage />);
    expect(screen.getAllByText('7,3')).toHaveLength(1);
    expect(screen.getAllByText('Note moyenne')).toHaveLength(1);
    expect(screen.getByText('Justin Bengui').closest('a')).toHaveTextContent('GB');
    expect(screen.getByText('Sans Numéro').closest('a')).toHaveTextContent('DEF');
    expect(screen.getByText('Paul Akouokou').closest('a')).toHaveTextContent('MIL');
  });

  it('R3 — trié par numéro, un numéro inconnu passe après les numéros connus (par nom) et n\'écrit ni « #-1 » ni « 0 »', () => {
    squad = [membre(1, 'Zed', null), membre(2, 'Alpha', null), membre(3, 'Dix', 10)];
    stats = [];
    render(<PlayersPage />);
    expect(screen.getAllByRole('link').map((a) => a.getAttribute('href'))).toEqual(['/player/3', '/player/2', '/player/1']);
    expect(screen.getByText('Alpha').closest('a')!.textContent).not.toMatch(/-1|#|\b0\b/);
  });

  it('R3 — le n° 99 (Nartey) se range avant les joueurs sans numéro, même d\'un nom qui le précède', () => {
    squad = [membre(1, 'Alpha', null), membre(2, 'Noah Nartey', 99), membre(3, 'Dix', 10)];
    stats = [];
    render(<PlayersPage />);
    expect(screen.getAllByRole('link').map((a) => a.getAttribute('href'))).toEqual(['/player/3', '/player/2', '/player/1']);
  });

  it('R4 — un joueur des stats de saison absent de l\'effectif (parti du club) n\'est pas listé', () => {
    stats = [saison(9, 'Openda', 7.3), saison(4, 'Parti', 6)];
    render(<PlayersPage />);
    expect(screen.queryByText('Parti')).toBeNull();
  });

  it('R5 — effectif en chargement : message de chargement, aucune carte ; vide ou erreur : repli sur les stats de saison (L178)', () => {
    squadEtat = { isLoading: true, isError: false };
    squad = undefined;
    const { unmount } = render(<PlayersPage />);
    expect(screen.getByText(/Chargement/)).toBeInTheDocument();
    expect(screen.queryAllByRole('link')).toHaveLength(0);
    unmount();
    squadEtat = { isLoading: false, isError: true };
    render(<PlayersPage />);
    expect(screen.getByText('Openda')).toBeInTheDocument();
    expect(screen.queryByText('Justin Bengui')).toBeNull();
  });
});

describe('Terrain de Composition (L214)', () => {
  const titulaire = (n: number, jerseyNumber: number | null) => ({
    id: n, athleteId: 100 + n, name: `Titulaire ${n}`, shortName: `T. ${n}`, jerseyNumber, position: 'Midfielder',
    positionShort: 'MID', yardLine: 3, yardSide: 20 * n, ranking: null, isStarting: true,
  });

  it('R6 — le terrain n\'écrit un numéro que s\'il est > 0 : -1, 0 et absent ne s\'affichent pas (jamais « ? » ni « -1 »)', () => {
    render(<FormationField starters={[titulaire(1, 8), titulaire(2, -1), titulaire(3, 0), titulaire(4, null)]} formation="4-3-3" retour={{}} />);
    expect(screen.getByLabelText('Fiche de Titulaire 1')).toHaveTextContent('8');
    for (const n of [2, 3, 4]) expect(screen.getByLabelText(`Fiche de Titulaire ${n}`).textContent).toBe(`T. ${n}`);
  });
});
