import { describe, expect, it } from 'vitest';
import { decimalFr, roleFr, statNameFr, statValueFr } from './stat-fr';

describe('stat-fr — glossaire et nombres français (L179)', () => {
  it('R1 — les libellés bruts de 365scores ont un nom français', () => {
    expect(statNameFr('Tackles')).toBe('Tacles');
    expect(statNameFr('Les interceptions')).toBe('Interceptions');
    expect(statNameFr('Goals')).toBe('Buts');
    expect(statNameFr('Assists')).toBe('Passes décisives');
    expect(statNameFr('Appearances')).toBe('Matchs joués');
    expect(statNameFr('Yellow:Red')).toBe('Jaunes : rouges');
  });

  it('L183 — « Pass. Décisiv. » (abréviation 365scores pendant le match) s’écrit « Passes décisives »', () => {
    expect(statNameFr('Pass. Décisiv.')).toBe('Passes décisives');
  });

  it('R1 — un libellé déjà français ou inconnu reste tel quel', () => {
    expect(statNameFr('Buts attendus')).toBe('Buts attendus');
    expect(statNameFr('Tirs cadrés')).toBe('Tirs cadrés');
    expect(statNameFr('Quelque chose de nouveau')).toBe('Quelque chose de nouveau');
  });

  it('R1 — les rôles anglais d’un match à venir sont traduits', () => {
    expect(roleFr('Attacker')).toBe('Attaquant');
    expect(roleFr('Midfielder')).toBe('Milieu de terrain');
    expect(roleFr('Defender')).toBe('Défenseur');
    expect(roleFr('Goalkeeper')).toBe('Gardien');
    expect(roleFr('Meilleur buteur')).toBe('Meilleur buteur');
  });

  it('R1 — un rôle déjà français de 365scores est ramené à la casse du français (L78)', () => {
    expect(roleFr('Milieu de Terrain')).toBe('Milieu de terrain');
    expect(roleFr('Gardien De But')).toBe('Gardien de but');
  });

  it('R2 — une valeur décimale s’écrit avec la virgule, un entier ou un texte non décimal ne bouge pas', () => {
    expect(statValueFr('0.5')).toBe('0,5');
    expect(statValueFr('0.24')).toBe('0,24');
    expect(statValueFr('12')).toBe('12');
    expect(statValueFr('0 : 0')).toBe('0 : 0');
    expect(statValueFr('')).toBe('');
  });

  it('R2 — decimalFr fixe le nombre de décimales et met la virgule (xG 1,03)', () => {
    expect(decimalFr(1.03, 2)).toBe('1,03');
    expect(decimalFr(1.8, 2)).toBe('1,80');
    expect(decimalFr(0, 2)).toBe('0,00');
  });
});
