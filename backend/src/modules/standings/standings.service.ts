import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import * as fs from 'fs';
import * as path from 'path';
import { EventBusService } from '../events/event-bus.service';

export type FormOutcome = 'W' | 'D' | 'L';

export interface StandingEntry {
  position: number; team: string; teamId: number; played: number;
  won: number; draw: number; lost: number;
  goalsFor: number; goalsAgainst: number; goalDifference: number; points: number;
  recentForm?: FormOutcome[];
  trend?: number;
}
export interface SeasonStandings { season: string; updatedAt: string; currentMatchday: number; table: StandingEntry[]; }
export interface HistoryEntry { season: string; finalPosition: number; points: number; }
export interface OlSeasonRanking { matchday: number; position: number; points: number; }

const LIGUE1_365_ID = 35;
const OL_365_ID = 465;
const OL_TEAM_ID = 523; // legacy football-data id, kept for frontend compatibility
const CACHE_TTL_MS = 3600_000;
const HISTORY_FILE = path.resolve(process.cwd(), 'data', 'standings-history.json');
const SEASON_FILE = path.resolve(process.cwd(), 'data', 'season-rankings.json');

const SCORES365_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'application/json',
  'Accept-Language': 'fr-FR,fr;q=0.9',
  'X-Domain': 'fr',
  'Referer': 'https://www.365scores.com/fr/football/league/ligue-1-35',
  'Origin': 'https://www.365scores.com',
};

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
      const url = `https://data.365scores.com/web/standings/?appTypeId=5&langId=1&timezoneName=Europe/Paris&userCountryId=75&competitions=${LIGUE1_365_ID}`;
      const res = await fetch(url, { headers: SCORES365_HEADERS, signal: AbortSignal.timeout(10_000) });
      if (!res.ok) {
        this.logger.warn(`365scores standings → HTTP ${res.status}`);
        return null;
      }
      const data = await res.json() as any;
      const block = data.standings?.find((s: any) => s.isCurrentStage) ?? data.standings?.[0];
      if (!block?.rows?.length) return null;

      const seasonName: string | undefined = data.competitions?.[0]?.seasons
        ?.find((s: any) => s.num === block.seasonNum)?.name;
      const season = seasonName?.split('/')[0] ?? new Date().getFullYear().toString();
      const playedCounts = block.rows.map((r: any) => r.gamePlayed as number);
      const currentMatchday = Math.max(0, ...playedCounts);
      const minPlayed = Math.min(...playedCounts);
      const roundComplete = minPlayed === currentMatchday;

      const result: SeasonStandings = {
        season,
        updatedAt: new Date().toISOString(),
        currentMatchday,
        table: block.rows.map((r: any) => {
          const c = r.competitor;
          const gf = r.for ?? 0;
          const ga = r.against ?? 0;
          const rawForm = Array.isArray(r.recentForm) ? r.recentForm : null;
          const recentForm: FormOutcome[] | undefined = rawForm
            ? rawForm
                .map((o: number) => (o === 1 ? 'W' : o === 2 ? 'D' : o === 0 ? 'L' : null))
                .filter((x: FormOutcome | null): x is FormOutcome => x !== null)
            : undefined;
          return {
            position: r.position,
            team: c.name ?? c.symbolicName ?? 'Inconnu',
            teamId: c.id === OL_365_ID ? OL_TEAM_ID : c.id,
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
        }),
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
    try { return JSON.parse(fs.readFileSync(SEASON_FILE, 'utf-8')); } catch { return []; }
  }

  getHistory(): HistoryEntry[] {
    try { return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8')) as HistoryEntry[]; } catch { return []; }
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
    } catch {}
    return null;
  }

  private writeCache(data: SeasonStandings): void {
    fs.mkdirSync(path.dirname(this.cacheFile), { recursive: true });
    fs.writeFileSync(this.cacheFile, JSON.stringify({ ts: Date.now(), data }));
  }
}
