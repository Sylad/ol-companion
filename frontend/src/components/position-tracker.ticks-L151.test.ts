import { describe, expect, it } from 'vitest';
import { matchdayTicks } from './position-tracker';

// L151 — recharts `interval={1}` sautait un tick sur deux (J6 sans étiquette) :
// les journées étiquetées sont choisies explicitement.

const jours = (n: number) => Array.from({ length: n }, (_, i) => ({ matchday: i + 1 }));

describe('matchdayTicks (L151)', () => {
  it('jusqu\'à 20 journées : toutes étiquetées, J6 comprise', () => {
    expect(matchdayTicks(jours(8))).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(matchdayTicks(jours(20))).toHaveLength(20);
  });
  it('au-delà : première, multiples de 5 et dernière, sans étiquettes collées', () => {
    expect(matchdayTicks(jours(34))).toEqual([1, 5, 10, 15, 20, 25, 30, 34]);
    expect(matchdayTicks(jours(36))).toEqual([1, 5, 10, 15, 20, 25, 30, 36]);
  });
  it('commence à la première journée connue, même si ce n\'est pas J1', () => {
    expect(matchdayTicks([{ matchday: 4 }, { matchday: 5 }])).toEqual([4, 5]);
  });
});
