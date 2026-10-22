import { describe, expect, it } from 'vitest';
import { hasJersey } from './jersey';

describe('hasJersey (L213)', () => {
  it.each([[-1, false], [0, false], [null, false], [undefined, false], [1, true], [40, true]])('numéro %s → %s', (n, attendu) => {
    expect(hasJersey(n)).toBe(attendu);
  });
});
