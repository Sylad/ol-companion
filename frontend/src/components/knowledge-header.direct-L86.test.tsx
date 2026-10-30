import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { KnowledgeHeader } from './knowledge-header';

vi.mock('@/hooks/use-wiki-image', () => ({ useWikiImage: () => ({ data: undefined }) }));
const standings = vi.hoisted(() => ({ value: { data: undefined } as any }));
vi.mock('@/hooks/use-standings', () => ({ useStandings: () => standings.value }));
const seasonMatches = vi.hoisted(() => ({ value: { data: undefined } as any }));
vi.mock('@/hooks/use-season-matches', () => ({ useSeasonMatches: () => seasonMatches.value }));
const liveMatch = vi.hoisted(() => ({ value: { data: null } as any }));
vi.mock('@/hooks/use-live-match', () => ({ useCurrentLiveMatch: () => liveMatch.value }));

// L86 — le bandeau suit la même règle que les tuiles : pendant un match de Ligue 1 en cours, les points
// sont ceux des matchs terminés, et le rang, qui compte le match en cours, est dit « en direct » (Nielsen n°4).
describe('KnowledgeHeader — L86', () => {
  // Ligne du classement à 9 matchs / 17 pts : elle compte le match en cours (Lyon 1-0 Angers à la 56e).
  const olLigne = {
    position: 5, team: 'Olympique Lyonnais', teamId: 523, played: 9, won: 5, draw: 2, lost: 2,
    goalsFor: 14, goalsAgainst: 9, goalDifference: 5, points: 17,
  };
  const enDirect = {
    status: 'live', competitionId: 35,
    home: { id: 465, name: 'Lyon', score: 1 },
    away: { id: 9, name: 'Angers', score: 0 },
  };
  // 8 matchs terminés : 4V 2N 2D = 14 points.
  const termine = (home: boolean, pour: number, contre: number) => ({
    competitionId: 35, status: 'FINISHED', homeTeamId: home ? 523 : 9, awayTeamId: home ? 9 : 523,
    homeScore: home ? pour : contre, awayScore: home ? contre : pour,
  });
  const terminesL1 = [
    termine(true, 2, 0), termine(false, 3, 2), termine(true, 2, 1), termine(true, 1, 1),
    termine(false, 1, 1), termine(true, 0, 1), termine(false, 1, 2), termine(true, 3, 0),
  ];

  it('R1 — pendant un match de Ligue 1 en cours, le bandeau affiche les points des matchs terminés et dit le rang « en direct »', () => {
    standings.value = { data: { table: [olLigne], currentMatchday: 9 } };
    liveMatch.value = { data: enDirect };
    seasonMatches.value = { data: terminesL1 };
    render(<KnowledgeHeader />);
    expect(screen.getByText('5e de Ligue 1 (en direct) · 14 pts')).toBeInTheDocument();
  });

  it('R2 — sans match en cours, le bandeau lit la ligne du classement telle quelle', () => {
    standings.value = { data: { table: [olLigne], currentMatchday: 9 } };
    liveMatch.value = { data: null };
    seasonMatches.value = { data: terminesL1 };
    render(<KnowledgeHeader />);
    expect(screen.getByText('5e de Ligue 1 · 17 pts')).toBeInTheDocument();
  });

  it('R3 — match en cours mais ligne du classement pas encore à jour (8 matchs) : la ligne telle quelle, sans « en direct »', () => {
    standings.value = { data: { table: [{ ...olLigne, played: 8, won: 4, points: 14 }], currentMatchday: 9 } };
    liveMatch.value = { data: enDirect };
    seasonMatches.value = { data: terminesL1 };
    render(<KnowledgeHeader />);
    expect(screen.getByText('5e de Ligue 1 · 14 pts')).toBeInTheDocument();
  });
});
