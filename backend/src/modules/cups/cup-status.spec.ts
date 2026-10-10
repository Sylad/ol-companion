import { isCupEliminated, STALE_DAYS } from './cup-status';
import type { CupMatch } from './cups.service';
import { OL_365SCORES_ID } from '../../config/constants';

const NOW = new Date('2026-10-10T12:00:00Z');
const DAY = 86_400_000;

function m(
  status: string,
  stageFr: string,
  o: { daysAgo?: number; ol?: number; opp?: number; home?: boolean } = {},
): CupMatch {
  const home = o.home ?? true;
  const ol = o.ol ?? null;
  const opp = o.opp ?? null;
  return {
    id: Math.random(),
    date: new Date(NOW.getTime() - (o.daysAgo ?? 3) * DAY).toISOString(),
    homeTeam: 'A', homeTeamId: home ? OL_365SCORES_ID : 7,
    awayTeam: 'B', awayTeamId: home ? 7 : OL_365SCORES_ID,
    homeScore: home ? ol : opp, awayScore: home ? opp : ol,
    status, stage: stageFr, stageFr,
  };
}

describe('isCupEliminated', () => {
  it('aucun match joué = pas éliminé', () => {
    expect(isCupEliminated([], NOW)).toBe(false);
  });

  it('un match à venir = en lice', () => {
    expect(isCupEliminated([m('FINISHED', 'Tour 3', { ol: 0, opp: 1 }), m('SCHEDULED', 'Tour 4')], NOW)).toBe(false);
  });

  it('matchs à venir inconnus (appel en échec) = jamais éliminé, même sur une défaite', () => {
    expect(isCupEliminated([m('FINISHED', '32ème de finale', { ol: 0, opp: 1 })], NOW, false)).toBe(false);
  });

  it('dernière confrontation perdue, rien à venir = éliminé', () => {
    expect(isCupEliminated([m('FINISHED', '32ème de finale', { ol: 0, opp: 1 })], NOW)).toBe(true);
  });

  it('élimination à l\'extérieur : le score est lu du côté de l\'OL', () => {
    expect(isCupEliminated([m('FINISHED', 'Barrages', { ol: 0, opp: 2, home: false })], NOW)).toBe(true);
  });

  it('aller-retour perdu au cumul = éliminé ; gagné au cumul = en lice', () => {
    const lost = [
      m('FINISHED', 'Barrages', { daysAgo: 10, ol: 2, opp: 0 }),
      m('FINISHED', 'Barrages', { daysAgo: 3, ol: 0, opp: 3, home: false }),
    ];
    const won = [
      m('FINISHED', 'Barrages', { daysAgo: 10, ol: 2, opp: 0 }),
      m('FINISHED', 'Barrages', { daysAgo: 3, ol: 0, opp: 1, home: false }),
    ];
    expect(isCupEliminated(lost, NOW)).toBe(true);
    expect(isCupEliminated(won, NOW)).toBe(false);
  });

  it('tour gagné, tirage du suivant pas encore publié = en lice', () => {
    expect(isCupEliminated([m('FINISHED', '32ème de finale', { ol: 2, opp: 0 })], NOW)).toBe(false);
  });

  it('phase de ligue terminée (8 matchs), 1/8 pas encore publiés = en lice (qualifié direct possible)', () => {
    const played = Array.from({ length: 8 }, (_, i) => m('FINISHED', 'Phase de ligue', { daysAgo: 20 + i, ol: 0, opp: 1 }));
    expect(isCupEliminated(played, NOW)).toBe(false);
  });

  it('phase de ligue : une journée jouée seulement = en lice', () => {
    expect(isCupEliminated([m('FINISHED', 'Phase de ligue', { ol: 0, opp: 1 })], NOW)).toBe(false);
  });

  it(`sans issue lisible, plus aucun match depuis plus de ${STALE_DAYS} jours = éliminé`, () => {
    const old = Array.from({ length: 8 }, (_, i) => m('FINISHED', 'Phase de ligue', { daysAgo: STALE_DAYS + 1 + i }));
    expect(isCupEliminated(old, NOW)).toBe(true);
  });
});
