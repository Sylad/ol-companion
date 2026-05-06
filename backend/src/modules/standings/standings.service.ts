import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import * as fs from 'fs';
import * as path from 'path';
import { EventBusService } from '../events/event-bus.service';
import { LIGUE1_365SCORES_ID, OL_365SCORES_ID, OL_TEAM_ID } from '../../config/constants';
import { scores365Headers, SCORES365_REFERER } from '../../config/scores365-http';
import { parseExternal } from '../../common/zod-validation.pipe';
import { Scores365StandingsResponseSchema } from './standings.schema';

export type FormOutcome = 'W' | 'D' | 'L';

export interface StandingEntry {
  position: number; team: string; teamId: number; played: number;
  won: number; draw: number; lost: number;
  goalsFor: number; goalsAgainst: number; goalDifference: number; points: number;
  recentForm?: FormOutcome[];
  trend?: number;
}
export interface SeasonStandings { season: string; updatedAt: string; currentMatchday: number; table: StandingEntry[]; }

/**
 * LFP tie-break rules (https://ligue1.com — art 2160):
 *   1. points (desc)
 *   2. goal difference (desc)
 *   3. goals for (desc)
 * H2H criteria (4. and 5.) not enforced here — head-to-head requires per-match
 * data we don't have at the standings level. 365scores already returns the
 * official LFP order for those edge cases; the three criteria below match
 * 100% of the snapshots audited 2026-04 → 2026-05. This is a defence-in-depth
 * pass that re-asserts the basic ordering and makes the service deterministic
 * regardless of how 365scores happens to rank rows on a given day.
 */
export function sortByLfpRules<T extends Pick<StandingEntry, 'points' | 'goalDifference' | 'goalsFor'>>(
  rows: T[],
): T[] {
  return [...rows].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
    return 0;
  });
}
export interface HistoryEntry { season: string; finalPosition: number; points: number; }
export interface OlSeasonRanking { matchday: number; position: number; points: number; }

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

    try {
      const url = `https://data.365scores.com/web/standings/?appTypeId=5&langId=1&timezoneName=Europe/Paris&userCountryId=75&competitions=${LIGUE1_365SCORES_ID}`;
      const res = await fetch(url, { headers: SCORES365_HEADERS, signal: AbortSignal.timeout(10_000) });
      if (!res.ok) {
        this.logger.warn(`365scores standings → HTTP ${res.status}`);
        return null;
      }
      const data = parseExternal(Scores365StandingsResponseSchema, await res.json(), '365scores standings');
      const block = data.standings?.find((s) => s.isCurrentStage) ?? data.standings?.[0];
      if (!block?.rows?.length) return null;

      const seasonName = data.competitions?.[0]?.seasons
        ?.find((s) => s.num === block.seasonNum)?.name;
      const season = seasonName?.split('/')[0] ?? new Date().getFullYear().toString();
      const playedCounts = block.rows.map((r) => r.gamePlayed ?? 0);
      const currentMatchday = Math.max(0, ...playedCounts);
      const minPlayed = Math.min(...playedCounts);
      const roundComplete = minPlayed === currentMatchday;

      const mappedRows: StandingEntry[] = block.rows.map((r) => {
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

      // Defence in depth — re-apply LFP tie-break rules (points, GD, goals for)
      // and re-number positions. Audit 2026-05-06 confirmed 365scores serves
      // the correct LFP order, but we don't trust an external feed for the
      // ordering of our flagship table. If 365scores ever drifts (or ties go
      // to head-to-head), positions 1..18 stay deterministic on our side.
      const sorted = sortByLfpRules(mappedRows).map((row, idx) => ({
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
      if (roundComplete) {
        this.updateSeasonRankings(result);
      } else {
        this.logger.log(`Skip season-rankings update: round ${currentMatchday} not complete (min=${minPlayed})`);
      }
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

  private updateSeasonRankings(standings: SeasonStandings): void {
    const ol = standings.table.find(e => e.teamId === OL_TEAM_ID);
    if (!ol || !standings.currentMatchday) return;
    const rankings = this.getSeasonRankings();
    const idx = rankings.findIndex(r => r.matchday === standings.currentMatchday);
    const existing = idx >= 0 ? rankings[idx] : null;
    const entry: OlSeasonRanking = {
      matchday: standings.currentMatchday,
      position: ol.position,
      points: ol.points,
    };
    if (existing && existing.position === entry.position && existing.points === entry.points) {
      return;
    }
    if (idx >= 0) rankings[idx] = entry; else rankings.push(entry);
    rankings.sort((a, b) => a.matchday - b.matchday);
    fs.mkdirSync(path.dirname(SEASON_FILE), { recursive: true });
    fs.writeFileSync(SEASON_FILE, JSON.stringify(rankings, null, 2));
    this.bus.emit('season-rankings-changed', entry);
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
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
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
      fs.mkdirSync(path.dirname(HISTORY_FILE), { recursive: true });
      fs.writeFileSync(HISTORY_FILE, JSON.stringify(seed, null, 2));
    }
  }

  private readCache(): SeasonStandings | null {
    if (!fs.existsSync(this.cacheFile)) return null;
    try {
      const { ts, data } = JSON.parse(fs.readFileSync(this.cacheFile, 'utf-8'));
      if (Date.now() - ts < CACHE_TTL_MS) return data;
    } catch (err: unknown) {
      this.logger.warn(`Failed to read standings cache ${this.cacheFile}: ${(err as Error)?.message ?? err}`);
    }
    return null;
  }

  private writeCache(data: SeasonStandings): void {
    fs.mkdirSync(path.dirname(this.cacheFile), { recursive: true });
    fs.writeFileSync(this.cacheFile, JSON.stringify({ ts: Date.now(), data }));
  }
}
