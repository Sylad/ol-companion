import { describe, expect, it } from 'vitest';
import { COMPETITION_GLOSSARY, competitionLabel, competitionLong, competitionShort } from './competitions';

describe('glossaire des compétitions', () => {
  it('donne un nom long et un nom court par compétition suivie', () => {
    expect(COMPETITION_GLOSSARY).toEqual({
      L1: { long: 'Ligue 1', short: 'L1' },
      UCL: { long: 'Ligue des champions', short: 'C1' },
      UEL: { long: 'Ligue Europa', short: 'C3' },
      CDF: { long: 'Coupe de France', short: 'CdF' },
    });
  });

  it('expose les deux noms par code', () => {
    expect(competitionLong('UCL')).toBe('Ligue des champions');
    expect(competitionShort('UEL')).toBe('C3');
    expect(competitionShort('CDF')).toBe('CdF');
  });
});

describe('L72 — nom d\'une compétition lue chez 365scores', () => {
  it('R1 — l\'identifiant suivi passe par le glossaire, jamais le nom brut « France, Ligue 1 »', () => {
    expect(competitionLabel(35, 'France, Ligue 1')).toBe('Ligue 1');
    expect(competitionLabel(37, 'France, Coupe de France')).toBe('Coupe de France');
    expect(competitionLabel(573, 'UEFA Europa League')).toBe('Ligue Europa');
    expect(competitionLabel(572, 'UEFA Champions League')).toBe('Ligue des champions');
  });

  it('R2 — les qualifications de Ligue des champions (332) sont aussi « Ligue des champions »', () => {
    expect(competitionLabel(332, 'UEFA Champions League Qualifiers')).toBe('Ligue des champions');
  });

  it('R3 — identifiant inconnu ou absent : le nom brut est gardé, vide si rien', () => {
    expect(competitionLabel(99, 'Trophée X')).toBe('Trophée X');
    expect(competitionLabel(undefined, 'France, Ligue 1')).toBe('France, Ligue 1');
    expect(competitionLabel(undefined, undefined)).toBe('');
  });
});
