import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import * as fs from 'fs';
import * as path from 'path';
import { atomicWriteJsonSync } from '../../common/atomic-write';
import { EventBusService } from '../events/event-bus.service';
import { LIGUE1_365SCORES_ID, OL_365SCORES_ID, OL_TEAM_ID } from '../../config/constants';
import { scores365Headers, SCORES365_API_BASE, SCORES365_REFERER } from '../../config/scores365-http';
import {
  compareLfp,
  computeOlRankingsByRound,
  fetchLeagueResults,
  type LeagueGame,
  type OlSeasonRanking,
} from './season-rankings';
import { describeClubsResolvedFromGames, readScores365Standings } from './scores365-standings';

export type FormOutcome = 'W' | 'D' | 'L';

export interface StandingEntry {
  position: number; team: string; teamId: number; played: number;
  won: number; draw: number; lost: number;
  goalsFor: number; goalsAgainst: number; goalDifference: number; points: number;
  recentForm?: FormOutcome[];
  trend?: number;
}
export interface SeasonStandings {
  season: string; updatedAt: string; currentMatchday: number; table: StandingEntry[];
  /** Posé seulement quand 365scores est en panne et que la réponse est la dernière copie connue, périmée (L34). */
  stale?: boolean;
  /** Date ISO de cette copie (dernier appel réussi) ; présent avec `stale`. */
  cachedAt?: string;
}

/**
 * Classement selon l'ordre de départage officiel LFP, le MÊME que celui du tracker de
 * saison : `compareLfp` (season-rankings.ts) — points, différence de buts, confrontations
 * directes (lues dans `games`, les résultats de la Ligue 1), buts marqués, victoires,
 * victoires à l'extérieur. Les victoires à l'extérieur ne figurent pas dans une ligne du
 * classement : elles valent 0 ici (critère 6 sans effet). Sans `games`, les confrontations
 * directes ne départagent personne. `idOf` donne l'identifiant 365scores d'une ligne,
 * celui des résultats ; égalité totale : ordre d'entrée conservé.
 */
export function sortByLfpRules<
  T extends Pick<StandingEntry, 'teamId' | 'points' | 'goalDifference' | 'goalsFor'> & { won?: number },
>(rows: T[], games: LeagueGame[] = [], idOf: (row: T) => number = (r) => r.teamId): T[] {
  const stats = rows.map((r) => ({
    row: r,
    lfp: { id: idOf(r), points: r.points, goalDifference: r.goalDifference, goalsFor: r.goalsFor, wins: r.won ?? 0, awayWins: 0 },
  }));
  const table = stats.map((s) => s.lfp);
  return stats
    .sort((a, b) => compareLfp(games, Infinity, table, b.lfp, a.lfp))
    .map((s) => s.row);
}

/**
 * "Current matchday" = the most common played-count across the league.
 *
 * Why not `max(played)` ? Because rescheduled fixtures regularly leave one
 * team a game ahead of the rest (e.g. 2026-05-10 snapshot: Nantes played
 * MD33 while every other club was finishing MD32 — including OL). Using
 * `max` returned `currentMatchday = 33` and made `roundComplete` (which
 * gates `season-rankings.json` writes) impossible to satisfy until every
 * single club had also played MD33, freezing the position tracker on MD31
 * even though OL had clearly closed MD32 in 3rd place.
 *
 * Mode is robust to up to ~7 outliers in either direction (it just needs
 * one cohort to be the largest). For the stable case `min === max`, mode
 * still equals max — we don't regress on round-aligned snapshots.
 */
export function computeCurrentMatchday(playedCounts: number[]): number {
  if (playedCounts.length === 0) return 0;
  const tally = new Map<number, number>();
  for (const p of playedCounts) tally.set(p, (tally.get(p) ?? 0) + 1);
  let bestCount = -1;
  let bestPlayed = 0;
  for (const [played, count] of tally) {
    // Tie-break: prefer the higher played value (more recent matchday).
    if (count > bestCount || (count === bestCount && played > bestPlayed)) {
      bestCount = count;
      bestPlayed = played;
    }
  }
  return bestPlayed;
}

export interface HistoryEntry { season: string; finalPosition: number; points: number; }

const CACHE_TTL_MS = 3600_000;
const HISTORY_FILE = path.resolve(process.cwd(), 'data', 'standings-history.json');
const SEASON_FILE = path.resolve(process.cwd(), 'data', 'season-rankings.json');

const SCORES365_HEADERS = scores365Headers(SCORES365_REFERER.ligue1);

@Injectable()
export class StandingsService implements OnModuleInit {
  private readonly logger = new Logger(StandingsService.name);
  private readonly cacheFile = path.resolve(process.cwd(), 'data', 'standings-cache.json');

