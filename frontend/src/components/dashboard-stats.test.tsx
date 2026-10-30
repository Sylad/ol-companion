import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DashboardStats } from './dashboard-stats';

const standings = vi.hoisted(() => ({ value: { data: undefined, isError: false, refetch: () => {} } as any }));
vi.mock('@/hooks/use-standings', () => ({ useStandings: () => standings.value }));
const seasonMatches = vi.hoisted(() => ({ value: { data: undefined } as any }));
vi.mock('@/hooks/use-season-matches', () => ({ useSeasonMatches: () => seasonMatches.value }));
const liveMatch = vi.hoisted(() => ({ value: { data: null } as any }));
vi.mock('@/hooks/use-live-match', () => ({ useCurrentLiveMatch: () => liveMatch.value }));
vi.mock('@/hooks/use-season-rankings', () => ({
  useSeasonRankings: () => ({
    data: [
      { matchday: 1, position: 3 },
      { matchday: 2, position: 5 },
    ],
  }),
}));

describe('DashboardStats', () => {
  it('R1 — chargement : pas de flèche de tendance sans l’OL, même si les rankings sont là', () => {
    standings.value = { data: undefined, isError: false, refetch: () => {} };
    render(<DashboardStats />);
    expect(screen.getByTestId('stat-position').textContent).not.toMatch(/[↑↓]/);
  });

  it('R6 — vide : pas de flèche de tendance quand le classement ne contient pas l’OL', () => {
    standings.value = { data: { table: [], currentMatchday: 7 }, isError: false, refetch: () => {} };
    render(<DashboardStats />);
    expect(screen.getByTestId('stat-position').textContent).not.toMatch(/[↑↓]/);
  });
});

// L73 — docs/qa/expectations.md (section `/`) nomme les tuiles telles que l'écran les écrit.
describe('DashboardStats — L73', () => {
  it('R2 — l’attente QA de / cite le libellé « Différence buts » de la tuile, pas « Différence de buts »', () => {
    standings.value = { data: { table: [], currentMatchday: 7 }, isError: false, refetch: () => {} };
    render(<DashboardStats />);
    const libelle = screen.getByTestId('stat-diff').textContent ?? '';
    expect(libelle.toLowerCase()).toContain('différence buts');
    const attentes = readFileSync(resolve(__dirname, '../../../docs/qa/expectations.md'), 'utf8');
    const ligneTuiles = attentes.split('\n').find((l) => l.includes('les tuiles Position')) ?? '';
    expect(ligneTuiles).toContain('Différence buts');
    expect(ligneTuiles).not.toContain('Différence de buts');
  });
});

