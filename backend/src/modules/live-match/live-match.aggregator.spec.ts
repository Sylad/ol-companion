import * as fs from 'fs';
import * as path from 'path';
import { aggregate, deriveSecondYellowReds, parseStatValue, summarize } from './live-match.aggregator';
import type { LiveMatchTimelineEvent } from './live-match.types';

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