  constructor(private readonly bus: EventBusService) {}

  onModuleInit() {
    this.ensureHistoryFile();
    this.getCurrentStandings({ force: true }).catch((err) =>
      this.logger.warn(`Initial standings refresh failed: ${(err as Error).message}`),
    );
  }

  @Cron('0 0 * * * *', { name: 'standings-refresh', timeZone: 'Europe/Paris' })
  async scheduledRefresh() {
    await this.getCurrentStandings({ force: true }).catch((err) =>
      this.logger.warn(`Periodic standings refresh failed: ${(err as Error).message}`),
    );
  }

  async getCurrentStandings(opts: { force?: boolean } = {}): Promise<SeasonStandings | null> {
    if (!opts.force) {
      const cached = this.readCache();
      if (cached) return cached;
    }

    // Une panne de 365scores ne retire pas le classement : dernière copie connue, avec son âge (L34).
    return (await this.fetchCurrent()) ?? this.readStale();
  }

  private async fetchCurrent(): Promise<SeasonStandings | null> {
    try {
      const url = `${SCORES365_API_BASE}/web/standings/?appTypeId=5&langId=1&timezoneName=Europe/Paris&userCountryId=75&competitions=${LIGUE1_365SCORES_ID}`;
      const res = await fetch(url, { headers: SCORES365_HEADERS, signal: AbortSignal.timeout(10_000) });
      if (!res.ok) {
        this.logger.warn(`365scores standings → HTTP ${res.status}`);
        return null;
      }
      // Lecture partagée avec le mini-classement du direct : les lignes en
      // sortent toutes avec leur club, ou pas de classement du tout.
      const reading = readScores365Standings(await res.json(), '365scores standings');
      if (!reading.ok) {
        // 200 sans classement exploitable (enveloppe vide, ligne sans club
        // qu'on ne sait pas attribuer) : on le dit, ce cas était muet.
        this.logger.warn(`365scores standings → no table: ${reading.reason}`);
        return null;
      }
      const { data, rows } = reading;
      if (reading.resolvedFromGames.length > 0) {
        this.logger.warn(
          `365scores standings: ${reading.resolvedFromGames.length} of ${rows.length} rows came without competitor, ` +
            `club restored from the row's games (${describeClubsResolvedFromGames(reading.resolvedFromGames)})`,
        );
      }

      const seasonName = data.competitions?.[0]?.seasons
        ?.find((s) => s.num === reading.seasonNum)?.name;
      const season = seasonName?.split('/')[0] ?? new Date().getFullYear().toString();
      const playedCounts = rows.map((r) => r.gamePlayed ?? 0);
      const currentMatchday = computeCurrentMatchday(playedCounts);

      // Résultats de toute la Ligue 1 : confrontations directes du départage et tracker.
      const games =
        reading.seasonNum !== undefined ? await fetchLeagueResults(fetch, reading.seasonNum, LIGUE1_365SCORES_ID) : null;

      const mappedRows: StandingEntry[] = rows.map((r) => {
        const c = r.competitor;
        const gf = r.for ?? 0;
        const ga = r.against ?? 0;
        const recentForm: FormOutcome[] | undefined = r.recentForm
          ? r.recentForm
              .map((o) => (o === 1 ? 'W' : o === 2 ? 'D' : o === 0 ? 'L' : null))
              .filter((x): x is FormOutcome => x !== null)
          : undefined;
        return {
          position: r.position,
          team: c.name ?? c.symbolicName ?? 'Inconnu',
          teamId: c.id === OL_365SCORES_ID ? OL_TEAM_ID : c.id,
          played: r.gamePlayed ?? 0,
          won: r.gamesWon ?? 0,
          draw: r.gamesEven ?? 0,
          lost: r.gamesLost ?? 0,
          goalsFor: gf,
          goalsAgainst: ga,
          goalDifference: typeof r.ratio === 'number' ? r.ratio : gf - ga,
          points: r.points ?? 0,
          recentForm,
          trend: typeof r.trend === 'number' ? r.trend : 0,
        };
      });

      // Defence in depth — re-apply the official LFP tie-break order (same function as the
      // season tracker) and re-number positions, so 1..18 stay deterministic on our side
      // even if 365scores drifts. Without league results, head-to-head cannot apply.
      const sorted = sortByLfpRules(mappedRows, games ?? [], (r) =>
        r.teamId === OL_TEAM_ID ? OL_365SCORES_ID : r.teamId,
      ).map((row, idx) => ({
        ...row,
        position: idx + 1,
      }));

      const result: SeasonStandings = {
        season,
        updatedAt: new Date().toISOString(),
        currentMatchday,
        table: sorted,
      };

      const previous = this.readCache();
      this.writeCache(result);
      this.updateHistory(result);
      this.refreshSeasonRankings(games);
      if (this.standingsTableChanged(previous, result)) {
        this.bus.emit('standings-changed', { currentMatchday: result.currentMatchday });
      }
      return result;
    } catch (err) {
      this.logger.error('Erreur fetch standings 365scores', err);
      return null;
    }
  }

