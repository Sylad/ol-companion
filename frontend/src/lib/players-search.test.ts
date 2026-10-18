import { describe, expect, it } from 'vitest';
import { validatePlayersSearch } from './players-search';

// L7/t4 — l'onglet et le tri de la page Joueurs vivent dans l'URL ; une valeur inconnue est ignorée (jamais d'erreur).

describe('validatePlayersSearch (L7/t4)', () => {
  it('garde un onglet et un tri connus', () => {
    expect(validatePlayersSearch({ onglet: 'stats', tri: 'buts' })).toEqual({ onglet: 'stats', tri: 'buts' });
  });
  it('ignore les valeurs inconnues ou mal typées', () => {
    expect(validatePlayersSearch({ onglet: 'banc', tri: 42 })).toEqual({ onglet: undefined, tri: undefined });
  });
  it('les valeurs par défaut (composition, bp) ne sont pas conservées : l’URL reste propre', () => {
    expect(validatePlayersSearch({ onglet: 'composition', tri: 'bp' })).toEqual({ onglet: undefined, tri: undefined });
  });
});
