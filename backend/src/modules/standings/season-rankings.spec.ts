import * as fs from 'fs';
import * as path from 'path';
import {
  computeOlRankingsByRound,
  fetchLeagueResults,
  parseLeagueGames,
  type LeagueGame,
} from './season-rankings';

const OL = 465;

// Résultats réels de la Ligue 1 2026-27 (J1 à J9) lus chez 365scores le 01-11-2026. Les 18 scores de la
// J1 et de la J2 ont été recoupés le même jour avec psg.fr (pages « Les résultats de la 1re / 2e journée de
// Ligue 1 2026-2027 », qui reprend les scores de la LFP) : identiques, voir le test « J1-J2 ». L'écart avec
// la référence de Sylvain et Sofascore (Lyon 3e à la J2) ne vient donc pas des données.
const real = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../../../test/fixtures/ligue1-2026-results-j1-j9.json'), 'utf-8'),
) as { games: unknown[] };
const realGames = parseLeagueGames(real.games, 94);

const game = (
  roundNum: number,
  home: [number, number],
  away: [number, number],
  statusGroup = 4,
): LeagueGame => ({ roundNum, statusGroup, home: { id: home[0], score: home[1] }, away: { id: away[0], score: away[1] } });

describe('computeOlRankingsByRound — classement à la fin de chaque journée (L241)', () => {
  it("lit 79 matchs joués dans les résultats réels (J9 : 7 sur 9, 2 pas encore joués)", () => {
    expect(realGames).toHaveLength(79);
  });

  it("résultats réels J1–J9 : la position de l'OL est celle du classement recalculé, OL 1er à l'issue de la J7", () => {
    const rankings = computeOlRankingsByRound(realGames, OL);
    expect(rankings.map((r) => [r.matchday, r.position, r.points])).toEqual([
      [1, 3, 3],
      [2, 4, 4],
      [3, 2, 7],
      [4, 4, 8],
      [5, 2, 11],
      [6, 4, 11],
      [7, 1, 14],
      [8, 5, 14],
      [9, 3, 17],
    ]);
  });

  it("J7 réelle : l'OL est 1er à 14 points devant Monaco, Lille, PSG et Paris FC à 14 — départage à la différence de buts (+8)", () => {
    const j7 = computeOlRankingsByRound(realGames, OL).find((r) => r.matchday === 7);
    expect(j7).toEqual({ matchday: 7, position: 1, points: 14 });
  });

  it("J1-J2 : les 18 scores de la fixture sont ceux de psg.fr (seconde source, relevée le 01-11-2026)", () => {
    const psgFr = [
      '1 Olympique de Marseille 4-0 Strasbourg', '1 Lens 5-2 Auxerre', '1 Toulouse 0-2 Lyon',
      '1 OGC Nice 0-0 Lorient', '1 Troyes 0-0 Paris FC', '1 Le Mans 2-2 Brest', '1 Angers 0-2 Lille',
      '1 Le Havre 0-1 Monaco', '1 Rennes 2-2 PSG', '2 Lille 2-2 PSG', '2 Strasbourg 2-1 Lens',
      '2 Auxerre 1-3 Angers', '2 Brest 2-2 Toulouse', '2 Lorient 1-2 Troyes', '2 Lyon 1-1 Le Havre',
      '2 Paris FC 3-0 OGC Nice', '2 Rennes 3-2 Le Mans', '2 Monaco 2-0 Olympique de Marseille',
    ];
    type Raw = { roundNum: number; homeCompetitor: { name: string; score: number }; awayCompetitor: { name: string; score: number } };
    const fixture = (real.games as Raw[])
      .filter((g) => g.roundNum <= 2)
      .map((g) => `${g.roundNum} ${g.homeCompetitor.name} ${g.homeCompetitor.score}-${g.awayCompetitor.score} ${g.awayCompetitor.name}`);
    expect(fixture.sort()).toEqual([...psgFr].sort());
  });

  it("J2 réelle : Lyon et Lille (4 pts, +2, sans confrontation directe) se départagent aux buts marqués, Lille 4 contre 3 : Lyon est 4e", () => {
    const j2 = computeOlRankingsByRound(realGames, OL).find((r) => r.matchday === 2);
    expect(j2).toEqual({ matchday: 2, position: 4, points: 4 });
  });

  it("critère 2 : à points égaux, la meilleure différence de buts passe devant", () => {
    const games = [game(1, [1, 2], [2, 0]), game(1, [3, 3], [4, 0]), game(1, [5, 1], [6, 0])]; // +2, +3, +1
    expect(computeOlRankingsByRound(games, 1)).toEqual([{ matchday: 1, position: 2, points: 3 }]);
    expect(computeOlRankingsByRound(games, 3)).toEqual([{ matchday: 1, position: 1, points: 3 }]);
    expect(computeOlRankingsByRound(games, 5)).toEqual([{ matchday: 1, position: 3, points: 3 }]);
  });

  const placeOf = (games: LeagueGame[], id: number) => computeOlRankingsByRound(games, id)[0].position;

  it("critère 3 : à points et différence égaux, le match direct passe avant les buts marqués", () => {
    const games = [
      game(1, [10, 1], [20, 0]), // A (10) bat B (20) en direct
      game(1, [10, 0], [30, 1]), // A : 3 pts, 0, 1 but marqué
      game(1, [20, 4], [40, 3]), // B : 3 pts, 0, 4 buts marqués — devant A sans le match direct
    ];
    expect(placeOf(games, 10)).toBe(2); // derrière le seul club 30 (+1)
    expect(placeOf(games, 20)).toBe(3);
  });

  it("critère 3 : les matchs contre un club hors du groupe à égalité ne comptent pas en confrontation directe", () => {
    const games = [
      game(1, [10, 1], [30, 0]), // A bat C (hors groupe : C est 0 pt)
      game(1, [10, 0], [31, 1]), // A : 3 pts, 0, 1 but
      game(1, [20, 4], [40, 3]), // B : 4 buts marqués
      game(1, [20, 0], [41, 1]), // B : 3 pts, 0, 4 buts
    ];
    expect(placeOf(games, 20)).toBeLessThan(placeOf(games, 10)); // aucun match A-B, victoire de A sur C sans effet : B a la meilleure attaque
  });

  it("critère 4 : sans confrontation directe, la meilleure attaque départage (J2 réelle)", () => {
    const games = [game(1, [10, 3], [11, 1]), game(1, [20, 4], [21, 2])]; // 10 et 20 : 3 pts, +2
    expect(computeOlRankingsByRound(games, 10)).toEqual([{ matchday: 1, position: 2, points: 3 }]);
    expect(computeOlRankingsByRound(games, 20)).toEqual([{ matchday: 1, position: 1, points: 3 }]);
  });

  it("critère 5 : à buts marqués égaux, le plus de victoires passe devant", () => {
    const games = [
      game(1, [10, 2], [11, 0]), game(1, [10, 0], [12, 2]), // A : V + D, 3 pts, 0, 2 buts, 1 victoire
      game(1, [20, 1], [21, 1]), game(1, [20, 1], [22, 1]), game(1, [20, 0], [23, 0]), // B : 3 nuls, 3 pts, 0, 2 buts
    ];
    expect(placeOf(games, 10)).toBe(2); // derrière 12 (+2)
    expect(placeOf(games, 20)).toBe(3);
  });

  it("critère 6 : à victoires égales, la victoire à l'extérieur passe devant", () => {
    const games = [
      game(1, [11, 0], [10, 2]), game(1, [10, 0], [12, 2]), // A : victoire à l'extérieur
      game(1, [20, 2], [21, 0]), game(1, [22, 2], [20, 0]), // B : victoire à domicile
    ];
    expect(placeOf(games, 10)).toBe(3); // derrière 12 et 22 (+2)
    expect(placeOf(games, 20)).toBe(4);
  });

  it("à égalité totale, les clubs partagent la meilleure place, sans dépendre de l'ordre des matchs", () => {
    const a = [game(1, [OL, 1], [2, 0]), game(1, [3, 1], [4, 0])];
    const b = [...a].reverse();
    expect(computeOlRankingsByRound(a, OL)).toEqual([{ matchday: 1, position: 1, points: 3 }]);
    expect(computeOlRankingsByRound(b, OL)).toEqual([{ matchday: 1, position: 1, points: 3 }]);
    expect(computeOlRankingsByRound(a, 3)).toEqual([{ matchday: 1, position: 1, points: 3 }]);
  });

  it("les matchs d'une journée plus tardive n'entrent pas dans le classement d'une journée antérieure", () => {
    const games = [game(1, [OL, 0], [2, 1]), game(2, [3, 0], [4, 5]), game(2, [OL, 4], [3, 0])];
    const r = computeOlRankingsByRound(games, OL);
    expect(r[0]).toEqual({ matchday: 1, position: 2, points: 0 });
    expect(r[1].matchday).toBe(2);
  });

  it("match décalé de l'OL (pas joué) : pas de point pour cette journée, la suivante est tracée", () => {
    const games = [
      game(1, [OL, 1], [2, 0]),
      game(2, [OL, 0], [3, 0], 1), // reporté : statusGroup ≠ 4
      game(2, [4, 1], [5, 0]),
      game(3, [OL, 2], [6, 0]),
    ];
    expect(computeOlRankingsByRound(games, OL).map((r) => r.matchday)).toEqual([1, 3]);
  });

  it("journée en retard d'un autre club : son match rejoué plus tard compte dans la journée d'origine (roundNum)", () => {
    const games = [game(1, [OL, 0], [2, 0]), game(1, [3, 0], [4, 2]), game(2, [OL, 1], [5, 0])];
    const r = computeOlRankingsByRound(games, OL);
    // J1 : le 4 (3 pts) devance l'OL ; J2 : l'OL (4 pts) passe devant.
    expect(r).toEqual([
      { matchday: 1, position: 2, points: 1 },
      { matchday: 2, position: 1, points: 4 },
    ]);
  });

  it("aucun match : liste vide", () => {
    expect(computeOlRankingsByRound([], OL)).toEqual([]);
  });

  it("l'OL absent des résultats : liste vide", () => {
    expect(computeOlRankingsByRound([game(1, [2, 1], [3, 0])], OL)).toEqual([]);
  });
});

