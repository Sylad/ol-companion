import { describe, expect, it } from 'vitest';
import type { SeasonMatch } from '@/types/api';
import season from '@/test/fixtures/season-matches-2026-10-03.json';
import { filterLigue1 } from './ligue1-club-match';

// L39 — /api/season-matches rend maintenant aussi les qualifications de Ligue
// des champions. La carte, elle, ne montre que la Ligue 1.
const matches = season as SeasonMatch[];
const QUALIFIERS = [4779514, 4779515, 4809607, 4809611];

describe('carte Ligue 1 — source /api/season-matches', () => {
  it('ne garde que les 34 matchs de Ligue 1 des 46 de la saison', () => {
    expect(matches).toHaveLength(46);
    const ligue1 = filterLigue1(matches);
    expect(ligue1).toHaveLength(34);
    expect(ligue1.every((m) => m.competitionId === 35)).toBe(true);
  });

  it('écarte les 4 qualifications de Ligue des champions et la Ligue Europa', () => {
    const ids = new Set(filterLigue1(matches).map((m) => m.id));
    expect(matches.filter((m) => QUALIFIERS.includes(m.id))).toHaveLength(4);
    expect(QUALIFIERS.some((id) => ids.has(id))).toBe(false);
    expect(filterLigue1(matches).some((m) => m.competitionCode !== 'L1')).toBe(false);
  });

  it('sans données : liste vide', () => {
    expect(filterLigue1(undefined)).toEqual([]);
  });
});
