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
  it('traduit chaque code produit par abbreviatePosition (backend) en libellé long français (L209)', () => {
    const codes: [string, string][] = [
      ['GK', 'Gardien'], ['CB', 'Défenseur central'], ['LB', 'Latéral gauche'], ['RB', 'Latéral droit'],
      ['LWB', 'Piston gauche'], ['RWB', 'Piston droit'], ['DM', 'Milieu défensif'], ['CM', 'Milieu central'],
      ['AM', 'Milieu offensif'], ['LM', 'Milieu gauche'], ['RM', 'Milieu droit'], ['LW', 'Ailier gauche'],
      ['RW', 'Ailier droit'], ['CF', 'Avant-centre'], ['SS', 'Second attaquant'], ['ST', 'Avant-centre'],
    ];
    for (const [code, libelle] of codes) expect(positionLabelFr(code)).toBe(libelle);
    expect(positionLabelFr('gk')).toBe('Gardien');
  });
  it('L78 — les libellés français de 365scores (« Milieu de Terrain ») sont ramenés à la casse du français, abrégés et groupés', () => {
    expect(positionLabelFr('Milieu de Terrain')).toBe('Milieu de terrain');
    expect(positionLabelFr('milieu de terrain')).toBe('Milieu de terrain');
    expect(positionLabelFr('Attaquant')).toBe('Attaquant');
    expect(positionLabelFr('Défenseur')).toBe('Défenseur');
    expect(positionLabelFr('Gardien de But')).toBe('Gardien de but');
    expect(positionShortFr('Milieu de Terrain')).toBe('MIL');
    expect(positionShortFr('Défenseur')).toBe('DEF');
    expect(positionGroup('Milieu de Terrain')).toBe('MID');
    expect(positionGroup('Attaquant')).toBe('ATK');
    expect(positionGroup('Défenseur')).toBe('DEF');
    expect(positionGroup('Gardien de But')).toBe('GK');
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
