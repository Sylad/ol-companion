import { describe, expect, it } from 'vitest';
import { positionGroup, positionLabelFr, positionShortFr } from './position-fr';

describe('postes en français (L56)', () => {
  it('traduit les libellés longs 365scores, quelle que soit la casse', () => {
    expect(positionLabelFr('Goalkeeper')).toBe('Gardien');
    expect(positionLabelFr('GOALKEEPER')).toBe('Gardien');
    expect(positionLabelFr('Centre Back')).toBe('Défenseur central');
    expect(positionLabelFr('CENTRE-BACK')).toBe('Défenseur central');
    expect(positionLabelFr('Coach')).toBe('Entraîneur');
    expect(positionLabelFr('Management')).toBe('Entraîneur');
    expect(positionLabelFr('Defensive Midfield')).toBe('Milieu défensif');
  });
  it('laisse les libellés déjà français ou inconnus', () => {
    expect(positionLabelFr('Gardien de But')).toBe('Gardien de but');
    expect(positionLabelFr('Libero')).toBe('Libero');
    expect(positionLabelFr('')).toBe('');
  });
  it('abrège en français, depuis une abréviation ou un libellé long', () => {
    expect(positionShortFr('GK')).toBe('GB');
    expect(positionShortFr('CB')).toBe('DC');
    expect(positionShortFr('GOALKEEPER')).toBe('GB');
    expect(positionShortFr('COACH')).toBe('ENT');
    expect(positionShortFr('XYZ')).toBe('XYZ');
  });
});

describe('ligne de poste de la feuille de match (L178)', () => {
  it('ramène les postes détaillés à GK / DEF / MID / ATK, quelle que soit la casse, et laisse l\'inconnu', () => {
    expect(positionGroup('GK')).toBe('GK');
    for (const c of ['CB', 'RB', 'LB', 'LWB', 'RWB', 'DEF']) expect(positionGroup(c)).toBe('DEF');
    for (const c of ['DM', 'CM', 'AM', 'LM', 'RM', 'MID']) expect(positionGroup(c)).toBe('MID');
    for (const c of ['RW', 'LW', 'FW', 'ST', 'CF', 'SS', 'ATK']) expect(positionGroup(c)).toBe('ATK');
    expect(positionGroup('cb')).toBe('DEF');
    expect(positionGroup('XYZ')).toBe('XYZ');
  });
});
