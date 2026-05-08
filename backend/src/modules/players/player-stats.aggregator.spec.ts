import * as fs from 'fs';
import * as path from 'path';
import {
  aggregateAll,
  accumulateGame,
  finalize,
  type MatchContext,
} from './player-stats.aggregator';
import type { Scores365GameDetailed } from '../../config/scores365-game.schema';

const fixture = JSON.parse(
  fs.readFileSync(
    path.resolve(
      __dirname,
      '../../../test/fixtures/365_game_lyon_rennes_live.json',
    ),
    'utf-8',
  ),
) as { game: Scores365GameDetailed };

const ctxLyonRennes: MatchContext = {
  gameId: 4463860,
  date: '2026-05-03T20:45:00+02:00',
  opponent: 'Rennes',
  isHome: true,
  olScore: 0,
  opponentScore: 1,
  competitionCode: 'L1',
};

describe('player-stats.aggregator', () => {
  describe('accumulateGame (single OL match)', () => {
    it('produces one entry per OL starter who played', () => {
      const stats = aggregateAll([{ game: fixture.game, ctx: ctxLyonRennes }]);
      // 11 starters in the fixture, all logged minutes.
      expect(stats.length).toBeGreaterThanOrEqual(11);
      // Every player should have exactly one match in the byMatch breakdown.
      for (const p of stats) expect(p.byMatch).toHaveLength(1);
    });

    it('attaches an athleteId for every aggregated player', () => {
      const stats = aggregateAll([{ game: fixture.game, ctx: ctxLyonRennes }]);
      for (const p of stats) {
        expect(p.athleteId).toBeGreaterThan(0);
        expect(p.name).toBeTruthy();
      }
    });

    it('sums minutes from the per-match Minutes stat', () => {
      const stats = aggregateAll([{ game: fixture.game, ctx: ctxLyonRennes }]);
      // Fixture is at minute 26' so every starter sits at 26 minutes played.
      const tolisso = stats.find((p) => p.name.includes('Tolisso'));
      expect(tolisso).toBeDefined();
      expect(tolisso!.minutesPlayed).toBe(26);
      expect(tolisso!.matchesPlayed).toBe(1);
      expect(tolisso!.matchesStarted).toBe(1);
    });

    it('captures shots and shots-on-target from the lineup stats block', () => {
      const stats = aggregateAll([{ game: fixture.game, ctx: ctxLyonRennes }]);
      const totalShots = stats.reduce((s, p) => s + p.shots, 0);
      // From the live-match aggregator spec, OL had ≥3 shots total against Rennes.
      expect(totalShots).toBeGreaterThanOrEqual(3);
    });

    it('tags isStarter correctly for the 11 starters', () => {
      const stats = aggregateAll([{ game: fixture.game, ctx: ctxLyonRennes }]);
      const starters = stats.filter((p) => p.byMatch[0].isStarter);
      expect(starters).toHaveLength(11);
    });

    it('exposes goalContributions (goals + assists) and shotAccuracy', () => {
      const stats = aggregateAll([{ game: fixture.game, ctx: ctxLyonRennes }]);
      for (const p of stats) {
        expect(p.goalContributions).toBe(p.goals + p.assists);
        if (p.shots > 0) {
          expect(p.shotAccuracy).toBeCloseTo(
            (p.shotsOnTarget / p.shots) * 100,
            0,
          );
        } else {
          expect(p.shotAccuracy).toBe(0);
        }
      }
    });
  });

  describe('accumulateGame (multi-match aggregation)', () => {
    it('sums minutes / goals / assists across two replays of the same match', () => {
      // Replay the same fixture twice → totals should double.
      const stats = aggregateAll([
        { game: fixture.game, ctx: ctxLyonRennes },
        {
          game: fixture.game,
          ctx: {
            ...ctxLyonRennes,
            gameId: 4463861,
            date: '2026-05-10T20:45:00+02:00',
          },
        },
      ]);
      const tolisso = stats.find((p) => p.name.includes('Tolisso'));
      expect(tolisso).toBeDefined();
      expect(tolisso!.matchesPlayed).toBe(2);
      expect(tolisso!.minutesPlayed).toBe(52);
      expect(tolisso!.byMatch).toHaveLength(2);
      // Should be sorted ASC by date → first match comes first.
      expect(tolisso!.byMatch[0].gameId).toBe(4463860);
      expect(tolisso!.byMatch[1].gameId).toBe(4463861);
    });
  });

  describe('finalize sorting', () => {
    it('sorts by goal contributions desc then minutes desc', () => {
      const stats = aggregateAll([{ game: fixture.game, ctx: ctxLyonRennes }]);
      for (let i = 1; i < stats.length; i++) {
        const prev = stats[i - 1];
        const cur = stats[i];
        if (prev.goalContributions === cur.goalContributions) {
          expect(prev.minutesPlayed).toBeGreaterThanOrEqual(cur.minutesPlayed);
        } else {
          expect(prev.goalContributions).toBeGreaterThanOrEqual(
            cur.goalContributions,
          );
        }
      }
    });
  });

  describe('byMatch entry shape', () => {
    it('carries opponent + result derived from the context', () => {
      const stats = aggregateAll([{ game: fixture.game, ctx: ctxLyonRennes }]);
      const sample = stats[0].byMatch[0];
      expect(sample.opponent).toBe('Rennes');
      expect(sample.competitionCode).toBe('L1');
      expect(sample.result).toBe('L'); // OL 0 - 1 Rennes
      expect(sample.isHome).toBe(true);
    });
  });

  describe('manual accumulator', () => {
    it('skips players with 0 minutes (bench non-subbed)', () => {
      const acc = new Map<number, any>();
      accumulateGame(acc, fixture.game, ctxLyonRennes);
      const finalized = finalize(acc);
      // Bench non-subbed members have no Minutes stat → should NOT appear.
      // 11 starters in the fixture, so we expect exactly 11 OL players here.
      expect(finalized).toHaveLength(11);
    });
  });
});
