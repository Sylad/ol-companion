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
  it('L88 — donne « Rennes » pour Stade Rennais FC 1901 (le FC du milieu n’est pas retiré par les règles)', () => {
    expect(teamShortName('Stade Rennais FC 1901')).toBe('Rennes');
    expect(teamShortName('  Stade Rennais FC 1901 ')).toBe('Rennes');
  });
});
