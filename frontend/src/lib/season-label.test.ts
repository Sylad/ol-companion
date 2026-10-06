import { describe, expect, it } from 'vitest';
import type { SeasonMatch } from '@/types/api';
import season from '@/test/fixtures/season-matches-2026-10-03.json';
import { seasonLabel } from './season-label';

const at = (date: string) => ({ date }) as SeasonMatch;

// L40 — le libellé suit la saison servie, plus un « 2025-26 » écrit en dur.
describe('seasonLabel', () => {
  it('lit la saison dans les matchs servis le 03-10-2026 : 2026-27', () => {
    expect(seasonLabel(season as SeasonMatch[])).toBe('2026-27');
  });

  it('une saison commence en juillet (qualifications) et finit en juin', () => {
    expect(seasonLabel([at('2026-07-09T17:00:00Z'), at('2027-05-30T19:00:00Z')])).toBe('2026-27');
    expect(seasonLabel([at('2025-08-16T17:00:00Z'), at('2026-05-17T19:00:00Z')])).toBe('2025-26');
  });

  it('passage de siècle : 2099-00', () => {
    expect(seasonLabel([at('2099-09-01T17:00:00Z')])).toBe('2099-00');
  });

  it('un match isolé d\'une autre saison ne change pas le libellé (majorité)', () => {
    expect(
      seasonLabel([at('2026-08-16T17:00:00Z'), at('2026-09-16T17:00:00Z'), at('2025-05-17T19:00:00Z')]),
    ).toBe('2026-27');
  });

  it('sans données, repli sur la saison de la date du jour', () => {
    expect(seasonLabel([], new Date('2026-10-06T10:00:00Z'))).toBe('2026-27');
    expect(seasonLabel(undefined, new Date('2027-03-01T10:00:00Z'))).toBe('2026-27');
  });
});
