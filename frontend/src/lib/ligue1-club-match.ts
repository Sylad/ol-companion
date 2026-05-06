import type { Fixture } from '@/types/api';
import { OL_TEAM_ID } from '@/types/api';
import { LIGUE1_CLUBS_COORDS, type Ligue1Club } from './ligue1-clubs-coords';

/**
 * Resolves a Ligue 1 fixture's opponent (vs OL) to a known club entry.
 *
 * football-data.org names occasionally drift from 365scores names ("Olympique
 * Lyonnais" vs "Lyon", etc.), so we try a few strategies in order:
 *   1. football-data team id  (most robust when present)
 *   2. exact name match against canonical name
 *   3. case-insensitive substring on name / city / stadium
 */
export function resolveOpponentClub(fixture: Fixture): Ligue1Club | undefined {
  const oppId = fixture.homeTeamId === OL_TEAM_ID ? fixture.awayTeamId : fixture.homeTeamId;
  const oppName = fixture.homeTeamId === OL_TEAM_ID ? fixture.awayTeam : fixture.homeTeam;

  const byId = LIGUE1_CLUBS_COORDS.find((c) => c.idFootballData && c.idFootballData === oppId);
  if (byId) return byId;

  const lower = (oppName ?? '').toLowerCase();
  if (!lower) return undefined;

  // Hand-tuned aliases for football-data names that don't substring-match the
  // canonical 365scores label.
  const aliases: Record<string, number> = {
    'olympique lyonnais': 465,
    'olympique de marseille': 469,
    'paris saint-germain': 480,
    'paris saint germain': 480,
    'rc lens': 481,
    'racing club de lens': 481,
    'losc lille': 478,
    'lille osc': 478,
    'stade rennais': 477,
    'as monaco': 471,
    'rc strasbourg alsace': 479,
    'rc strasbourg': 479,
    'fc lorient': 472,
    'toulouse fc': 482,
    'as saint-étienne': -1, // not in L1 this season but keep the slot for future
    'stade brestois 29': 534,
    'sco angers': 493,
    'angers sco': 493,
    'havre ac': 485,
    'le havre ac': 485,
    'ogc nice': 470,
    'aj auxerre': 476,
    'fc nantes': 486,
    'fc metz': 484,
    'paris fc': 6075,
  };
  for (const [alias, id365] of Object.entries(aliases)) {
    if (id365 > 0 && lower.includes(alias)) {
      const club = LIGUE1_CLUBS_COORDS.find((c) => c.id365 === id365);
      if (club) return club;
    }
  }

  // Last-resort substring scan
  return LIGUE1_CLUBS_COORDS.find(
    (c) =>
      lower.includes(c.name.toLowerCase()) ||
      lower.includes(c.city.toLowerCase()) ||
      c.name.toLowerCase().includes(lower),
  );
}

export interface OlMatchVsClub {
  fixture: Fixture;
  isHome: boolean;
  isPast: boolean;
  outcome: 'W' | 'D' | 'L' | null;
}

/**
 * Returns OL's matches in Ligue 1 against a given club for the current season,
 * sorted chronologically (oldest first).
 */
export function olMatchesVsClub(
  fixtures: Fixture[] | undefined,
  club: Ligue1Club,
): OlMatchVsClub[] {
  if (!fixtures?.length) return [];
  const result: OlMatchVsClub[] = [];

  for (const f of fixtures) {
    if (!f.competition.toLowerCase().includes('ligue 1')) continue;

    const opp = resolveOpponentClub(f);
    if (!opp || opp.id365 !== club.id365) continue;

    const isHome = f.homeTeamId === OL_TEAM_ID;
    const isPast = f.status === 'FINISHED';
    let outcome: OlMatchVsClub['outcome'] = null;
    if (isPast && f.homeScore !== null && f.awayScore !== null) {
      const olScore = isHome ? f.homeScore : f.awayScore;
      const oppScore = isHome ? f.awayScore : f.homeScore;
      outcome = olScore > oppScore ? 'W' : olScore < oppScore ? 'L' : 'D';
    }
    result.push({ fixture: f, isHome, isPast, outcome });
  }

  return result.sort((a, b) => new Date(a.fixture.date).getTime() - new Date(b.fixture.date).getTime());
}

export interface H2HSummary {
  W: number;
  D: number;
  L: number;
}

export function computeH2H(matches: OlMatchVsClub[]): H2HSummary {
  const summary: H2HSummary = { W: 0, D: 0, L: 0 };
  for (const m of matches) {
    if (m.outcome) summary[m.outcome] += 1;
  }
  return summary;
}
