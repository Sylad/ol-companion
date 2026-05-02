import { getCurrentSeason, getPreviousSeason } from './season.util';

describe('season.util', () => {
  describe('getCurrentSeason', () => {
    it('returns 2025-2026 for 1 August 2025 00:00', () => {
      const s = getCurrentSeason(new Date('2025-08-01T00:00:00'));
      expect(s.id).toBe('2025-2026');
      expect(s.startDate.toISOString().slice(0, 10)).toBe('2025-08-01');
    });

    it('returns 2024-2025 for 31 July 2025 23:59', () => {
      const s = getCurrentSeason(new Date('2025-07-31T23:59:59'));
      expect(s.id).toBe('2024-2025');
    });

    it('returns 2025-2026 for any date in May 2026', () => {
      const s = getCurrentSeason(new Date('2026-05-02T12:00:00'));
      expect(s.id).toBe('2025-2026');
    });
  });

  describe('getPreviousSeason', () => {
    it('returns 2024-2025 when called on 1 August 2025', () => {
      const s = getPreviousSeason(new Date('2025-08-01T00:00:01'));
      expect(s.id).toBe('2024-2025');
    });

    it('returns 2024-2025 when called in May 2026', () => {
      const s = getPreviousSeason(new Date('2026-05-02T12:00:00'));
      expect(s.id).toBe('2024-2025');
    });
  });
});
