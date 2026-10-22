import * as fs from 'fs';
import * as path from 'path';
import { aggregate, deriveSecondYellowReds, parseStatValue, summarize } from './live-match.aggregator';
import type { LiveMatchTimelineEvent } from './live-match.types';
import { Scores365GameDetailResponseSchema } from '../../config/scores365-game.schema';
import { parseExternal } from '../../common/zod-validation.pipe';

const fixture = JSON.parse(
  fs.readFileSync(
    path.resolve(__dirname, '../../../test/fixtures/365_game_lyon_rennes_live.json'),
    'utf-8',
  ),
);

describe('parseStatValue', () => {
  it.each([
    ['5', 5],
    [5, 5],
    ["12'", 12],
    ['4/8', 4],
    ['70%', 70],
    ['', 0],
    [null, 0],
    [undefined, 0],
    ['abc', 0],
  ])('parses %p → %p', (input, expected) => {
    expect(parseStatValue(input as any)).toBe(expected);
  });
});

describe('summarize', () => {
  it('extracts core fields from a 365scores game', () => {
    const s = summarize(fixture.game);
    expect(s.gameId).toBe(4463860);
    expect(s.matchupId).toBe('465-477-4463860');
    expect(s.competitionId).toBe(35);
    expect(s.home.id).toBe(465);
    expect(s.home.name).toBe('Lyon');
    expect(s.away.id).toBe(477);
    expect(s.away.name).toBe('Rennes');
    expect(s.status).toBe('live');
    expect(s.statusText).toContain('Première');
  });
});

describe('summarize — score avant le coup d\'envoi', () => {
  it('ramène le -1 de 365scores à null (sinon -2 → 0 au coup d\'envoi passe pour un but)', () => {
    const game = JSON.parse(JSON.stringify(fixture.game));
    game.homeCompetitor.score = -1;
    game.awayCompetitor.score = -1;
    const s = summarize(game);
    expect(s.home.score).toBeNull();
    expect(s.away.score).toBeNull();
  });
});

describe('aggregate (full payload)', () => {
  const result = aggregate(fixture);

  it('produces a payload with summary + stats + events + shots + topPerformers', () => {
    expect(result.gameId).toBe(4463860);
    expect(result.status).toBe('live');
    expect(result.events.length).toBeGreaterThan(0);
    expect(result.shots.length).toBeGreaterThan(0);
    expect(result.topPerformers.length).toBeGreaterThan(0);
  });

  it('aggregates per-player stats into team totals (Lyon-Rennes early fixture)', () => {
    // Lyon dominated possession early, Rennes scored: home should outscore away on passes/touches.
    expect(result.teamStats.home['Tirs au total']).toBeGreaterThanOrEqual(3);
    expect(result.teamStats.away['Tirs au total']).toBeGreaterThanOrEqual(1);
    expect(result.teamStats.home['Touches']).toBeGreaterThan(result.teamStats.away['Touches']);
    expect(result.teamStats.home['Passes Completed']).toBeGreaterThan(result.teamStats.away['Passes Completed']);
    // Goal scored against Lyon
    expect(result.teamStats.home['Buts encaissés']).toBe(1);
    expect(result.teamStats.away['Buts']).toBe(1);
  });

  it('extracts a goal in the events timeline (Rennes scored at 6\')', () => {
    const goals = result.events.filter((e) => e.type === 'goal');
    expect(goals.length).toBeGreaterThanOrEqual(1);
    const rennesGoal = goals.find((e) => e.competitorId === 477);
    expect(rennesGoal).toBeDefined();
    expect(rennesGoal!.gameTime).toBeCloseTo(6, 0);
  });

  it('extracts shot chart with xG values + outcomes', () => {
    expect(result.shots.length).toBeGreaterThanOrEqual(4);
    const goal = result.shots.find((s) => s.outcome === 'But');
    expect(goal).toBeDefined();
    expect(goal!.xg).toBeGreaterThan(0);
  });

  it('returns top performers per role with id and statValue', () => {
    expect(result.topPerformers.length).toBeGreaterThanOrEqual(3);
    const tp = result.topPerformers[0];
    expect(tp.role).toBeTruthy();
    expect(tp.homePlayer).toBeDefined();
    expect(tp.awayPlayer).toBeDefined();
  });

  it('throws when payload is missing the game wrapper', () => {
    expect(() => aggregate({})).toThrow(/Missing game/);
  });
});

