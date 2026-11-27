import {
  footballDataToStandingsId,
  LINKED_STANDINGS_IDS,
} from '../../config/club-ids';
import { footballDataTimeConfirmed } from '../fixtures/kickoff-time';
import type { FdLeagueMatch } from '../match-impact/match-impact';

/**
 * L273 — le prochain match de Ligue 1 programmé de chaque club, d'après football-data.org seul
 * (la copie de `/v4/competitions/2015/matches` tenue par `LeagueMatchesService`, aucun appel de plus).
 *
 * « Programmé » = statut `SCHEDULED` (jour connu, heure peut-être pas) ou `TIMED` (heure fixée).
 * Un match reporté sans nouvelle date (`POSTPONED`) ou joué n'est pas « prochain » ; un match en cours le reste
 * tant qu'il se joue (`live`).
 */
const UPCOMING = new Set(['SCHEDULED', 'TIMED']);

/**
 * Match en cours chez football-data (v4). Il reste le match « du moment » du club tant qu'il se joue :
 * sans lui, pendant la dernière journée jouée en direct, la case disait « match reporté » et, les
 * neuf matchs en même temps, la légende « Saison terminée » (revue de code de L273).
 */
const LIVE = new Set([
  'IN_PLAY',
  'PAUSED',
  'EXTRA_TIME',
  'PENALTY_SHOOTOUT',
  'LIVE',
]);

/**
 * Un match programmé dont le coup d'envoi est passé depuis plus de ce délai n'est plus « prochain » :
 * la copie peut avoir quelques heures quand football-data ne répond plus (elle est servie quel que soit
 * son âge), et un match joué y garde son statut d'avant.
 */
const STARTED_GRACE_MS = 2 * 3600_000;

/** Un match « en cours » dans une copie, passé de plus de ce délai, est fini en vrai (prolongation et tirs au but compris). */
const LIVE_GRACE_MS = 3 * 3600_000;

export interface NextOpponent {
  /** Club de la ligne, dans les identifiants de `/api/standings` (365scores, OL sous 523). */
  teamId: number;
  /** Adversaire, mêmes identifiants ; `null` si football-data nomme un club non relié (`club-ids.ts`). */
  opponentId: number | null;
  /** Nom de l'adversaire chez football-data (nom court), repli quand `opponentId` est nul. */
  opponentName: string;
  /** Le club de la ligne reçoit (`home`) ou se déplace (`away`). */
  venue: 'home' | 'away';
  utcDate: string;
  /** Faux quand football-data n'a pas fixé l'heure (cf. `footballDataTimeConfirmed`). */
  timeConfirmed: boolean;
  matchday: number | null;
  /** Vrai quand ce match se joue (statut en cours chez football-data) : la case le dit « en cours ». */
  live: boolean;
}

export interface NextOpponents {
  /** Aucun match de Ligue 1 programmé ni en cours dans toute la compétition : la saison est finie. */
  seasonOver: boolean;
  /** Clubs de `/api/standings` reliés à football-data ; une ligne hors de cette liste n'a pas d'adversaire connu. */
  linkedTeamIds: number[];
  /** Un élément par club relié qui a un match programmé. */
  next: NextOpponent[];
  /** Clubs nommés par football-data et absents de `club-ids.ts` (à ajouter à la table). */
  unlinked: string[];
}

export function computeNextOpponents(
  matches: FdLeagueMatch[],
  now: Date,
): NextOpponents {
  const since = (m: FdLeagueMatch) =>
    now.getTime() - new Date(m.utcDate).getTime();
  const upcoming = matches
    .filter(
      (m) =>
        (UPCOMING.has(m.status) && since(m) <= STARTED_GRACE_MS) ||
        (LIVE.has(m.status) && since(m) <= LIVE_GRACE_MS),
    )
    .sort(
      (a, b) => new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime(),
    );

  const byTeam = new Map<number, NextOpponent>();
  const unlinked = new Set<string>();
  for (const m of upcoming) {
    const sides = [
      { self: m.homeTeam, other: m.awayTeam, venue: 'home' as const },
      { self: m.awayTeam, other: m.homeTeam, venue: 'away' as const },
    ];
    for (const { self, other, venue } of sides) {
      const teamId = footballDataToStandingsId(self.id);
      if (teamId === undefined) {
        unlinked.add(self.name || String(self.id));
        continue;
      }
      if (byTeam.has(teamId)) continue;
      byTeam.set(teamId, {
        teamId,
        opponentId: footballDataToStandingsId(other.id) ?? null,
        opponentName: other.name,
        venue,
        utcDate: m.utcDate,
        timeConfirmed: footballDataTimeConfirmed(m.status, m.utcDate),
        matchday: m.matchday,
        live: LIVE.has(m.status),
      });
    }
  }

  return {
    seasonOver: upcoming.length === 0,
    linkedTeamIds: [...LINKED_STANDINGS_IDS],
    next: [...byTeam.values()],
    unlinked: [...unlinked].sort(),
  };
}
