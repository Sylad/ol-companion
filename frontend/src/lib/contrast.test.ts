import { describe, expect, it } from 'vitest';
import { contrastRatio, hslTokenToRgb, parseHsl } from './contrast';

describe('contrast', () => {
  it('blanc sur noir = 21:1', () => {
    expect(contrastRatio([1, 1, 1], [0, 0, 0])).toBeCloseTo(21, 5);
  });
  it('lit un jeton « h s% l% » et une couleur hsl(h, s%, l%)', () => {
    expect(hslTokenToRgb('0 0% 100%')).toEqual([1, 1, 1]);
    expect(parseHsl('hsl(0, 0%, 0%)')).toEqual([0, 0, 0]);
  });
  it('le bleu OL sur le fond sombre mesure 1,8 (valeur de la revue UX)', () => {
    expect(contrastRatio(parseHsl('hsl(224, 64%, 33%)'), hslTokenToRgb('228 21% 8%'))).toBeCloseTo(1.83, 1);
  });
});