describe('deriveSecondYellowReds (FIFA rule: 2 yellows → red)', () => {
  const yellow = (playerId: number, gameTime: number, competitorId = 477): LiveMatchTimelineEvent => ({
    competitorId,
    gameTime,
    gameTimeDisplay: `${gameTime}'`,
    type: 'yellow_card',
    isMajor: true,
    playerId,
    extraPlayerId: null,
    playerName: null,
    playerShortName: null,
    extraPlayerName: null,
    description: 'Carton jaune',
  });

  it('synthesizes a second_yellow_red event when a player gets 2 yellows', () => {
    const events: LiveMatchTimelineEvent[] = [
      yellow(1001, 26),
      yellow(1001, 57),
      yellow(2002, 44), // unrelated 2nd player, only 1 yellow
    ];
    const out = deriveSecondYellowReds(events);
    expect(out).toHaveLength(4); // 3 original + 1 derived
    const derived = out.filter((e) => e.derived);
    expect(derived).toHaveLength(1);
    expect(derived[0]).toMatchObject({
      type: 'second_yellow_red',
      playerId: 1001,
      gameTime: 57,
      derived: true,
      isMajor: true,
    });
    // Derived event sits right after its triggering yellow (same minute).
    const idx57 = out.findIndex((e) => e.gameTime === 57 && e.type === 'yellow_card');
    expect(out[idx57 + 1].derived).toBe(true);
  });

  it('does NOT synthesize when 365scores already emits second_yellow_red for same player', () => {
    const events: LiveMatchTimelineEvent[] = [
      yellow(1001, 26),
      yellow(1001, 57),
      {
        competitorId: 477,
        gameTime: 57,
        gameTimeDisplay: "57'",
        type: 'second_yellow_red',
        isMajor: true,
        playerId: 1001,
        extraPlayerId: null,
        playerName: null,
        playerShortName: null,
        extraPlayerName: null,
        description: '2e jaune',
      },
    ];
    const out = deriveSecondYellowReds(events);
    expect(out).toHaveLength(3); // no duplicate
    expect(out.filter((e) => e.derived).length).toBe(0);
  });

  it('does NOT synthesize for 2 yellows on different players', () => {
    const events: LiveMatchTimelineEvent[] = [
      yellow(1001, 26),
      yellow(2002, 44),
      yellow(3003, 70),
    ];
    const out = deriveSecondYellowReds(events);
    expect(out).toEqual(events); // unchanged
  });

  it('handles 3+ yellow cards on the same player without emitting twice', () => {
    // Defensive: if 365scores fluke-emits 3 yellows for the same player,
    // we still only synthesize the red on the 2nd, not on the 3rd.
    const events: LiveMatchTimelineEvent[] = [
      yellow(1001, 10),
      yellow(1001, 50),
      yellow(1001, 80), // unlikely but defensive
    ];
    const out = deriveSecondYellowReds(events);
    const derived = out.filter((e) => e.derived);
    expect(derived).toHaveLength(1);
    expect(derived[0].gameTime).toBe(50);
  });
});

describe('schéma détail de match — tolérance aux pseudo-membres 365scores', () => {
  // 16/09/2026 Anderlecht-Lyon : `game.members[54] = { competitorId, name: 'But annulé' }`
  // sans `id`. Le schéma strict rejetait tout le payload → page /match vide
  // pendant 6 min en 2e mi-temps puis 1 h après le match (335 erreurs).
  const raw = JSON.parse(
    fs.readFileSync(
      path.resolve(__dirname, '../../../test/fixtures/365_game_anderlecht_lyon_ended_member_without_id.json'),
      'utf-8',
    ),
  );

  it('accepte le payload et agrège les stats malgré un membre sans id', () => {
    const parsed = parseExternal(Scores365GameDetailResponseSchema, raw, 'test');
    const payload = aggregate(parsed);
    expect(payload.status).toBe('ended');
    expect(payload.home.score).toBe(1);
    expect(payload.away.score).toBe(2);
    expect(payload.events.some((e) => e.type === 'goal')).toBe(true);
  });
});

