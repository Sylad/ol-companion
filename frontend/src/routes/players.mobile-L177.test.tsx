import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import type { PlayerSeasonStats } from '@/types/api';

// L177 — à 390 px : Stats saison = colonne Joueur fixe + UNE colonne de valeur choisie par des puces (qui pilotent le tri) ;
// la fiche garde Date, Adversaire, « Buts · PD » et Min. Au-delà de 640 px (sm:) le tableau complet reste.
// jsdom n'applique pas le CSS : le contrat testé est celui des classes responsives (hidden / sm:table-cell).

let search: Record<string, string | undefined> = {};
const navigate = vi.fn();
vi.mock('@tanstack/react-router', () => ({
  useSearch: () => search,
  useNavigate: () => navigate,
  useParams: () => ({ athleteId: '1' }),
  Link: ({ children, to, className }: { children: React.ReactNode; to: string; className?: string }) => (
    <a href={to} className={className}>{children}</a>
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

const match = {
  gameId: 1, date: '2026-09-20T18:00:00Z', opponent: 'Nice', isHome: true, olScore: 2, opponentScore: 1,
  result: 'W' as const, competitionCode: 'L1' as const, minutes: 90, goals: 1, assists: 2, shots: 3, shotsOnTarget: 1,
  yellowCards: 0, redCards: 0, rating: 7, isStarter: true,
};
const joueur = (n: number, buts: number, passes: number) => ({
  athleteId: n, memberId: n, name: `Joueur ${n}`, shortName: `J. ${n}`, jerseyNumber: n, position: 'Attaquant',
  positionShort: 'ATT', imageVersion: null, matchesPlayed: 3, matchesStarted: 3, minutesPlayed: 270, goals: buts,
  assists: passes, goalContributions: buts + passes, shots: 4, shotsOnTarget: 2, shotAccuracy: 50, yellowCards: 0,
  redCards: 0, averageRating: 6.5, byMatch: [match],
}) as unknown as PlayerSeasonStats;

beforeEach(() => {
  search = { onglet: 'stats' };
  navigate.mockClear();
  stats = [joueur(1, 1, 4), joueur(2, 2, 2), joueur(3, 3, 0)];
});

const visibleSurMobile = (el: Element) => !el.classList.contains('hidden');

describe('<PlayersPage /> — Stats saison à 390 px (L177)', () => {
  it('R1 — sept puces de tri (B+P, Buts, PD, Min, Matchs, Tirs, Note), B+P pressée par défaut, cibles 44 px', () => {
    render(<PlayersPage />);
    const groupe = screen.getByRole('group', { name: 'Trier par' });
    const puces = within(groupe).getAllByRole('button');
    expect(puces.map((b) => b.textContent)).toEqual(['B+P', 'Buts', 'PD', 'Min', 'Matchs', 'Tirs', 'Note']);
    expect(puces.map((b) => b.getAttribute('aria-pressed'))).toEqual(['true', 'false', 'false', 'false', 'false', 'false', 'false']);
    for (const b of puces) expect(b.className).toContain('min-h-11');
    expect(groupe.className).toContain('sm:hidden');
  });

  it('R2 — une puce écrit le tri dans l’URL et la puce du tri courant est pressée', () => {
    render(<PlayersPage />);
    fireEvent.click(screen.getByRole('button', { name: 'PD' }));
    expect(navigate).toHaveBeenCalledWith({ to: '/players', search: { onglet: 'stats', tri: 'passes' }, replace: true });
    search = { onglet: 'stats', tri: 'tirs' };
    render(<PlayersPage />);
    expect(screen.getAllByRole('button', { name: 'Tirs', pressed: true }).length).toBeGreaterThan(0);
  });

  it('R3 — seule la colonne du tri reste affichée sur mobile ; les autres colonnes de valeur sont hidden sm:table-cell', () => {
    search = { onglet: 'stats', tri: 'buts' };
    render(<PlayersPage />);
    const entetes = within(screen.getByRole('table')).getAllByRole('columnheader');
    const nomsVisibles = entetes.filter(visibleSurMobile).map((h) => h.textContent);
    expect(nomsVisibles).toEqual(['Joueur', 'Buts']);
    for (const h of entetes.filter((e) => !visibleSurMobile(e))) expect(h.className).toContain('sm:table-cell');
    const ligne = within(screen.getByRole('table')).getAllByRole('row')[1];
    expect(within(ligne).getAllByRole('cell').filter(visibleSurMobile)).toHaveLength(2);
  });

  it('R4 — par défaut la colonne affichée est B+P, avec la valeur secondaire sous la principale (sm:hidden)', () => {
    render(<PlayersPage />);
    const entetes = within(screen.getByRole('table')).getAllByRole('columnheader');
    expect(entetes.filter(visibleSurMobile).map((h) => h.textContent)).toEqual(['Joueur', 'B+P']);
    const ligne = within(screen.getByRole('table')).getAllByRole('row')[1];
    const secondaire = within(ligne).getByText('1 B · 4 PD');
    expect(secondaire.className).toContain('sm:hidden');
  });

  it('R5 — la colonne Joueur est fixe (sticky) et le poste passe sous le nom sur mobile', () => {
    render(<PlayersPage />);
    const ligne = within(screen.getByRole('table')).getAllByRole('row')[1];
    expect(within(ligne).getAllByRole('cell')[0].className).toContain('sticky');
    expect(within(ligne).getByText('ATT').className).toContain('basis-full');
  });

  it('R6 — le tableau ne force plus 640 px sous sm', () => {
    render(<PlayersPage />);
    const classes = screen.getByRole('table').className;
    expect(classes).toContain('sm:min-w-[640px]');
    expect(classes).not.toMatch(/(^|\s)min-w-\[640px\]/);
  });
});

describe('<PlayersPage /> — valeur secondaire sous la principale (L177)', () => {
  // Joueur 1 : 1 seul match (singulier) ; joueur 2 : 3 matchs. L'ordre des lignes dépend du tri : on retrouve la ligne par le nom.
  const lignes = () => within(screen.getByRole('table')).getAllByRole('row').slice(1);
  const ligneDe = (nom: string) => lignes().find((l) => within(l).queryByText(nom))!;
  const secondaireDe = (ligne: HTMLElement) =>
    Array.from(ligne.querySelectorAll('span.block')).map((e) => e.textContent);

  beforeEach(() => {
    stats = [
      { ...joueur(1, 1, 4), matchesPlayed: 1 } as PlayerSeasonStats,
      joueur(2, 2, 2),
    ];
  });

  it.each(['buts', 'passes', 'minutes', 'note'])('R9 — tri « %s » : « N match(s) » sous la valeur, au singulier à 1, dans la cellule du tri, sm:hidden', (tri) => {
    search = { onglet: 'stats', tri };
    render(<PlayersPage />);
    expect(secondaireDe(ligneDe('Joueur 1'))).toEqual(['1 match']);
    expect(secondaireDe(ligneDe('Joueur 2'))).toEqual(['3 matchs']);
    const cellule = within(ligneDe('Joueur 1')).getByText('1 match');
    expect(cellule.className).toContain('sm:hidden');
    // la valeur secondaire est dans la colonne visible sur mobile (celle du tri), pas dans une cellule masquée
    expect(visibleSurMobile(cellule.closest('td')!)).toBe(true);
  });

  it.each(['bp', 'matchs', 'tirs'])('R10 — tri « %s » : une seule valeur secondaire au plus, jamais « N matchs » en double', (tri) => {
    search = { onglet: 'stats', tri };
    render(<PlayersPage />);
    for (const l of lignes()) expect(secondaireDe(l).length).toBe(tri === 'bp' ? 1 : 0);
    if (tri === 'bp') expect(secondaireDe(ligneDe('Joueur 1'))).toEqual(['1 B · 4 PD']);
  });

  it('R11 — sous sm la colonne Joueur est fixe, et au-delà de 640 px elle redevient statique et transparente (le survol de la ligne la colore)', () => {
    render(<PlayersPage />);
    const entete = within(screen.getByRole('table')).getByRole('columnheader', { name: 'Joueur' });
    const cellule = within(lignes()[0]).getAllByRole('cell')[0];
    for (const el of [entete, cellule]) {
      expect(el.className).toContain('sticky');
      expect(el.className).toContain('bg-surface');
      expect(el.className).toContain('sm:static');
      expect(el.className).toContain('sm:bg-transparent');
    }
  });
});

describe('<PlayerDetailPage /> — Détail saison à 390 px (L177)', () => {
  it('R7 — Date, Adversaire, « Buts · PD » et Min restent affichés ; Score, Comp., Buts, PD et Tirs sont hidden sm:table-cell', () => {
    render(<PlayerDetailPage />);
    const entetes = within(screen.getByRole('table')).getAllByRole('columnheader');
    expect(entetes.filter(visibleSurMobile).map((h) => h.textContent)).toEqual(['Date', 'Adv.', 'Buts · PD', 'Min']);
    const ligne = within(screen.getByRole('table')).getAllByRole('row')[1];
    expect(within(ligne).getByText('1 · 2')).toBeInTheDocument();
    const masques = entetes.filter((e) => !visibleSurMobile(e));
    expect(masques.map((h) => h.textContent)).toEqual(['Score', 'Comp.', 'Buts', 'Passes D.', 'Tirs']);
    for (const h of masques) expect(h.className).toContain('sm:table-cell');
  });

  it('R8 — la colonne « Buts · PD » n’existe que sur mobile (sm:hidden)', () => {
    render(<PlayerDetailPage />);
    const h = within(screen.getByRole('table')).getByRole('columnheader', { name: 'Buts · PD' });
    expect(h.className).toContain('sm:hidden');
  });
});
