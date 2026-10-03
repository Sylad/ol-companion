import { describe, expect, it } from 'vitest';
import type { SeasonMatch } from '@/types/api';
import season from '@/test/fixtures/season-matches-2026-10-03.json';
import {
  byCompetition,
  byStatus,
  competitionOptions,
  countResults,
  groupMatches,
  matchLabel,
  statusCounts,
} from './calendar';

// L39 — le calendrier liste toutes les compétitions. Charge réelle : ce que
// /api/season-matches rend pour la saison que 365scores servait le 03-10-2026
// (34 journées de Ligue 1, 8 matchs de Ligue Europa, 6 joués).
const matches = season as SeasonMatch[];

function cup(partial: Partial<SeasonMatch> & { id: number; date: string }): SeasonMatch {
  return {
    homeTeam: 'Lyon',
    homeTeamId: 523,
    awayTeam: 'Lens',
    awayTeamId: 481,
    homeScore: null,
    awayScore: null,
    competition: 'Coupe de France',
    competitionCode: 'CDF',
    competitionId: 37,
    status: 'SCHEDULED',
    matchday: null,
    timeConfirmed: true,
    ...partial,
  };
}

describe('calendrier — compteurs et filtres', () => {
  it('compte toute la saison : 42 matchs, 36 à venir, 6 joués', () => {
    expect(statusCounts(matches)).toEqual({ all: 42, upcoming: 36, past: 6 });
  });

  it('propose les compétitions présentes, dans l’ordre Ligue 1 puis Europe, avec leur total', () => {
    expect(competitionOptions(matches)).toEqual([
      { code: 'L1', label: 'Ligue 1', name: 'Ligue 1', count: 34 },
      { code: 'UEL', label: 'Europa', name: 'UEFA Europa League', count: 8 },
    ]);
  });

  it('ajoute la Coupe de France dès qu’un match y est connu', () => {
    const withCup = [...matches, cup({ id: 1, date: '2027-01-09T19:45:00.000Z' })];
    expect(competitionOptions(withCup).map((o) => [o.code, o.label, o.count])).toEqual([
      ['L1', 'Ligue 1', 34],
      ['UEL', 'Europa', 8],
      ['CDF', 'Coupe', 1],
    ]);
  });

  it('filtre par compétition puis par statut ; les compteurs suivent la compétition choisie', () => {
    const europa = byCompetition(matches, 'UEL');
    expect(europa).toHaveLength(8);
    expect(statusCounts(europa)).toEqual({ all: 8, upcoming: 7, past: 1 });
    expect(byStatus(europa, 'past').map((m) => m.homeTeam)).toEqual(['Anderlecht']);
    expect(byStatus(europa, 'upcoming')).toHaveLength(7);
    expect(byCompetition(matches, 'all')).toHaveLength(42);
    expect(byStatus(matches, 'all')).toHaveLength(42);
  });

  it('bilan de l’OL sur les matchs joués : 4 victoires, 2 nuls, toutes compétitions', () => {
    expect(countResults(matches)).toEqual({ wins: 4, draws: 2, losses: 0 });
    expect(countResults(byCompetition(matches, 'UEL'))).toEqual({ wins: 1, draws: 0, losses: 0 });
  });
});

describe('calendrier — libellé et regroupement', () => {
  it('garde la journée de Ligue 1 et nomme la compétition de chaque match', () => {
    const lens = matches.find((m) => m.id === 4735252)!;
    const palace = matches.find((m) => m.id === 4828743)!;
    expect(matchLabel(lens)).toBe('Ligue 1 · J6');
    expect(matchLabel(palace)).toBe('UEFA Europa League · J2');
  });

  it('sans journée (tour de coupe) : la compétition seule, jamais « J0 »', () => {
    expect(matchLabel(cup({ id: 1, date: '2027-01-09T19:45:00.000Z' }))).toBe('Coupe de France');
  });

  it('rend les matchs dans l’ordre des dates, un bloc par libellé', () => {
    const groups = groupMatches(matches);
    expect(groups).toHaveLength(42);
    expect(groups.slice(4, 8).map((g) => g.label)).toEqual([
      'UEFA Europa League · J1',
      'Ligue 1 · J5',
      'Ligue 1 · J6',
      'UEFA Europa League · J2',
    ]);
    const dates = groups.flatMap((g) => g.matches.map((m) => m.date));
    expect([...dates].sort()).toEqual(dates);
    expect(new Set(groups.map((g) => g.key)).size).toBe(42);
  });

  it('deux tours de coupe séparés par un autre match ne sont pas rapprochés', () => {
    const list = [
      cup({ id: 1, date: '2027-01-09T19:45:00.000Z' }),
      matches.find((m) => m.matchday === 16 && m.competitionCode === 'L1')!,
      cup({ id: 2, date: '2027-02-03T19:45:00.000Z' }),
    ];
    expect(groupMatches(list).map((g) => [g.label, g.matches.map((m) => m.id)])).toEqual([
      ['Coupe de France', [1]],
      ['Ligue 1 · J16', [4735161]],
      ['Coupe de France', [2]],
    ]);
  });

  it('deux matchs consécutifs de même libellé partagent un bloc', () => {
    const list = [
      cup({ id: 1, date: '2027-01-09T19:45:00.000Z' }),
      cup({ id: 2, date: '2027-01-12T19:45:00.000Z' }),
    ];
    expect(groupMatches(list).map((g) => g.matches.map((m) => m.id))).toEqual([[1, 2]]);
  });
});