  getSeasonRankings(): OlSeasonRanking[] {
    if (!fs.existsSync(SEASON_FILE)) return [];
    try {
      return JSON.parse(fs.readFileSync(SEASON_FILE, 'utf-8'));
    } catch (err: unknown) {
      this.logger.warn(`Failed to read ${SEASON_FILE}: ${(err as Error)?.message ?? err}`);
      return [];
    }
  }

  getHistory(): HistoryEntry[] {
    try {
      return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8')) as HistoryEntry[];
    } catch (err: unknown) {
      const e = err as NodeJS.ErrnoException;
      if (e?.code !== 'ENOENT') {
        this.logger.warn(`Failed to read ${HISTORY_FILE}: ${e?.message ?? err}`);
      }
      return [];
    }
  }

  /**
   * L241 — recalcule la position de l'OL à la fin de chaque journée depuis les
   * résultats de toute la Ligue 1 et réécrit `season-rankings.json` s'il change.
   * Un appel 365scores en échec ou sans match laisse le fichier tel quel.
   */
  private refreshSeasonRankings(games: LeagueGame[] | null): void {
    if (!games) {
      this.logger.warn('Season rankings: league results unavailable, tracker kept as is');
      return;
    }
    const rankings = computeOlRankingsByRound(games, OL_365SCORES_ID);
    const current = this.getSeasonRankings();
    if (JSON.stringify(current) === JSON.stringify(rankings)) return;
    atomicWriteJsonSync(SEASON_FILE, rankings);
    this.bus.emit('season-rankings-changed', { matchdays: rankings.length });
  }

  private standingsTableChanged(prev: SeasonStandings | null, next: SeasonStandings): boolean {
    if (!prev || prev.table.length !== next.table.length) return true;
    for (let i = 0; i < next.table.length; i++) {
      const p = prev.table[i], n = next.table[i];
      if (p.teamId !== n.teamId || p.position !== n.position || p.points !== n.points || p.played !== n.played) {
        return true;
      }
    }
    return false;
  }

  private updateHistory(standings: SeasonStandings): void {
    const olEntry = standings.table.find(e => e.teamId === OL_TEAM_ID);
    if (!olEntry) return;
    const history = this.getHistory();
    const idx = history.findIndex(h => h.season === standings.season);
    const entry: HistoryEntry = { season: standings.season, finalPosition: olEntry.position, points: olEntry.points };
    if (idx >= 0) history[idx] = entry; else history.push(entry);
    history.sort((a, b) => a.season.localeCompare(b.season));
    atomicWriteJsonSync(HISTORY_FILE, history);
  }

  private ensureHistoryFile(): void {
    if (!fs.existsSync(HISTORY_FILE)) {
      const seed: HistoryEntry[] = [
        { season: '2019', finalPosition: 7, points: 57 },
        { season: '2020', finalPosition: 4, points: 58 },
        { season: '2021', finalPosition: 8, points: 55 },
        { season: '2022', finalPosition: 8, points: 52 },
        { season: '2023', finalPosition: 6, points: 52 },
        { season: '2024', finalPosition: 6, points: 55 },
      ];
      atomicWriteJsonSync(HISTORY_FILE, seed);
    }
  }

  private readCache(): SeasonStandings | null {
    const entry = this.readEntry();
    return entry && Date.now() - entry.ts < CACHE_TTL_MS ? entry.data : null;
  }

  /** Copie quel que soit son âge, marquée périmée et datée : le repli d'une panne de 365scores (L34). */
  private readStale(): SeasonStandings | null {
    const entry = this.readEntry();
    if (!entry) return null;
    const cachedAt = new Date(entry.ts).toISOString();
    this.logger.warn(`Classement : 365scores indisponible, copie du ${cachedAt} servie`);
    return { ...entry.data, stale: true, cachedAt };
  }

  private readEntry(): { ts: number; data: SeasonStandings } | null {
    if (!fs.existsSync(this.cacheFile)) return null;
    try {
      const { ts, data } = JSON.parse(fs.readFileSync(this.cacheFile, 'utf-8'));
      if (typeof ts === 'number' && data) return { ts, data };
    } catch (err: unknown) {
      this.logger.warn(`Failed to read standings cache ${this.cacheFile}: ${(err as Error)?.message ?? err}`);
    }
    return null;
  }

  private writeCache(data: SeasonStandings): void {
    atomicWriteJsonSync(this.cacheFile, { ts: Date.now(), data });
  }
}
