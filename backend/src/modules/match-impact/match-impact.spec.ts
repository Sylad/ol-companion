import * as fs from 'fs';
import * as path from 'path';
import { computeOlRankingsByRound, parseLeagueGames } from '../standings/season-rankings';
import { computeMatchImpact, keyPlaceGaps, type FdLeagueMatch } from './match-impact';

/**
 * L265 — « Ce que ça change ». Les résultats réels J1–J9 de la fixture du tracker (L241) sont remis
 * au format de football-data (mêmes scores, mêmes journées) : la phrase doit concorder avec le tracker.
 */
type Raw365 = {
  seasonNum: number; roundNum: number; statusGroup: number; startTime: string;
  homeCompetitor: { id: number; name: string; score: number };
  awayCompetitor: { id: number; name: string; score: number };
};
const real = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../../../test/fixtures/ligue1-2026-results-j1-j9.json'), 'utf-8'),
) as { games: Raw365[] };
const OL = 465;

const asFootballData = (games: Raw365[]): FdLeagueMatch[] =>
  games.map((g, i) => ({
    id: i + 1,
    utcDate: new Date(g.startTime).toISOString(),
    status: g.statusGroup === 4 ? 'FINISHED' : 'SCHEDULED',
    matchday: g.roundNum,
    homeTeam: { id: g.homeCompetitor.id, name: g.homeCompetitor.name },
    awayTeam: { id: g.awayCompetitor.id, name: g.awayCompetitor.name },
    score: g.statusGroup === 4 ? { home: g.homeCompetitor.score, away: g.awayCompetitor.score } : { home: null, away: null },
  }));
const fdReal = asFootballData(real.games.filter((g) => g.seasonNum === 94));
const olKickoff = (matchday: number): Date =>
  new Date(fdReal.find((m) => m.matchday === matchday && (m.homeTeam.id === OL || m.awayTeam.id === OL))!.utcDate);

let nextId = 1000;
const m = (
  matchday: number, home: number, away: number, score: [number, number] | null, utcDate = `2026-08-${10 + matchday}T19:00:00Z`,
): FdLeagueMatch => ({
  id: nextId++,
  utcDate,
  status: score ? 'FINISHED' : 'TIMED',
  matchday,
  homeTeam: { id: home, name: `Club ${home}` },
  awayTeam: { id: away, name: `Club ${away}` },
  score: score ? { home: score[0], away: score[1] } : { home: null, away: null },
});

describe('computeMatchImpact — concordance avec le tracker (résultats réels J1–J9)', () => {
  const tracker = computeOlRankingsByRound(parseLeagueGames(real.games, 94), OL);

  it.each(tracker.map((t) => [t.matchday]))('J%i : places avant et après = tracker', (matchday) => {
    const impact = computeMatchImpact(fdReal, OL, olKickoff(matchday))!;
    const after = tracker.find((t) => t.matchday === matchday)!;
    const before = tracker.find((t) => t.matchday === matchday - 1) ?? null;
    expect(impact.matchday).toBe(matchday);
    expect(impact.after).toEqual({ position: after.position, points: after.points });
    expect(impact.before).toEqual(before && { position: before.position, points: before.points });
  });

  it('J7 : Lyon passe de 4e à 1er, à égalité de points avec les 2e à 5e (départage à la différence de buts)', () => {
    const impact = computeMatchImpact(fdReal, OL, olKickoff(7))!;
    expect(impact.before).toEqual({ position: 4, points: 11 });
    expect(impact.after).toEqual({ position: 1, points: 14 });
    expect(impact.above).toBeNull();
    expect(impact.below).toEqual({ place: 1, margin: 0 }); // le 2e a aussi 14 points
  });
});

describe('computeMatchImpact — journée complète ou provisoire', () => {
  it('journée complète (J8) : aucun match restant, classement définitif', () => {
    const impact = computeMatchImpact(fdReal, OL, olKickoff(8))!;
    expect(impact.remaining).toBe(0);
    expect(impact.remainingInMatchday).toBe(0);
  });

  it('journée incomplète (J9 réelle : 7 matchs sur 9 joués) : 2 matchs restants, place provisoire', () => {
    const impact = computeMatchImpact(fdReal, OL, olKickoff(9))!;
    expect(impact.remaining).toBe(2);
    expect(impact.remainingInMatchday).toBe(2);
    expect(impact.after).toEqual({ position: 3, points: 17 });
  });

  it('un match à venir de la journée compte comme restant, il ne compte pas au classement', () => {
    const games = [m(1, OL, 2, [1, 0]), m(1, 3, 4, null)];
    const impact = computeMatchImpact(games, OL, new Date(games[0].utcDate))!;
    expect(impact.remainingInMatchday).toBe(8); // 9 matchs par journée, 1 terminé
    expect(impact.after).toEqual({ position: 1, points: 3 });
  });

  it("un match en retard d'une journée précédente rend la journée provisoire", () => {
    const games = [m(1, OL, 2, [1, 0]), m(1, 3, 4, null), m(2, 2, OL, [0, 0])];
    const impact = computeMatchImpact(games, OL, new Date(games[2].utcDate))!;
    expect(impact.remaining).toBe(18 - 2);
    expect(impact.remainingInMatchday).toBe(8);
  });
});

