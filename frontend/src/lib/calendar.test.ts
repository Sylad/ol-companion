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
  matchupId,
  statusCounts,
} from './calendar';

// L39 — le calendrier liste toutes les compétitions. Charge réelle : ce que
// /api/season-matches rend pour la saison que 365scores servait le 03-10-2026
// (34 journées de Ligue 1, 8 matchs de Ligue Europa, 4 matchs de qualification
// de Ligue des champions, 10 joués).
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
    round: null,
    timeConfirmed: true,
    ...partial,
  };
}

describe('calendrier — compteurs et filtres', () => {
  it('compte toute la saison : 46 matchs, 36 à venir, 10 joués', () => {
    expect(statusCounts(matches)).toEqual({ all: 46, upcoming: 36, past: 10 });
  });

  it('propose les compétitions présentes, dans l’ordre Ligue 1 puis Europe, avec leur total', () => {
    expect(competitionOptions(matches)).toEqual([
      { code: 'L1', label: 'L1', name: 'Ligue 1', count: 34 },
      { code: 'UCL', label: 'C1', name: 'Ligue des champions', count: 4 },
      { code: 'UEL', label: 'C3', name: 'Ligue Europa', count: 8 },
    ]);
  });

  it('chaque match de la saison tombe sous une pastille : la somme des pastilles égale le total', () => {
    const options = competitionOptions(matches);
    expect(options.reduce((sum, o) => sum + o.count, 0)).toBe(matches.length);
    expect(new Set(matches.map((m) => m.competitionCode))).toEqual(new Set(options.map((o) => o.code)));
  });

  it('ajoute la Coupe de France dès qu’un match y est connu', () => {
    const withCup = [...matches, cup({ id: 1, date: '2027-01-09T19:45:00.000Z' })];
    expect(competitionOptions(withCup).map((o) => [o.code, o.label, o.count])).toEqual([
      ['L1', 'L1', 34],
      ['UCL', 'C1', 4],
      ['UEL', 'C3', 8],
      ['CDF', 'CdF', 1],
    ]);
  });

  it('filtre par compétition puis par statut ; les compteurs suivent la compétition choisie', () => {
    const europa = byCompetition(matches, 'UEL');
    expect(europa).toHaveLength(8);
    expect(statusCounts(europa)).toEqual({ all: 8, upcoming: 7, past: 1 });
    expect(byStatus(europa, 'past').map((m) => m.homeTeam)).toEqual(['Anderlecht']);
    expect(byStatus(europa, 'upcoming')).toHaveLength(7);
    expect(byCompetition(matches, 'all')).toHaveLength(46);
    expect(byStatus(matches, 'all')).toHaveLength(46);
  });

  it('qualifications de Ligue des champions : 4 matchs, tous joués, à leur date', () => {
    const champions = byCompetition(matches, 'UCL');
    expect(champions.map((m) => [m.id, m.date.slice(0, 10)])).toEqual([
      [4779514, '2026-08-04'],
      [4779515, '2026-08-11'],
      [4809607, '2026-08-18'],
      [4809611, '2026-08-26'],
    ]);
    expect(statusCounts(champions)).toEqual({ all: 4, upcoming: 0, past: 4 });
  });

  it('bilan de l’OL sur les matchs joués : 5 victoires, 3 nuls, 2 défaites, toutes compétitions', () => {
    expect(countResults(matches)).toEqual({ wins: 5, draws: 3, losses: 2 });
    expect(countResults(byCompetition(matches, 'UEL'))).toEqual({ wins: 1, draws: 0, losses: 0 });
    expect(countResults(byCompetition(matches, 'UCL'))).toEqual({ wins: 1, draws: 1, losses: 2 });
    expect(countResults(byCompetition(matches, 'L1'))).toEqual({ wins: 3, draws: 2, losses: 0 });
  });
});

describe('calendrier — libellé et regroupement', () => {
  it('garde la journée de Ligue 1 et nomme la compétition de chaque match', () => {
    const lens = matches.find((m) => m.id === 4735252)!;
    const palace = matches.find((m) => m.id === 4828743)!;
    expect(matchLabel(lens)).toBe('Ligue 1 · J6');
    expect(matchLabel(palace)).toBe('Ligue Europa · J2');
  });

  it('sans journée (tour de coupe) : la compétition seule, jamais « J0 »', () => {
    expect(matchLabel(cup({ id: 1, date: '2027-01-09T19:45:00.000Z' }))).toBe('Coupe de France');
  });

  it('sans journée mais avec un tour : la compétition, le tour et la manche', () => {
    expect(matches.filter((m) => m.competitionCode === 'UCL').map(matchLabel)).toEqual([
      'Ligue des champions · 3e tour de qualification · aller',
      'Ligue des champions · 3e tour de qualification · retour',
      'Ligue des champions · Barrages · aller',
      'Ligue des champions · Barrages · retour',
    ]);
  });

  it('champ `round` absent (backend antérieur) : la compétition seule', () => {
    const { round: _round, ...older } = cup({ id: 1, date: '2027-01-09T19:45:00.000Z' });
    expect(matchLabel(older as SeasonMatch)).toBe('Coupe de France');
  });

  it('rend les matchs dans l’ordre des dates, un bloc par libellé', () => {
    const groups = groupMatches(matches);
    expect(groups).toHaveLength(46);
    // Le barrage retour (26-08) vient après la J1 de Ligue 1 (22-08).
    expect(groups.slice(0, 5).map((g) => g.label)).toEqual([
      'Ligue des champions · 3e tour de qualification · aller',
      'Ligue des champions · 3e tour de qualification · retour',
      'Ligue des champions · Barrages · aller',
      'Ligue 1 · J1',
      'Ligue des champions · Barrages · retour',
    ]);
    expect(groups.slice(8, 12).map((g) => g.label)).toEqual([
      'Ligue Europa · J1',
      'Ligue 1 · J5',
      'Ligue 1 · J6',
      'Ligue Europa · J2',
    ]);
    const dates = groups.flatMap((g) => g.matches.map((m) => m.date));
    expect([...dates].sort()).toEqual(dates);
    expect(new Set(groups.map((g) => g.key)).size).toBe(46);
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

// L96 — la page match demande `matchupId` = « <365 domicile>-<365 extérieur>-<id> » :
// l'OL est stocké sous 523 (football-data) au calendrier, mais 465 chez 365scores.
describe('matchupId (L96)', () => {
  it("rend l'OL à domicile sous son identifiant 365scores (465), pas 523", () => {
    const m = cup({ id: 4609001, date: '2026-10-04T15:00:00Z' });
    expect(matchupId({ ...m, homeTeamId: 523, awayTeamId: 1 })).toBe('465-1-4609001');
  });
  it("rend l'OL à l'extérieur sous 465", () => {
    const m = cup({ id: 77, date: '2026-10-04T15:00:00Z' });
    expect(matchupId({ ...m, homeTeamId: 9, awayTeamId: 523 })).toBe('9-465-77');
  });
});
