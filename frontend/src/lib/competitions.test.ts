import { describe, expect, it } from 'vitest';
import { COMPETITION_GLOSSARY, competitionLong, competitionShort } from './competitions';

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