// L86 — la pastille Ligue 1 du bilan de saison ne compte pas le match en cours : les tuiles non plus.
describe('DashboardStats — L86', () => {
  const olLigne = {
    position: 2, team: 'Olympique Lyonnais', teamId: 523, played: 6, won: 3, draw: 2, lost: 1,
    goalsFor: 9, goalsAgainst: 6, goalDifference: 3, points: 11,
  };
  const enDirect = {
    status: 'live', competitionId: 35,
    home: { id: 7, name: 'Lens', score: 1 },
    away: { id: 465, name: 'Lyon', score: 0 },
  };

  // 5 matchs terminés : 3V 2N 0D, 9 buts pour, 5 contre, 11 points
  const termine = (home: boolean, pour: number, contre: number) => ({
    competitionId: 35, status: 'FINISHED', homeTeamId: home ? 523 : 7, awayTeamId: home ? 7 : 523,
    homeScore: home ? pour : contre, awayScore: home ? contre : pour,
  });
  const terminesL1 = [termine(true, 2, 0), termine(false, 3, 2), termine(true, 2, 1), termine(true, 1, 1), termine(false, 1, 1)];

  it('R1 — pendant un match de Ligue 1 perdu à cet instant, les tuiles ne le comptent ni joué ni perdu', () => {
    standings.value = { data: { table: [olLigne], currentMatchday: 7 }, isError: false, refetch: () => {} };
    liveMatch.value = { data: enDirect };
    seasonMatches.value = { data: terminesL1 };
    render(<DashboardStats />);
    expect(screen.getByTestId('stat-points').textContent).toContain('5 matchs · 2,20 pts/match');
    expect(screen.getByTestId('stat-forme').textContent).toContain('2N · 0D');
    expect(screen.getByTestId('stat-diff').textContent).toContain('9 pour · 5 contre');
  });

  it('R2 — classement plus ancien que le direct (ligne sans le match en cours) : les tuiles gardent la ligne', () => {
    standings.value = { data: { table: [{ ...olLigne, played: 5, lost: 0 }], currentMatchday: 7 }, isError: false, refetch: () => {} };
    liveMatch.value = { data: enDirect };
    seasonMatches.value = { data: terminesL1 };
    render(<DashboardStats />);
    expect(screen.getByTestId('stat-points').textContent).toContain('5 matchs');
    expect(screen.getByTestId('stat-forme').textContent).toContain('2N · 0D');
  });

  it('R3 — sans match en cours, les tuiles gardent le bilan du classement', () => {
    standings.value = { data: { table: [olLigne], currentMatchday: 7 }, isError: false, refetch: () => {} };
    liveMatch.value = { data: null };
    seasonMatches.value = { data: terminesL1 };
    render(<DashboardStats />);
    expect(screen.getByTestId('stat-points').textContent).toContain('6 matchs');
    expect(screen.getByTestId('stat-forme').textContent).toContain('2N · 1D');
  });

  it('R4 — le rang compte le match en cours : la tuile Position le dit « classement en direct », sinon « Ligue 1 · J… »', () => {
    standings.value = { data: { table: [olLigne], currentMatchday: 7 }, isError: false, refetch: () => {} };
    liveMatch.value = { data: enDirect };
    seasonMatches.value = { data: terminesL1 };
    const { unmount } = render(<DashboardStats />);
    expect(screen.getByTestId('stat-position').textContent).toContain('Classement en direct · J7');
    unmount();
    liveMatch.value = { data: null };
    render(<DashboardStats />);
    expect(screen.getByTestId('stat-position').textContent).toContain('Ligue 1 · J7');
    expect(screen.getByTestId('stat-position').textContent).not.toContain('en direct');
  });
});

// L88 — libellés de l'accueil : V/N/D, virgule française, « pts/match ».
describe('DashboardStats — L88', () => {
  const olLigne = {
    position: 2, team: 'Olympique Lyonnais', teamId: 523, played: 6, won: 3, draw: 2, lost: 1,
    goalsFor: 9, goalsAgainst: 6, goalDifference: 3, points: 11, recentForm: ['W', 'D', 'L', 'W', 'D', 'W'],
  };
  const rendre = (ligne = olLigne) => {
    standings.value = { data: { table: [ligne], currentMatchday: 6 }, isError: false, refetch: () => {} };
    liveMatch.value = { data: null };
    seasonMatches.value = { data: undefined };
    render(<DashboardStats />);
  };

  it('R1 — la bande de forme écrit V/N/D (N = nul), plus W/D/L, avec un nom accessible par pastille', () => {
    rendre();
    const bande = screen.getByTestId('stat-forme');
    const pastilles = within(bande).getAllByRole('img');
    // la bande est affichée du plus ancien au plus récent
    expect(pastilles.map((p) => p.textContent)).toEqual(['V', 'N', 'V', 'D', 'N', 'V']);
    expect(pastilles.map((p) => p.getAttribute('aria-label'))).toEqual([
      'Victoire', 'Match nul', 'Victoire', 'Défaite', 'Match nul', 'Victoire',
    ]);
  });

  it('R2 — « Points » : 11 pts en 6 matchs → « 1,83 pts/match » (virgule), jamais « ppm »', () => {
    rendre();
    const texte = screen.getByTestId('stat-points').textContent ?? '';
    expect(texte).toContain('6 matchs · 1,83 pts/match');
    expect(texte).not.toMatch(/ppm|1\.83/);
  });

  it('R2 — un seul match joué : « 1 match », pas « 1 matchs »', () => {
    rendre({ ...olLigne, played: 1, won: 1, draw: 0, lost: 0, points: 3, recentForm: ['W'] } as never);
    expect(screen.getByTestId('stat-points').textContent).toContain('1 match · 3,00 pts/match');
  });
});