describe('parseLeagueGames', () => {
  it("écarte une autre saison, un match non terminé, un score absent et une charge qui n'est pas un match", () => {
    const raw = [
      { seasonNum: 94, roundNum: 1, statusGroup: 4, homeCompetitor: { id: 1, score: 2 }, awayCompetitor: { id: 2, score: 0 } },
      { seasonNum: 93, roundNum: 1, statusGroup: 4, homeCompetitor: { id: 1, score: 2 }, awayCompetitor: { id: 2, score: 0 } },
      { seasonNum: 94, roundNum: 2, statusGroup: 2, homeCompetitor: { id: 1, score: 1 }, awayCompetitor: { id: 2, score: 0 } },
      { seasonNum: 94, roundNum: 3, statusGroup: 4, homeCompetitor: { id: 1 }, awayCompetitor: { id: 2, score: 0 } },
      { seasonNum: 94, roundNum: 4, statusGroup: 4, homeCompetitor: { id: 1, score: -1 }, awayCompetitor: { id: 2, score: 0 } },
      { seasonNum: 94, statusGroup: 4, homeCompetitor: { id: 1, score: 1 }, awayCompetitor: { id: 2, score: 0 } },
      null,
      'x',
    ];
    expect(parseLeagueGames(raw, 94)).toEqual([game(1, [1, 2], [2, 0])]);
  });

  it("une charge qui n'est pas une liste donne une liste vide", () => {
    expect(parseLeagueGames(undefined, 94)).toEqual([]);
  });
});

