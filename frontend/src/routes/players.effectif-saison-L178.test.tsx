import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import type { LineupPlayer, LineupResponse, PlayerSeasonStats } from '@/types/api';

// L178 — l'onglet Effectif est celui de la SAISON (/api/players/season-stats), pas de la dernière feuille de match ;
// noms sur deux lignes, libellés expliqués, notes en français, joueurs de la Composition qui mènent à leur fiche.

let search: Record<string, string | undefined> = {};
vi.mock('@tanstack/react-router', () => ({
  useSearch: () => search,
  useNavigate: () => vi.fn(),
  useParams: () => ({ athleteId: '1' }),
  Link: ({ children, params, search: s, className }: { children: React.ReactNode; params?: { athleteId: string }; search?: unknown; className?: string }) => (
    <a href={`/player/${params?.athleteId}`} data-search={JSON.stringify(s ?? null)} className={className}>{children}</a>
  ),
}));
let lineup: LineupResponse | undefined;
let stats: PlayerSeasonStats[] | undefined;
let statsEtat = { isLoading: false, isError: false };
vi.mock('@/hooks/use-lineup', () => ({ useLineup: () => ({ data: lineup, isLoading: false, isError: false, refetch: vi.fn() }) }));
vi.mock('@/hooks/use-player-stats', () => ({
  useSeasonStats: () => ({ data: stats, ...statsEtat, refetch: vi.fn() }),
  usePlayerSeasonStats: () => ({ data: stats?.[0], isLoading: false, isError: false }),
}));
vi.mock('@/components/knowledge-header', () => ({ KnowledgeHeader: () => null }));
vi.mock('@/components/team-logo', () => ({ TeamLogo: () => null }));
vi.mock('recharts', () => {
  const Null = () => null;
  return { LineChart: Null, Line: Null, XAxis: Null, YAxis: Null, CartesianGrid: Null, Tooltip: Null, ResponsiveContainer: Null };
});

import { PlayersPage } from './players';
import { PlayerDetailPage } from './player.$athleteId';

const joueur = (n: number, nom = `Joueur ${n}`, note: number | null = 7.3): PlayerSeasonStats => ({
  athleteId: n, memberId: n, name: nom, shortName: nom, jerseyNumber: n, position: 'Attaquant', positionShort: 'ATT',
  imageVersion: null, matchesPlayed: 10, matchesStarted: 8, minutesPlayed: 700, goals: 3, assists: 2, goalContributions: 5,
  shots: 21, shotsOnTarget: 11, shotAccuracy: 52, yellowCards: 0, redCards: 0, averageRating: note,
  byMatch: [{
    gameId: 1, date: '2026-09-20T18:00:00Z', opponent: 'Nice', isHome: false, olScore: 2, opponentScore: 1, result: 'W',
    competitionCode: 'L1', minutes: 90, goals: 1, assists: 0, shots: 3, shotsOnTarget: 1, yellowCards: 0, redCards: 0, rating: 7, isStarter: true,
  }],
}) as unknown as PlayerSeasonStats;

const lp = (n: number, starting: boolean, ranking: number | null): LineupPlayer => ({
  id: n, athleteId: 500 + n, name: `Feuille ${n}`, shortName: `F. ${n}`, jerseyNumber: n, position: 'Milieu',
  positionShort: 'M', yardLine: 2, yardSide: 20 * n, ranking, isStarting: starting,
});

beforeEach(() => {
  search = {};
  statsEtat = { isLoading: false, isError: false };
  stats = [joueur(9, 'Openda'), joueur(2, 'Maitland-Niles'), joueur(30, 'Fofana')];
  lineup = {
    gameId: 1, date: '2026-10-10T19:00:00Z', competition: 'Ligue 1', matchday: 8, opponent: 'Lens', opponentId: 7,
    isHome: true, homeScore: 2, awayScore: 1, formation: '4-3-3',
    starters: [lp(1, true, 8.4)], bench: [lp(3, false, null)], injured: [],
  };
});

