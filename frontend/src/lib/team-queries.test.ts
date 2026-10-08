import { describe, expect, it } from 'vitest';
import { teamShortName } from './team-queries';

describe('teamShortName (L48)', () => {
  it('donne « Marseille » pour Olympique de Marseille', () => {
    expect(teamShortName('Olympique de Marseille')).toBe('Marseille');
  });
  it('garde les autres noms usuels', () => {
    expect(teamShortName('OGC Nice')).toBe('Nice');
    expect(teamShortName('Lens')).toBe('Lens');
  });
});
