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
  it('lit la ligne dans `position`, avec les libellés réels de la feuille (positionShort long ou code)', () => {
    const reels: [string, string, string][] = [
      ['Goalkeeper', 'Goalkeeper', 'GK'],
      ['Defender', 'Centre Back', 'DEF'], ['Defender', 'Right Back', 'DEF'], ['Defender', 'Left Back', 'DEF'],
      ['Midfielder', 'Central Midfield', 'MID'], ['Midfielder', 'Attacking Midfield', 'MID'], ['Midfielder', 'MID', 'MID'],
      ['Attacker', 'Centre Forward', 'ATK'], ['Attacker', 'Left Forward', 'ATK'], ['Attacker', 'Right Forward', 'ATK'],
    ];
    for (const [position, court, groupe] of reels) expect(positionGroup(position, court)).toBe(groupe);
  });
  it('sans `position`, se replie sur positionShort (libellé long ou code, casse libre) ; l\'inconnu est rendu tel quel', () => {
    expect(positionGroup('', 'Centre Back')).toBe('DEF');
    expect(positionGroup('', 'cb')).toBe('DEF');
    expect(positionGroup('', 'RW')).toBe('ATK');
    expect(positionGroup('', 'XYZ')).toBe('XYZ');
    expect(positionGroup('Libero', 'LIB')).toBe('LIB');
  });
});
