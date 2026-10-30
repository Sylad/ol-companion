import { describe, expect, it } from 'vitest';
import { standingsWithoutLive } from './standings-without-live';
import { OL_365SCORES_ID, type LiveMatchSummary, type StandingEntry } from '@/types/api';

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

describe('standingsWithoutLive — L86', () => {
  it('R1 — un match de Ligue 1 en cours, perdu à cet instant, n’est compté ni joué ni perdu', () => {
    expect(standingsWithoutLive(ol, live({ olScore: 0, adv: 1 }))).toMatchObject({
      played: 5, won: 3, draw: 2, lost: 0, points: 11, goalsFor: 9, goalsAgainst: 5, goalDifference: 4,
    });
  });
  it('R2 — mené, gagné ou nul à cet instant : le bon résultat est retiré, buts et points compris', () => {
    expect(standingsWithoutLive(ol, live({ olScore: 2, adv: 0, olHome: true }))).toMatchObject({
      played: 5, won: 2, points: 8, goalsFor: 7, goalsAgainst: 6, goalDifference: 1,
    });
    expect(standingsWithoutLive(ol, live({ olScore: 1, adv: 1 }))).toMatchObject({
      played: 5, draw: 1, points: 10, goalsFor: 8, goalsAgainst: 5,
    });
  });
  it('R3 — rien à retirer : match terminé, à venir, autre compétition, OL absent ou score inconnu', () => {
    for (const l of [
      null, undefined,
      live({ status: 'ended' }), live({ status: 'upcoming' }), live({ competitionId: 37 }),
      live({ olScore: null }), live({ adv: null }),
      { ...live(), home: { ...live().home, id: 8 }, away: { ...live().away, id: 9 } },
    ]) {
      expect(standingsWithoutLive(ol, l as LiveMatchSummary | null | undefined)).toBe(ol);
    }
  });
  it('R4 — sans l’OL dans le classement, rien n’est calculé ; le total joué ne descend jamais sous 0', () => {
    expect(standingsWithoutLive(undefined, live())).toBeUndefined();
    const vide = { ...ol, played: 0, won: 0, draw: 0, lost: 0, points: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0 };
    expect(standingsWithoutLive(vide, live())).toBe(vide);
  });
});
