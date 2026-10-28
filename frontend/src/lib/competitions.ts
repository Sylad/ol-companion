import type { CompetitionCode } from '@/types/api';

/**
 * Le seul glossaire des noms de compétitions de l'app : nom long (titres,
 * blocs, bilan) et nom court (pastilles, tableaux serrés) — le court s'affiche
 * toujours avec le long en `title` / nom accessible (composant `CompetitionAbbr`).
 */
export const COMPETITION_GLOSSARY: Record<CompetitionCode, { long: string; short: string }> = {
  L1: { long: 'Ligue 1', short: 'L1' },
  UCL: { long: 'Ligue des champions', short: 'C1' },
  UEL: { long: 'Ligue Europa', short: 'C3' },
  CDF: { long: 'Coupe de France', short: 'CdF' },
};

export function competitionLong(code: CompetitionCode): string {
  return COMPETITION_GLOSSARY[code].long;
}

export function competitionShort(code: CompetitionCode): string {
  return COMPETITION_GLOSSARY[code].short;
}

/** Identifiant 365scores → code suivi (miroir de `TRACKED_COMPETITIONS` du backend). */
const CODE_BY_365SCORES_ID: Record<number, CompetitionCode> = {
  35: 'L1',
  37: 'CDF',
  573: 'UEL',
  572: 'UCL',
  332: 'UCL',
};

/**
 * Nom à afficher d'une compétition lue brute chez 365scores (« France, Ligue 1 ») :
 * le nom du glossaire quand l'identifiant est suivi, sinon le nom brut, faute de mieux.
 */
export function competitionLabel(competitionId: number | undefined, rawName: string | undefined): string {
  const code = competitionId === undefined ? undefined : CODE_BY_365SCORES_ID[competitionId];
  return code ? competitionLong(code) : (rawName ?? '');
}
