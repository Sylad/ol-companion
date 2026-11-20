import { describe, expect, it } from 'vitest';
import type { MatchImpact } from '@/types/api';
import { ceQueCaChange, placeCle } from './ce-que-ca-change';

// L265 — la phrase « Ce que ça change », à partir du calcul de /api/match-impact (football-data.org).

const impact = (over: Partial<MatchImpact>): MatchImpact => ({
  matchday: 12, finished: true, homeTeam: 'Lyon', awayTeam: 'Nice', score: { home: 2, away: 1 },
  before: { position: 5, points: 20 }, after: { position: 4, points: 23 },
  remaining: 0, remainingInMatchday: 0,
  above: { place: 3, gap: 2 }, below: { place: 5, margin: 4 },
  updatedAt: '2026-11-20T12:00:00Z',
  ...over,
});

describe('ceQueCaChange — journée complète', () => {
  it('Lyon gagne une place : avant, après, écart avec la place du dessus et avance sur celle du dessous', () => {
    expect(ceQueCaChange(impact({}))).toEqual({
      phrase: 'Lyon passe de 5e à 4e, à 2 points de la 3e place (Ligue des champions) et 4 points d’avance sur la 6e place (Ligue Conférence).',
      provisoire: null,
    });
  });
  it('Lyon recule', () => {
    expect(ceQueCaChange(impact({ before: { position: 3, points: 20 }, after: { position: 5, points: 20 }, above: { place: 3, gap: 1 }, below: { place: 5, margin: 2 } }))!.phrase)
      .toBe('Lyon passe de 3e à 5e, à 1 point de la 3e place (Ligue des champions) et 2 points d’avance sur la 6e place (Ligue Conférence).');
  });
  it('Lyon garde sa place', () => {
    expect(ceQueCaChange(impact({ before: { position: 4, points: 20 } }))!.phrase).toMatch(/^Lyon reste 4e, /);
  });
  it('Lyon en tête : « 1er », pas de place au-dessus', () => {
    expect(ceQueCaChange(impact({ before: { position: 4, points: 11 }, after: { position: 1, points: 14 }, above: null, below: { place: 1, margin: 3 } }))!.phrase)
      .toBe('Lyon passe de 4e à 1er, 3 points d’avance sur la 2e place.');
  });
  it('en bas : la place de maintien direct au-dessus', () => {
    expect(ceQueCaChange(impact({ before: { position: 17, points: 8 }, after: { position: 16, points: 9 }, above: { place: 15, gap: 1 }, below: null }))!.phrase)
      .toBe('Lyon passe de 17e à 16e, à 1 point de la 15e place (maintien direct).');
  });
});

describe('ceQueCaChange — égalité de points', () => {
  it('à égalité de points avec la place clé du dessus (derrière au départage)', () => {
    expect(ceQueCaChange(impact({ above: { place: 3, gap: 0 } }))!.phrase).toContain('à égalité de points avec la 3e place (Ligue des champions)');
  });
  it('à égalité de points avec la place suivante', () => {
    expect(ceQueCaChange(impact({ before: { position: 4, points: 11 }, after: { position: 1, points: 14 }, above: null, below: { place: 1, margin: 0 } }))!.phrase)
      .toBe('Lyon passe de 4e à 1er, à égalité de points avec la 2e place.');
  });
});

describe('ceQueCaChange — première journée', () => {
  it('pas de place avant : « à l’issue de la 1re journée »', () => {
    expect(ceQueCaChange(impact({ matchday: 1, before: null, after: { position: 3, points: 3 }, above: { place: 1, gap: 0 }, below: { place: 3, margin: 0 } }))!.phrase)
      .toBe('Lyon est 3e à l’issue de la 1re journée, à égalité de points avec la 1re place et la 4e place.');
  });
});

describe('ceQueCaChange — journée incomplète', () => {
  it('matchs de la journée à jouer : classement provisoire', () => {
    expect(ceQueCaChange(impact({ matchday: 9, remaining: 2, remainingInMatchday: 2 }))!.provisoire)
      .toBe('Classement provisoire : 2 matchs de la 9e journée restent à jouer.');
  });
  it('un seul match', () => {
    expect(ceQueCaChange(impact({ matchday: 9, remaining: 1, remainingInMatchday: 1 }))!.provisoire)
      .toBe('Classement provisoire : 1 match de la 9e journée reste à jouer.');
  });
  it('match en retard d’une journée précédente', () => {
    expect(ceQueCaChange(impact({ matchday: 9, remaining: 3, remainingInMatchday: 2 }))!.provisoire)
      .toBe('Classement provisoire : 3 matchs des journées 1 à 9 restent à jouer.');
  });
});

describe('ceQueCaChange — rien à dire', () => {
  it('match pas encore terminé chez football-data : null', () => {
    expect(ceQueCaChange(impact({ finished: false, after: null, before: null, above: null, below: null }))).toBeNull();
  });
});

describe('placeCle — zones de la légende du classement', () => {
  it.each([[1, 'la 1re place'], [3, 'la 3e place (Ligue des champions)'], [5, 'la 5e place (Ligue Europa)'], [16, 'la 16e place (barrage de relégation)'], [7, 'la 7e place']])(
    '%i → %s', (n, attendu) => expect(placeCle(n)).toBe(attendu),
  );
});
