import { describe, expect, it } from 'vitest';
import { shortDate } from './kickoff';

describe('date courte partagée par /equipe-de-france et la page du match des Bleus', () => {
  it('R11 — « Jeu. 12/11 », la date de L113 (l’heure s’y ajoute en « 21h00 », jamais « 21:00 »)', () => {
    expect(shortDate('2026-11-12T12:00:00Z')).toBe('Jeu. 12/11');
  });
});