describe('fetchLeagueResults — pages de résultats de la Ligue 1', () => {
  const page = (games: unknown[], previous?: string) =>
    new Response(JSON.stringify({ games, paging: previous ? { previousPage: previous } : {} }), { status: 200 });
  const raw = (id: number, roundNum: number) => ({
    id, seasonNum: 94, roundNum, statusGroup: 4,
    homeCompetitor: { id: 1, score: 1 }, awayCompetitor: { id: 2, score: 0 },
  });

  it("suit previousPage jusqu'à la journée 1 et rend tous les matchs", async () => {
    const urls: string[] = [];
    const pages: Record<string, Response> = {
      first: page([raw(3, 3)], '/p2'),
      '/p2': page([raw(2, 2)], '/p1'),
      '/p1': page([raw(1, 1)], '/never'),
    };
    const fetcher = jest.fn(async (u: string) => {
      urls.push(u);
      return u.includes('/web/games/results/') ? pages.first : pages[u.replace('https://webws.365scores.com', '')];
    });
    const games = await fetchLeagueResults(fetcher as never, 94, 35);
    expect(games?.map((g) => g.roundNum).sort()).toEqual([1, 2, 3]);
    expect(urls).toHaveLength(3);
    expect(urls[0]).toContain('competitions=35');
  });

  it("s'arrête quand une page n'apporte aucun match nouveau (pas de boucle)", async () => {
    const fetcher = jest.fn(async () => page([raw(5, 5)], '/p'));
    const games = await fetchLeagueResults(fetcher as never, 94, 35);
    expect(games).toHaveLength(1);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("un HTTP en échec rend null : le tracé existant est conservé par l'appelant", async () => {
    const fetcher = jest.fn(async () => new Response('', { status: 503 }));
    expect(await fetchLeagueResults(fetcher as never, 94, 35)).toBeNull();
  });

  it("une erreur réseau rend null", async () => {
    const fetcher = jest.fn(async () => {
      throw new Error('boom');
    });
    expect(await fetchLeagueResults(fetcher as never, 94, 35)).toBeNull();
  });

  it("une enveloppe sans match rend null (jamais une liste vide qui effacerait le tracé)", async () => {
    const fetcher = jest.fn(async () => page([]));
    expect(await fetchLeagueResults(fetcher as never, 94, 35)).toBeNull();
  });
});
