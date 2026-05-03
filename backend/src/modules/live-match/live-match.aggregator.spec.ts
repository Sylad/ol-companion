import * as fs from 'fs';
import * as path from 'path';
import { aggregate, parseStatValue, summarize } from './live-match.aggregator';

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
