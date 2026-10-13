import { OL_365SCORES_ID, OL_TEAM_ID, type SeasonMatch } from '@/types/api';
import { clubLogoUrl } from '@/lib/ligue1-clubs-coords';
import { competitionLong, competitionShort } from '@/lib/competitions';

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
  /** Nom court de la pastille (L1, C1, C3, CdF : tient sur un téléphone). */
  label: string;
  /** Nom long du glossaire, celui des blocs ; annoncé et en infobulle. */
  name: string;
  count: number;
}

const COMPETITION_ORDER: CompetitionCode[] = ['L1', 'UCL', 'UEL', 'CDF'];

/** Les compétitions présentes dans la saison, avec leur nombre de matchs. */
export function competitionOptions(matches: SeasonMatch[]): CompetitionOption[] {
  return COMPETITION_ORDER.flatMap((code) => {
    const own = matches.filter((m) => m.competitionCode === code);
    if (own.length === 0) return [];
    return [{
      code,
      label: competitionShort(code),
      name: competitionLong(code),
      count: own.length,
    }];
  });
}

/**
 * « Ligue 1 · J6 », « Ligue Europa · J2 », « Ligue des champions · Barrages ·
 * retour » (sans journée : le tour et la manche quand l'API les donne),
 * « Coupe de France ». Le nom vient du glossaire, pas du libellé de l'API.
 */
export function matchLabel(m: SeasonMatch): string {
  const name = competitionLong(m.competitionCode);
  if (m.matchday) return `${name} · J${m.matchday}`;
  return m.round ? `${name} · ${m.round}` : name;
}

export interface MonthGroup {
  /** `YYYY-MM`. */
  key: string;
  /** « Octobre 2026 ». */
  label: string;
  matches: SeasonMatch[];
}

const MONTH_NAME = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

/**
 * Un bloc par mois civil (L50), dans l'ordre reçu, donc des dates. Un mois sans match n'a pas de
 * bloc. Un match à jour non fixé est rangé dans le mois de sa date de remplissage.
 */
export function groupByMonth(matches: SeasonMatch[]): MonthGroup[] {
  const groups: MonthGroup[] = [];
  for (const m of matches) {
    const d = new Date(m.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.matches.push(m);
    else groups.push({ key, label: `${MONTH_NAME[d.getMonth()]} ${d.getFullYear()}`, matches: [m] });
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
    // L139 : le score ne compte pas les tirs au but — un nul avec un qualifié désigné est une victoire ou une défaite.
    else if (m.shootoutWinnerId != null) m.shootoutWinnerId === OL_TEAM_ID ? wins++ : losses++;
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

/**
 * `matchupId` que la page `/match/<id>` envoie au backend : « domicile-extérieur-id »,
 * en identifiants 365scores. Le calendrier stocke l'OL sous son identifiant football-data
 * (523, `OL_TEAM_ID`) : on le rend à 465 (`OL_365SCORES_ID`) (L96).
 */
export function matchupId(match: SeasonMatch): string {
  const id365 = (id: number) => (id === OL_TEAM_ID ? OL_365SCORES_ID : id);
  return `${id365(match.homeTeamId)}-${id365(match.awayTeamId)}-${match.id}`;
}
