import { describe, expect, it } from 'vitest';
import { standingsWithoutLive } from './standings-without-live';
import { OL_365SCORES_ID, type LiveMatchSummary, type SeasonMatch, type StandingEntry } from '@/types/api';

const ol: StandingEntry = {
  position: 2, team: 'Olympique Lyonnais', teamId: 523, played: 6, won: 3, draw: 2, lost: 1,
  goalsFor: 9, goalsAgainst: 6, goalDifference: 3, points: 11,
};

function live(over: Partial<LiveMatchSummary> & { olScore?: number | null; adv?: number | null; olHome?: boolean } = {}): LiveMatchSummary {
  const { olScore = 0, adv = 1, olHome = false, ...rest } = over;
  const olSide = { id: OL_365SCORES_ID, name: 'Lyon', symbolicName: 'LYO', imageVersion: 1, score: olScore };
  const other = { id: 7, name: 'Lens', symbolicName: 'LEN', imageVersion: 1, score: adv };
  return {
    gameId: 1, matchupId: 'm', competitionId: 35, competitionName: 'France, Ligue 1', status: 'live',
    statusGroup: 3, statusText: '2e mi-temps', gameTime: 56, gameTimeDisplay: '56', startTime: '2026-10-30T19:00:00Z',
    home: olHome ? olSide : other, away: olHome ? other : olSide, ...rest,
  };
}

function fini(home: boolean, pour: number, contre: number, over: Partial<SeasonMatch> = {}): SeasonMatch {
  return {
    id: 1, date: '2026-09-01T19:00:00Z', homeTeam: 'A', homeTeamId: home ? 523 : 7, awayTeam: 'B', awayTeamId: home ? 7 : 523,
    homeScore: home ? pour : contre, awayScore: home ? contre : pour, competition: 'Ligue 1', status: 'FINISHED', matchday: 1,
    competitionCode: 'L1', competitionId: 35, ...over,
  };
}
// 5 matchs terminés : 3V 2N 0D, 9 buts pour, 5 contre, 11 points (la ligne `ol` compte en plus le match en cours)
const termines = [fini(true, 2, 0), fini(false, 3, 1), fini(true, 1, 0), fini(true, 1, 1), fini(false, 2, 2)];

describe('standingsWithoutLive — L86', () => {
  it('R1 — la ligne compte le match en cours : le bilan est celui des matchs terminés, le résultat du direct n’y est pas lu', () => {
    for (const [olScore, adv] of [[0, 1], [1, 0], [1, 1]]) {
      expect(standingsWithoutLive(ol, live({ olScore, adv }), termines)).toMatchObject({
        played: 5, won: 3, draw: 2, lost: 0, goalsFor: 9, goalsAgainst: 4, goalDifference: 5, points: 11,
      });
    }
  });
  it('R2 — classement plus ancien que le direct (la ligne ne compte pas encore le match) : rien n’est retiré', () => {
    const avant = { ...ol, played: 5 };
    expect(standingsWithoutLive(avant, live(), termines)).toBe(avant);
  });
  it('R2 — classement lu à 0-0 puis but de l’OL : le nul compté dans la ligne ne reste pas dans le bilan', () => {
    expect(standingsWithoutLive({ ...ol, draw: 3, won: 2, points: 9 }, live({ olScore: 1, adv: 0 }), termines)).toMatchObject({
      played: 5, won: 3, draw: 2, points: 11,
    });
  });
  it('R3 — rien à refaire : match non en cours, autre compétition, liste de la saison absente, écart autre que 1', () => {
    for (const [l, m] of [
      [null, termines], [undefined, termines],
      [live({ status: 'ended' }), termines], [live({ status: 'upcoming' }), termines], [live({ competitionId: 37 }), termines],
      [live(), undefined], [live(), termines.slice(1)], [live(), []],
    ] as [LiveMatchSummary | null | undefined, SeasonMatch[] | undefined][]) {
      expect(standingsWithoutLive(ol, l, m)).toBe(ol);
    }
  });
  it('R3 — seuls comptent les matchs de Ligue 1 terminés de l’OL', () => {
    const bruit = [
      fini(true, 5, 0, { competitionId: 37, competitionCode: 'CDF' as SeasonMatch['competitionCode'] }),
      fini(true, 0, 0, { status: 'SCHEDULED', homeScore: null, awayScore: null }),
      fini(true, 0, 0, { homeTeamId: 8, awayTeamId: 9 }),
    ];
    expect(standingsWithoutLive(ol, live(), [...termines, ...bruit])).toMatchObject({ played: 5, points: 11 });
  });
  it('R4 — sans l’OL dans le classement, rien n’est calculé', () => {
    expect(standingsWithoutLive(undefined, live(), termines)).toBeUndefined();
  });
});