describe('toLineups — compositions des deux équipes depuis le détail live', () => {
  const payload = aggregate(fixture);

  it('expose formation, 11 titulaires triés gardien → attaque, et le banc, pour chaque équipe', () => {
    expect(payload.lineups?.home.formation).toBe('4-2-3-1');
    expect(payload.lineups?.away.formation).toBe('4-4-2');
    for (const side of ['home', 'away'] as const) {
      const l = payload.lineups![side];
      expect(l.starters).toHaveLength(11);
      expect(l.starters[0].yardLine).toBe(1);
      expect(l.starters.every((p, i, a) => i === 0 || a[i - 1].yardLine <= p.yardLine)).toBe(true);
      expect(l.bench.length).toBeGreaterThan(0);
    }
  });

  it('résout nom, nom court et numéro depuis game.members[]', () => {
    const gk = payload.lineups!.home.starters[0];
    expect(gk).toMatchObject({ id: 844534, name: 'Dominik Greif', shortName: 'Greif', jerseyNumber: 1, positionShort: 'GK' });
  });

  it('L209 — expose l\'athleteId du joueur (celui de /api/players et de la route /player), distinct de l\'id de membre', () => {
    const g = JSON.parse(JSON.stringify(fixture));
    const id = g.game.homeCompetitor.lineups.members.find((m: any) => m.status === 1).id;
    g.game.members.find((m: any) => m.id === id).athleteId = 133157;
    const home = aggregate(g).lineups!.home;
    const p = [...home.starters, ...home.bench].find((x) => x.id === id)!;
    expect(p.athleteId).toBe(133157);
    expect(p.id).toBe(id);
  });

  it('exclut absents (status 3) et staff (status 4)', () => {
    const all = [...payload.lineups!.home.starters, ...payload.lineups!.home.bench];
    expect(all.length).toBeLessThan(24);
    expect(all.some((p) => p.name === 'Dominik Greif')).toBe(true);
  });

  it('sans lineups dans le payload → undefined, pas d\'erreur', () => {
    const stripped = JSON.parse(JSON.stringify(fixture));
    delete stripped.game.homeCompetitor.lineups;
    delete stripped.game.awayCompetitor.lineups;
    expect(aggregate(stripped).lineups).toBeUndefined();
  });
});

describe('toLineups — match à venir (L129)', () => {
  const clone = () => JSON.parse(JSON.stringify(fixture));

  it('« Confirmé » : composition non probable', () => {
    expect(aggregate(fixture).lineups?.home.probable).toBe(false);
  });

  it('match à venir dont la source ne dit pas « Confirmé » : composition probable', () => {
    const g = clone();
    g.game.statusGroup = 1;
    g.game.homeCompetitor.lineups.status = 'Probable';
    delete g.game.awayCompetitor.lineups.status;
    const l = aggregate(g).lineups!;
    expect(l.home.probable).toBe(true);
    expect(l.away.probable).toBe(true);
  });

  it('match à venir « Confirmé » : pas probable ; match terminé sans statut : pas probable', () => {
    const g = clone();
    g.game.statusGroup = 1;
    expect(aggregate(g).lineups!.home.probable).toBe(false);
    g.game.statusGroup = 4;
    delete g.game.homeCompetitor.lineups.status;
    expect(aggregate(g).lineups!.home.probable).toBe(false);
  });

  it('numéro de maillot 0 (valeur de remplissage) : null', () => {
    const g = clone();
    const id = g.game.homeCompetitor.lineups.members.find((m: any) => m.status === 1).id;
    g.game.members.find((m: any) => m.id === id).jerseyNumber = 0;
    const home = aggregate(g).lineups!.home;
    const p = [...home.starters, ...home.bench].find((x) => x.id === id)!;
    expect(p.jerseyNumber).toBeNull();
  });

  it('charge réelle 365scores (Lyon – Crystal Palace, 15/10, gameId 4828743, composition « NotConfirmed »)', () => {
    const real = JSON.parse(
      fs.readFileSync(
        path.resolve(__dirname, '../../../test/fixtures/365_game_lyon_crystal_palace_upcoming_not_confirmed.json'),
        'utf-8',
      ),
    );
    // Les deux compositions sont annoncées « NotConfirmed » alors que le match est à venir (statusGroup 2).
    expect(real.game.homeCompetitor.lineups.status).toBe('NotConfirmed');
    expect(real.game.awayCompetitor.lineups.status).toBe('NotConfirmed');
    const lineups = aggregate(real).lineups!;
    expect(lineups.home.probable).toBe(true);
    expect(lineups.away.probable).toBe(true);

    // Dans cette charge, 7 des titulaires/remplaçants (1 Lyon, 6 Crystal Palace) ont le numéro de remplissage 0.
    const players = [lineups.home, lineups.away].flatMap((t) => [...t.starters, ...t.bench]);
    expect(players.length).toBeGreaterThan(40);
    expect(players.filter((p) => p.jerseyNumber === 0)).toEqual([]);
    expect(players.every((p) => p.jerseyNumber === null || p.jerseyNumber > 0)).toBe(true);
    const unnumbered = [4941908, 50752231, 75420191, 79316114, 1287557, 79291971, 64741566];
    for (const id of unnumbered) expect(players.find((p) => p.id === id)!.jerseyNumber).toBeNull();
    // Les numéros réels, eux, restent affichés (Šulc, n° 10).
    expect(players.find((p) => p.id === 42213317)!.jerseyNumber).toBe(10);
  });
});

