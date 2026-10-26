import { describe, expect, it } from 'vitest';
import { initiales } from './initiales';

// L218 — même règle d'initiales partout : celles du nom complet, jamais d'un nom court (« Tolisso » donnait « T »).
describe('initiales (L218)', () => {
  it('R1 — le nom complet donne deux initiales : Corentin Tolisso → CT', () => {
    expect(initiales('Corentin Tolisso')).toBe('CT');
  });
  it('R2 — au plus deux lettres, les deux premiers mots : Jean Philippe Mateta → JP', () => {
    expect(initiales('Jean Philippe Mateta')).toBe('JP');
  });
  it('R3 — un nom d’un seul mot, des espaces en trop ou un nom vide ne cassent rien', () => {
    expect(initiales('Lucas')).toBe('L');
    expect(initiales('  Angel   García ')).toBe('AG');
    expect(initiales('')).toBe('');
  });
});
