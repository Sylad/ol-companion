import { describe, expect, it } from 'vitest';
import { nextMatchVenue } from './stadium';

describe('lieu du prochain match (L56)', () => {
  it('donne le vrai stade du club reçu, repéré par son identifiant', () => {
    expect(nextMatchVenue({ homeTeam: 'Racing Club de Lens', homeTeamId: 546 })).toBe('Stade Bollaert-Delelis');
    expect(nextMatchVenue({ homeTeam: 'Olympique Lyonnais', homeTeamId: 523 })).toBe('Groupama Stadium · Décines-Charpieu');
  });
  it('repère le club par son nom si l’identifiant est inconnu', () => {
    expect(nextMatchVenue({ homeTeam: 'Racing Club de Lens', homeTeamId: 99999 })).toBe('Stade Bollaert-Delelis');
  });
  it('ne montre rien plutôt qu’un stade inventé', () => {
    expect(nextMatchVenue({ homeTeam: 'Club Inconnu', homeTeamId: 99999 })).toBeNull();
  });
});
