import { fillMissingJerseys, jerseysOfGame } from './live-match.jerseys';
import type { LiveMatchLineup, LiveMatchLineupPlayer } from './live-match.types';

const pl = (id: number, jerseyNumber: number | null): LiveMatchLineupPlayer => ({
  id, name: `P${id}`, shortName: `P${id}`, jerseyNumber, positionShort: 'CM', yardLine: 3, yardSide: 50, ranking: null,
});
const lineup = (starters: LiveMatchLineupPlayer[], bench: LiveMatchLineupPlayer[] = []): LiveMatchLineup => ({
  formation: '4-3-3', probable: true, starters, bench,
});

describe('fillMissingJerseys (L133)', () => {
  it('reprend le numéro du match précédent pour un joueur sans numéro, titulaire ou remplaçant', () => {
    const l = lineup([pl(1, null), pl(2, 9)], [pl(3, null)]);
    fillMissingJerseys(l, new Map([[1, 11], [3, 30]]));
    expect(l.starters.map((p) => p.jerseyNumber)).toEqual([11, 9]);
    expect(l.bench[0].jerseyNumber).toBe(30);
  });

  it('ne touche pas un numéro déjà donné par 365scores, et laisse null un joueur inconnu', () => {
    const l = lineup([pl(1, 7), pl(2, null)]);
    fillMissingJerseys(l, new Map([[1, 99]]));
    expect(l.starters.map((p) => p.jerseyNumber)).toEqual([7, null]);
  });
});

describe('jerseysOfGame', () => {
  it('ne garde que les numéros > 0 des joueurs du match', () => {
    const game = { members: [{ id: 1, jerseyNumber: 11 }, { id: 2, jerseyNumber: 0 }, { id: 3 }, { jerseyNumber: 5 }] };
    expect([...jerseysOfGame(game as never)]).toEqual([[1, 11]]);
  });
});
