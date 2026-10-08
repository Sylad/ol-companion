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
