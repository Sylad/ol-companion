import { isCupEliminated, LEAGUE_PHASE_MATCHES } from './cup-status';
import type { CupMatch } from './cups.service';

function m(status: string, stageFr: string, id = Math.random()): CupMatch {
  return {
    id, date: '2026-10-01T19:00:00.000Z', homeTeam: 'A', homeTeamId: 1, awayTeam: 'B', awayTeamId: 2,
    homeScore: null, awayScore: null, status, stage: stageFr, stageFr,
  };
}

describe('isCupEliminated', () => {
  it('Coupe de France : un match joué et rien à venir = éliminé', () => {
    expect(isCupEliminated(37, [m('FINISHED', '32ème de finale')])).toBe(true);
  });

  it('un match à venir = en lice', () => {
    expect(isCupEliminated(37, [m('FINISHED', 'Tour 3'), m('SCHEDULED', 'Tour 4')])).toBe(false);
  });

  it('aucun match joué = pas éliminé', () => {
    expect(isCupEliminated(37, [])).toBe(false);
  });

  it('Ligue Europa : une journée de phase de ligue jouée, calendrier à venir inconnu = en lice', () => {
    expect(isCupEliminated(573, [m('FINISHED', 'Phase de ligue')])).toBe(false);
  });

  it(`Ligue Europa : ${LEAGUE_PHASE_MATCHES - 1} journées jouées sur ${LEAGUE_PHASE_MATCHES} = en lice`, () => {
    const played = Array.from({ length: LEAGUE_PHASE_MATCHES - 1 }, () => m('FINISHED', 'Phase de ligue'));
    expect(isCupEliminated(573, played)).toBe(false);
  });

  it('Ligue Europa : phase de ligue terminée, rien à venir = éliminé', () => {
    const played = Array.from({ length: LEAGUE_PHASE_MATCHES }, () => m('FINISHED', 'Phase de ligue'));
    expect(isCupEliminated(573, played)).toBe(true);
  });

  it('Ligue Europa : éliminé en barrages (phase de ligue terminée ou non) = éliminé', () => {
    expect(isCupEliminated(573, [m('FINISHED', 'Phase de ligue'), m('FINISHED', 'Barrages')])).toBe(true);
  });

  it('Ligue Europa : un match à venir = en lice', () => {
    expect(isCupEliminated(573, [m('FINISHED', 'Phase de ligue'), m('SCHEDULED', 'Phase de ligue')])).toBe(false);
  });
});