describe('Effectif de la saison (L178)', () => {
  it('Effectif : tous les joueurs de la saison (pas seulement la feuille de match), triés par numéro, avec lien vers la fiche', () => {
    search = { onglet: 'effectif', tri: 'buts' };
    render(<PlayersPage />);
    const noms = screen.getAllByRole('link').map((a) => a.textContent ?? '');
    expect(noms.map((t) => t.match(/Maitland-Niles|Openda|Fofana|Feuille \d/)?.[0])).toEqual(['Feuille 1', 'Maitland-Niles', 'Feuille 3', 'Openda', 'Fofana']);
    // convoqués qui n'ont pas encore joué : sur la feuille du dernier match, absents des stats de saison
    expect(screen.getByText('Feuille 1')).toBeInTheDocument();
    expect(screen.getByText('Feuille 3')).toBeInTheDocument();
    const lien = screen.getByText('Openda').closest('a')!;
    expect(lien).toHaveAttribute('href', '/player/9');
    expect(JSON.parse(lien.getAttribute('data-search')!)).toEqual({ onglet: 'effectif', tri: 'buts' });
  });

  it('Effectif : un joueur présent dans les stats ET sur la feuille n\'apparaît qu\'une fois (dédoublonné par athleteId)', () => {
    lineup!.bench = [{ ...lp(9, false, null), athleteId: 9, name: 'Openda (feuille)' }];
    search = { onglet: 'effectif' };
    render(<PlayersPage />);
    expect(screen.getAllByText('Openda')).toHaveLength(1);
    expect(screen.queryByText('Openda (feuille)')).toBeNull();
  });

  it('Effectif : fonctionne sans feuille de match (lineup absent) et montre la note moyenne en français', () => {
    lineup = undefined;
    search = { onglet: 'effectif' };
    render(<PlayersPage />);
    expect(screen.getByText('Openda')).toBeInTheDocument();
    expect(screen.getAllByText('7,3').length).toBe(3);
    expect(screen.getAllByText('Note moyenne').length).toBe(3);
  });

  it('Effectif : les états chargement / erreur / vide sont ceux des stats de saison', () => {
    search = { onglet: 'effectif' };
    statsEtat = { isLoading: false, isError: true };
    stats = undefined;
    const { unmount } = render(<PlayersPage />);
    expect(screen.getByRole('status')).toHaveTextContent(/stats de la saison/);
    unmount();
    statsEtat = { isLoading: false, isError: false };
    stats = [];
    lineup = undefined;
    render(<PlayersPage />);
    expect(screen.getByRole('status')).toHaveTextContent(/Aucun joueur/);
  });
});

describe('Convoqués de la feuille dans l\'Effectif (L178)', () => {
  // Libellés réels de /api/lineup (mesurés dans backend/data/lineup-cache.json) : `position` = ligne, `positionShort` = code OU libellé long.
  it.each([
    ['Defender', 'Centre Back', 'DEF'],
    ['Defender', 'Right Back', 'DEF'],
    ['Midfielder', 'Central Midfield', 'MIL'],
    ['Attacker', 'Centre Forward', 'ATT'],
    ['Goalkeeper', 'Goalkeeper', 'GB'],
    ['Defender', 'Sweeper', 'DEF'],
  ])('Effectif : un convoqué « %s / %s » a la même étiquette de ligne que les cartes de la saison (%s : GB, DEF, MIL, ATT), ni « Banc » ni poste détaillé', (position, court, attendu) => {
    lineup!.bench = [{ ...lp(3, false, 6.1), position, positionShort: court }];
    search = { onglet: 'effectif' };
    render(<PlayersPage />);
    const carte = screen.getByText('Feuille 3').closest('a')!;
    expect(within(carte).queryByText('Banc')).toBeNull();
    expect(within(carte).getByText(attendu)).toBeInTheDocument();
    for (const detaille of ['DC', 'DD', 'DG', 'MC', 'AC', 'MO']) expect(within(carte).queryByText(detaille)).toBeNull();
    // la note du dernier match n'est pas une moyenne de saison
    expect(within(carte).queryByText('6,1')).toBeNull();
  });
});

