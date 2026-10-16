import { describe, expect, it } from 'vitest';
import { clubSymbol } from './club-symbol';

describe('clubSymbol', () => {
  it('R5 — garde le sigle fourni par 365scores', () => {
    expect(clubSymbol('RCL', 'Lens')).toBe('RCL');
  });
  it('R5 — sigle vide : trois premières lettres du nom en capitales', () => {
    expect(clubSymbol('', 'Lens')).toBe('LEN');
    expect(clubSymbol('  ', 'Olympique Lyonnais')).toBe('OLY');
  });
  it('R5 — sigle absent et nom accentué : lettres seules, en capitales', () => {
    expect(clubSymbol(undefined, 'Saint-Étienne')).toBe('SAI');
    expect(clubSymbol('', 'Le Havre')).toBe('LEH');
  });
});
