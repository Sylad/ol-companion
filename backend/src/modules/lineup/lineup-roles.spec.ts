import { splitLineupRoles } from './lineup-roles';

const member = (id: number, status: number, line = 0, position = 'Midfielder') => ({
  id,
  isStarting: status === 1,
  status,
  yardLine: line,
  position,
});

describe('splitLineupRoles', () => {
  const members = [
    member(1, 1, 1, 'Goalkeeper'),
    member(2, 1, 3),
    member(3, 2, 0), // remplaçant sans place sur le terrain
    member(4, 2, 5), // remplaçant
    member(5, 3, 0), // hors du groupe (Tagliafico)
    member(6, 4, 0, 'Management'), // staff (entraîneur)
    member(7, 2, 0, 'Management'), // entraîneur mal classé : jamais au banc
  ];

  it('ne met au banc que les remplaçants du match', () => {
    const { bench } = splitLineupRoles(members);
    expect(bench.map((m) => m.id)).toEqual([3, 4]);
  });

  it('garde les titulaires triés par ligne', () => {
    const { starters } = splitLineupRoles(members);
    expect(starters.map((m) => m.id)).toEqual([1, 2]);
  });

  it('range les non retenus à part et écarte le staff', () => {
    const { unavailable } = splitLineupRoles(members);
    expect(unavailable.map((m) => m.id)).toEqual([5]);
  });
});
