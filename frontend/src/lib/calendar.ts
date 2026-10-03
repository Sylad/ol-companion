import { OL_365SCORES_ID, OL_TEAM_ID, type SeasonMatch } from '@/types/api';
import { clubLogoUrl } from '@/lib/ligue1-clubs-coords';

/**
 * Logique de la page Calendrier (L39) : la saison de l'OL toutes compétitions,
 * telle que /api/season-matches la rend (déjà triée par date).
 */

export type StatusTab = 'all' | 'upcoming' | 'past';
export type CompetitionCode = SeasonMatch['competitionCode'];
export type CompetitionFilter = 'all' | CompetitionCode;

export function isPast(m: SeasonMatch): boolean {
  return m.status === 'FINISHED' || m.status === 'POSTPONED';
}

export function isUpcoming(m: SeasonMatch): boolean {
  return m.status === 'SCHEDULED' || m.status === 'TIMED' || m.status === 'IN_PLAY';
}

export function byStatus(matches: SeasonMatch[], tab: StatusTab): SeasonMatch[] {
  if (tab === 'upcoming') return matches.filter(isUpcoming);
  if (tab === 'past') return matches.filter(isPast);
  return matches;
}

export function byCompetition(matches: SeasonMatch[], filter: CompetitionFilter): SeasonMatch[] {
  return filter === 'all' ? matches : matches.filter((m) => m.competitionCode === filter);
}

export function statusCounts(matches: SeasonMatch[]): Record<StatusTab, number> {
  return {
    all: matches.length,
    upcoming: matches.filter(isUpcoming).length,
    past: matches.filter(isPast).length,
  };
}

export interface CompetitionOption {
  code: CompetitionCode;
  /** Libellé court de la pastille (tient sur un téléphone). */
  label: string;
  /** Nom complet, tel que l'API le donne et que les blocs l'affichent. */
  name: string;
  count: number;
}

const COMPETITION_ORDER: CompetitionCode[] = ['L1', 'UEL', 'CDF', 'OTHER'];
const SHORT_LABEL: Record<CompetitionCode, string> = {
  L1: 'Ligue 1',
  UEL: 'Europa',
  CDF: 'Coupe',
  OTHER: 'Autres',
};

/** Les compétitions présentes dans la saison, avec leur nombre de matchs. */
export function competitionOptions(matches: SeasonMatch[]): CompetitionOption[] {
  return COMPETITION_ORDER.flatMap((code) => {
    const own = matches.filter((m) => m.competitionCode === code);
    if (own.length === 0) return [];
    return [{
      code,
      label: SHORT_LABEL[code],
      name: code === 'OTHER' ? 'Autres compétitions' : own[0].competition,
      count: own.length,
    }];
  });
}

/** « Ligue 1 · J6 », « UEFA Europa League · J2 », « Coupe de France ». */
export function matchLabel(m: SeasonMatch): string {
  const competition = m.competition || 'Autres';
  return m.matchday ? `${competition} · J${m.matchday}` : competition;
}

export interface MatchGroup {
  key: string;
  label: string;
  matches: SeasonMatch[];
}

/**
 * Un bloc par libellé, dans l'ordre reçu : seuls des matchs CONSÉCUTIFS de même
 * libellé partagent un bloc, pour que l'ordre des dates soit toujours respecté
 * (deux tours de coupe sans journée ne sont pas rapprochés).
 */
export function groupMatches(matches: SeasonMatch[]): MatchGroup[] {
  const groups: MatchGroup[] = [];
  for (const m of matches) {
    const label = matchLabel(m);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.matches.push(m);
    else groups.push({ key: `${label}#${m.id}`, label, matches: [m] });
  }
  return groups;
}

export function countResults(matches: SeasonMatch[]): { wins: number; draws: number; losses: number } {
  let wins = 0;
  let draws = 0;
  let losses = 0;
  for (const m of matches) {
    if (m.status !== 'FINISHED' || m.homeScore === null || m.awayScore === null) continue;
    const olIsHome = m.homeTeamId === OL_TEAM_ID;
    const olScore = olIsHome ? m.homeScore : m.awayScore;
    const oppScore = olIsHome ? m.awayScore : m.homeScore;
    if (olScore > oppScore) wins++;
    else if (olScore < oppScore) losses++;
    else draws++;
  }
  return { wins, draws, losses };
}

/**
 * Écusson d'un club de /api/season-matches : les identifiants y sont ceux de
 * 365scores (sauf l'OL, servi sous son identifiant football-data), donc l'image
 * se prend directement au CDN de 365scores — deuxième source d'images du projet,
 * déjà utilisée par la carte. Pas d'appel /api/wiki-image par club : la saison
 * compte une trentaine de clubs, dont des clubs européens que la recherche
 * Wikipédia par nom résout mal (une photo de ville pour « Anderlecht »).
 */
export function seasonTeamLogoUrl(teamId: number): string {
  return clubLogoUrl(teamId === OL_TEAM_ID ? OL_365SCORES_ID : teamId);
}