describe('Noms, libellés et notes (L178)', () => {
  it('noms sur deux lignes au lieu de tronqués (carte de l\'Effectif et du banc)', async () => {
    const { PlayerCard } = await import('@/components/player-card');
    for (const compact of [false, true]) {
      const { unmount } = render(<PlayerCard player={lp(1, true, null)} compact={compact} />);
      const nom = screen.getByText('Feuille 1');
      expect(nom.className).toContain('line-clamp-2');
      expect(nom.className).not.toContain('truncate');
      unmount();
    }
  });

  it('Stats saison : B+P expliqué (abbr) et légende des parenthèses (titularisations, tirs cadrés)', () => {
    search = { onglet: 'stats' };
    render(<PlayersPage />);
    expect(screen.getByTitle('Buts + passes décisives').tagName).toBe('ABBR');
    const legende = screen.getByTestId('legende-stats');
    expect(legende).toHaveTextContent('titularisations');
    expect(legende).toHaveTextContent('tirs cadrés');
    expect(legende).toHaveTextContent('B+P');
    expect(screen.getAllByText('7,3').length).toBeGreaterThan(0);
  });

  it('fiche : « Tirs » lit « 21 (11) » avec « dont cadrés », note en français, (D)/(E) expliqués', () => {
    render(<PlayerDetailPage />);
    expect(screen.getByText('Tirs (dont cadrés)')).toBeInTheDocument();
    expect(screen.getByText('21 (11)')).toBeInTheDocument();
    expect(screen.queryByText('21/11')).toBeNull();
    expect(screen.getByText('7,3')).toBeInTheDocument();
    expect(screen.getByTitle('À l\'extérieur').tagName).toBe('ABBR');
    expect(screen.getByTestId('legende-domicile')).toHaveTextContent('D = à domicile');
  });
});

describe('Composition : joueurs vers leur fiche (L178)', () => {
  it('titulaires du terrain et joueurs du banc sont des liens vers la fiche, avec retour à la Composition', () => {
    render(<PlayersPage />);
    const titulaire = screen.getByText('F. 1').closest('a')!;
    expect(titulaire).toHaveAttribute('href', '/player/501');
    const banc = within(screen.getByText(/^Banc/).parentElement!).getByText('Feuille 3').closest('a')!;
    expect(banc).toHaveAttribute('href', '/player/503');
    expect(JSON.parse(banc.getAttribute('data-search')!)).toEqual({});
  });

  it('pastille de note du terrain en français', () => {
    render(<PlayersPage />);
    expect(screen.getByText('8,4')).toBeInTheDocument();
  });
});

describe('Numéro de maillot inconnu dans l\'Effectif (L213)', () => {
  it.each([-1, 0])('L213 R2 — un numéro %i n\'est écrit nulle part sur la carte, et la carte passe après les numéros connus', (numero) => {
    stats = [{ ...joueur(9, 'Openda'), jerseyNumber: numero }, joueur(2, 'Maitland-Niles'), joueur(30, 'Fofana')];
    lineup = undefined;
    search = { onglet: 'effectif' };
    render(<PlayersPage />);
    const carte = screen.getByText('Openda').closest('a')!;
    expect(carte).not.toHaveTextContent(/-1|(^|\D)0(\D|$)/);
    expect(carte).not.toHaveTextContent('#');
    const noms = screen.getAllByRole('link').map((a) => a.textContent?.match(/Maitland-Niles|Openda|Fofana/)?.[0]);
    expect(noms).toEqual(['Maitland-Niles', 'Fofana', 'Openda']);
  });

  it.each([-1, 0])('L213 R3 — la carte compacte du banc (numéro %i) n\'écrit pas « # »', async (numero) => {
    const { PlayerCard } = await import('@/components/player-card');
    const { container } = render(<PlayerCard player={{ ...lp(1, false, null), jerseyNumber: numero }} compact />);
    expect(container).toHaveTextContent('Feuille 1');
    expect(container).not.toHaveTextContent('#');
  });

  it.each([-1, 0])('L213 R4 — la fiche d\'un joueur avec minutes et numéro %i n\'écrit ni « # » ni le chiffre en vignette', (numero) => {
    stats = [{ ...joueur(9, 'Openda'), jerseyNumber: numero }];
    render(<PlayerDetailPage />);
    const entete = screen.getByRole('heading', { level: 1, name: 'Openda' }).parentElement!;
    expect(entete).not.toHaveTextContent('#');
    expect(entete.parentElement!.querySelector('.font-mono.text-2xl')).toBeNull();
  });
});