describe('événements — noms des joueurs résolus depuis game.members[]', () => {
  const payload = aggregate(fixture);

  it('le but de Rennes à la 6e porte le nom du buteur', () => {
    const goal = payload.events.find((e) => e.type === 'goal')!;
    expect(goal.gameTimeDisplay).toBe("6'");
    expect(goal.playerName).toBeTruthy();
    expect(goal.playerName).not.toMatch(/^Joueur/);
    expect(goal.playerShortName).toBe('Tamari');
  });

  it('un événement dont le joueur est inconnu garde playerName null', () => {
    const stripped = JSON.parse(JSON.stringify(fixture));
    stripped.game.members = [];
    const goal = aggregate(stripped).events.find((e) => e.type === 'goal')!;
    expect(goal.playerName).toBeNull();
  });
});

describe('R7/R11 (L168) — timeConfirmed de la réponse stats, même règle que /api/france', () => {
  const NOW = new Date('2026-10-17T12:00:00Z');
  // La fixture est un match de Ligue Europa (suivie, donc fixée : L172) : les Bleus ne le sont pas.
  const startIn = (ms: number) => ({ ...fixture.game, competitionId: 5930, startTime: new Date(NOW.getTime() + ms).toISOString() });
  const DAY = 24 * 3600_000;

  it('R11 — un match à plus de 14 jours : timeConfirmed est faux (heure de remplissage de 365scores)', () => {
    expect(summarize(startIn(14 * DAY + 1), NOW).timeConfirmed).toBe(false);
  });

  it('R11 — un match à 14 jours pile ou moins : timeConfirmed est vrai (borne comprise)', () => {
    expect(summarize(startIn(14 * DAY), NOW).timeConfirmed).toBe(true);
    expect(summarize(startIn(2 * DAY), NOW).timeConfirmed).toBe(true);
  });

  it('R7 — un match en cours ou terminé : timeConfirmed est vrai', () => {
    expect(summarize(startIn(-2 * 3600_000), NOW).timeConfirmed).toBe(true);
  });

  it('R7 — aggregate() sert le champ dans la réponse stats', () => {
    const raw = { game: startIn(30 * DAY) } as never;
    expect(aggregate(raw).timeConfirmed).toBeDefined();
  });
});

describe('L170 — timeConfirmed d’un match de Ligue 1 à venir : football-data décide, comme /api/season-matches', () => {
  const NOW = new Date('2026-10-17T12:00:00Z');
  const DAY = 24 * 3600_000;
  const upcomingL1 = (ms: number, extra: object = {}) => ({
    ...fixture.game,
    statusGroup: 2,
    competitionId: 35,
    roundNum: 32,
    startTime: new Date(NOW.getTime() + ms).toISOString(),
    ...extra,
  });
  const said = (matchday: number, timeConfirmed: boolean) => [
    { competition: 'Ligue 1', matchday, timeConfirmed },
  ];

  it('L170/R1 — football-data date la journée de façon ferme : vrai même au-delà de 14 jours (Lyon – Angers à J+14,3)', () => {
    expect(summarize(upcomingL1(14.3 * DAY), NOW, said(32, true)).timeConfirmed).toBe(true);
  });

  it('L170/R2 — football-data dit « à confirmer » : faux même dans les 14 jours', () => {
    expect(summarize(upcomingL1(2 * DAY), NOW, said(32, false)).timeConfirmed).toBe(false);
  });

  it('L170/R3 — football-data ne parle pas de cette journée : la règle des 14 jours s’applique', () => {
    expect(summarize(upcomingL1(14.3 * DAY), NOW, said(31, true)).timeConfirmed).toBe(false);
    expect(summarize(upcomingL1(2 * DAY), NOW, said(31, false)).timeConfirmed).toBe(true);
    expect(summarize(upcomingL1(14.3 * DAY, { roundNum: undefined }), NOW, said(32, true)).timeConfirmed).toBe(false);
  });

  it('L170/R4 — un match commencé : football-data n’est pas consulté', () => {
    const live = { ...upcomingL1(-3600_000), statusGroup: 3 };
    expect(summarize(live, NOW, said(32, false)).timeConfirmed).toBe(true);
  });

  it('L170/R5 — aggregate() transmet ce que dit football-data à la réponse stats', () => {
    const raw = { game: upcomingL1(14.3 * DAY) } as never;
    expect(aggregate(raw, NOW, said(32, true)).timeConfirmed).toBe(true);
  });
});

