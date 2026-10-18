import { describe, expect, it } from 'vitest';
import { noteFr } from './note-fr';

describe('noteFr — notes au format français (L178)', () => {
  it('une décimale, virgule', () => {
    expect(noteFr(7.3)).toBe('7,3');
    expect(noteFr(8)).toBe('8,0');
    expect(noteFr(6.25)).toBe('6,3');
  });
});