describe('computeMatchImpact — première journée, égalité de points, cas limites', () => {
  it("première journée : pas de place « avant »", () => {
    const impact = computeMatchImpact(fdReal, OL, olKickoff(1))!;
    expect(impact.matchday).toBe(1);
    expect(impact.before).toBeNull();
    expect(impact.after).toEqual({ position: 3, points: 3 });
  });

  it('égalité de points avec la place clé du dessus : écart 0, l’OL derrière à la différence de buts', () => {
    // J1 : 10 bat 11 3-0 (+3), OL bat 12 1-0 (+1), 13 bat 14 2-0 (+2), 15 bat 16 1-0 (+1, 1 but comme l'OL).
    const games = [m(1, 10, 11, [3, 0]), m(1, OL, 12, [1, 0]), m(1, 13, 14, [2, 0]), m(1, 15, 16, [1, 0])];
    const impact = computeMatchImpact(games, OL, new Date(games[1].utcDate))!;
    expect(impact.after).toEqual({ position: 3, points: 3 }); // à égalité totale avec 15 : meilleure place du groupe
    expect(impact.above).toEqual({ place: 1, gap: 0 });
    expect(impact.below).toEqual({ place: 3, margin: 0 }); // 15, 4e de la liste (3e ex aequo), a aussi 3 points
  });

  it('match pas encore terminé chez football-data : rien de calculé', () => {
    const games = [m(1, OL, 2, null)];
    const impact = computeMatchImpact(games, OL, new Date(games[0].utcDate))!;
    expect(impact.finished).toBe(false);
    expect(impact.after).toBeNull();
    expect(impact.before).toBeNull();
  });

  it('aucun match de l’OL à 12 h près : null', () => {
    const games = [m(1, OL, 2, [1, 0], '2026-08-11T19:00:00Z')];
    expect(computeMatchImpact(games, OL, new Date('2026-08-12T08:00:00Z'))).toBeNull();
    expect(computeMatchImpact(games, OL, new Date('2026-08-12T06:00:00Z'))).not.toBeNull();
  });

  it('match AWARDED (tapis vert) compté comme terminé', () => {
    const games = [{ ...m(1, OL, 2, [3, 0]), status: 'AWARDED' }];
    expect(computeMatchImpact(games, OL, new Date(games[0].utcDate))!.after).toEqual({ position: 1, points: 3 });
  });
});

describe('keyPlaceGaps — places clés (1, 3, 5, 6, 15)', () => {
  const table = (points: number[]) => points.map((p, i) => ({ id: i + 1, points: p, position: i + 1, goalDifference: 0, goalsFor: 0, wins: 0, awayWins: 0 }));
  const pts = [30, 28, 25, 24, 22, 20, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7];

  it('4e : 1 point de la 3e place (Ligue des champions), 4 points d’avance sur la 6e', () => {
    expect(keyPlaceGaps(table(pts), { position: 4, points: 24 })).toEqual({ above: { place: 3, gap: 1 }, below: { place: 5, margin: 4 } });
  });
  it('1er : rien au-dessus, avance sur le 2e', () => {
    expect(keyPlaceGaps(table(pts), { position: 1, points: 30 })).toEqual({ above: null, below: { place: 1, margin: 2 } });
  });
  it('17e : la 15e place au-dessus, rien en dessous', () => {
    expect(keyPlaceGaps(table(pts), { position: 17, points: 8 })).toEqual({ above: { place: 15, gap: 2 }, below: null });
  });
  it('classement incomplet (première journée, 4 clubs) : pas de place clé hors du tableau', () => {
    expect(keyPlaceGaps(table([3, 3, 1, 0]), { position: 3, points: 1 })).toEqual({ above: { place: 1, gap: 2 }, below: { place: 3, margin: 1 } });
  });
});