describe('L172 — timeConfirmed d’un match à venir d’une compétition suivie : même valeur que /api/season-matches', () => {
  const NOW = new Date('2026-10-17T12:00:00Z');
  const DAY = 24 * 3600_000;
  const upcoming = (competitionId: number, ms: number) => ({
    ...fixture.game,
    statusGroup: 2,
    competitionId,
    startTime: new Date(NOW.getTime() + ms).toISOString(),
  });

  it('L172/R1 — Ligue Europa, Coupe de France, Ligue des champions (et qualifications) à plus de 14 jours : vrai (Lyon – Lillestrom)', () => {
    for (const id of [573, 37, 572, 332]) {
      expect(summarize(upcoming(id, 20 * DAY), NOW).timeConfirmed).toBe(true);
    }
  });

  it('L172/R2 — une compétition non suivie (Bleus, amical) à plus de 14 jours : faux, règle des 14 jours de /api/france', () => {
    expect(summarize(upcoming(5930, 20 * DAY), NOW).timeConfirmed).toBe(false);
    expect(summarize(upcoming(5930, 2 * DAY), NOW).timeConfirmed).toBe(true);
  });

  it('L172/R3 — un match de coupe est aligné sur season-matches quelle que soit la réponse de football-data', () => {
    const fd = [{ competition: 'Ligue 1', matchday: 32, timeConfirmed: false }];
    expect(summarize({ ...upcoming(573, 20 * DAY), roundNum: 32 }, NOW, fd).timeConfirmed).toBe(true);
  });
});

describe('faits du match — types 365scores réels (L9 t1)', () => {
  const raw = JSON.parse(
    fs.readFileSync(
      path.resolve(__dirname, '../../../test/fixtures/365_game_anderlecht_lyon_ended_member_without_id.json'),
      'utf-8',
    ),
  );
  const events = () => aggregate(parseExternal(Scores365GameDetailResponseSchema, raw, 'test')).events;

  it('type 1000 « Substitution » → substitution : entrant = playerId, sortant = extraPlayers[0], avec noms courts', () => {
    const sub = events().find((e) => e.type === 'substitution' && e.playerId === 32455478)!;
    expect(sub).toMatchObject({
      playerShortName: 'Kana',
      extraPlayerId: 65082004,
      extraPlayerName: 'Amane Romeo',
      extraPlayerShortName: 'Romeo',
    });
  });

  it('type 12 « Woodwork » → woodwork', () => {
    expect(events().some((e) => e.type === 'woodwork' && e.gameTimeDisplay === "52'")).toBe(true);
  });

  it('type 11 « But annulé — Var » → goal_cancelled', () => {
    expect(events().some((e) => e.type === 'goal_cancelled' && e.gameTimeDisplay === "53'")).toBe(true);
  });

  it('type 3 « Carton rouge » → red_card, et non plus substitution (Udol 84\', Lens – Lyon)', () => {
    const g = JSON.parse(JSON.stringify(raw));
    g.game.events.push({
      competitorId: 465, gameTime: 84, gameTimeDisplay: "84'", playerId: 32455478, isMajor: true,
      eventType: { id: 3, name: 'Carton rouge', subTypeId: -1 },
    });
    const out = aggregate(parseExternal(Scores365GameDetailResponseSchema, g, 'test')).events;
    const red = out.find((e) => e.gameTimeDisplay === "84'")!;
    expect(red.type).toBe('red_card');
  });
});
