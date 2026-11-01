import { SCORES365_API_BASE, scores365Headers, SCORES365_REFERER } from '../../config/scores365-http';

/**
 * L241 — position de l'OL à la fin de chaque journée de Ligue 1, recalculée
 * depuis les résultats de TOUS les clubs.
 *
 * Avant, `season-rankings.json` gardait la position de l'OL lue dans le
 * classement du moment, dès que 14 clubs sur 18 avaient le même nombre de
 * matchs : une photo prise en pleine journée, réécrite à chaque heure tant que
 * l'OL n'avait pas rejoué. J7 affichait 4e (relevé quand l'OL avait joué 7
 * matchs et que les autres en avaient déjà 8) alors que l'OL était 1er à l'issue
 * de la J7 (Lyon 14 pts, +8).
 */

export interface OlSeasonRanking { matchday: number; position: number; points: number; }

export interface LeagueGame {
  roundNum: number;
  statusGroup: number;
  home: { id: number; score: number };
  away: { id: number; score: number };
}

type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

const FINISHED = 4; // statusGroup 365scores d'un match terminé
const MAX_PAGES = 40;
const HEADERS = scores365Headers(SCORES365_REFERER.ligue1);

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const validScore = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0;

/** Matchs terminés de la saison `seasonNum`, avec journée et scores lisibles ; le reste est écarté. */
export function parseLeagueGames(raw: unknown, seasonNum: number): LeagueGame[] {
  if (!Array.isArray(raw)) return [];
  const out: LeagueGame[] = [];
  for (const g of raw) {
    if (!isRecord(g) || g.seasonNum !== seasonNum || g.statusGroup !== FINISHED) continue;
    const home = g.homeCompetitor;
    const away = g.awayCompetitor;
    if (!isRecord(home) || !isRecord(away)) continue;
    if (typeof g.roundNum !== 'number' || !Number.isInteger(g.roundNum) || g.roundNum < 1) continue;
    if (typeof home.id !== 'number' || typeof away.id !== 'number') continue;
    if (!validScore(home.score) || !validScore(away.score)) continue;
    out.push({
      roundNum: g.roundNum,
      statusGroup: FINISHED,
      home: { id: home.id, score: home.score },
      away: { id: away.id, score: away.score },
    });
  }
  return out;
}

interface Row { id: number; points: number; goalsFor: number; goalDifference: number; }

function tableUpTo(games: LeagueGame[], round: number): Row[] {
  const rows = new Map<number, Row>();
  const row = (id: number): Row => {
    let r = rows.get(id);
    if (!r) rows.set(id, (r = { id, points: 0, goalsFor: 0, goalDifference: 0 }));
    return r;
  };
  for (const g of games) {
    if (g.statusGroup !== FINISHED || g.roundNum > round) continue;
    for (const [side, other] of [[g.home, g.away], [g.away, g.home]] as const) {
      const r = row(side.id);
      r.goalsFor += side.score;
      r.goalDifference += side.score - other.score;
      r.points += side.score > other.score ? 3 : side.score === other.score ? 1 : 0;
    }
  }
  return [...rows.values()];
}

/** Vrai si `a` est strictement devant `b` : points, différence de buts, buts marqués (règles LFP, sans le face-à-face). */
const isAhead = (a: Row, b: Row): boolean =>
  a.points !== b.points ? a.points > b.points
    : a.goalDifference !== b.goalDifference ? a.goalDifference > b.goalDifference
      : a.goalsFor > b.goalsFor;

/**
 * Une entrée par journée où l'OL a joué son match : sa place dans le classement
 * des matchs terminés de la journée 1 à cette journée (un match joué plus tard
 * compte dans sa journée d'origine, `roundNum`). Un match de l'OL reporté ne
 * donne pas de point pour sa journée. À égalité parfaite avec d'autres clubs,
 * l'OL prend la meilleure place du groupe (cas réel : J3 et J4, Lyon et Paris FC
 * à 7 puis 8 points, +4, 6 buts).
 */
export function computeOlRankingsByRound(games: LeagueGame[], olId: number): OlSeasonRanking[] {
  const olRounds = new Set<number>();
  for (const g of games) {
    if (g.statusGroup === FINISHED && (g.home.id === olId || g.away.id === olId)) olRounds.add(g.roundNum);
  }
  return [...olRounds]
    .sort((a, b) => a - b)
    .map((matchday) => {
      const table = tableUpTo(games, matchday);
      const ol = table.find((r) => r.id === olId) as Row; // l'OL a un match terminé dans cette journée
      // Les clubs à égalité parfaite (points, différence, buts marqués) partagent la
      // meilleure place : le face-à-face, lui, n'est pas appliqué.
      return { matchday, position: 1 + table.filter((r) => isAhead(r, ol)).length, points: ol.points };
    });
}

/**
 * Tous les matchs terminés de la saison : la page des derniers résultats, puis
 * `paging.previousPage` en remontant, jusqu'à la journée 1. `null` si un appel
 * échoue ou si rien n'est lisible : l'appelant garde alors le tracé existant.
 */
export async function fetchLeagueResults(
  fetcher: Fetcher,
  seasonNum: number,
  competitionId: number,
): Promise<LeagueGame[] | null> {
  const byKey = new Map<string, LeagueGame>();
  let url: string | null =
    `${SCORES365_API_BASE}/web/games/results/?appTypeId=5&langId=1&timezoneName=Europe/Paris&userCountryId=75&competitions=${competitionId}`;
  try {
    for (let page = 0; url && page < MAX_PAGES; page++) {
      const res = await fetcher(url, { headers: HEADERS, signal: AbortSignal.timeout(10_000) });
      if (!res.ok) return null;
      const body: unknown = await res.json();
      if (!isRecord(body)) return null;
      const rawGames = Array.isArray(body.games) ? body.games : [];
      let added = 0;
      for (const g of parseLeagueGames(rawGames, seasonNum)) {
        const key = `${g.roundNum}:${g.home.id}:${g.away.id}`;
        if (!byKey.has(key)) { byKey.set(key, g); added++; }
      }
      const previous: unknown = isRecord(body.paging) ? body.paging.previousPage : undefined;
      const reachedRoundOne = [...byKey.values()].some((g) => g.roundNum === 1);
      url = added > 0 && !reachedRoundOne && typeof previous === 'string' ? `${SCORES365_API_BASE}${previous}` : null;
    }
  } catch {
    return null;
  }
  return byKey.size > 0 ? [...byKey.values()] : null;
}
