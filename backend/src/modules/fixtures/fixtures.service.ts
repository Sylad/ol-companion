import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import * as fs from 'fs';
import * as path from 'path';
import { EventBusService } from '../events/event-bus.service';
import { OL_TEAM_ID, LIGUE1_FOOTBALL_DATA_ID } from '../../config/constants';

export interface Match {
  id: number;
  date: string;
  homeTeam: string;
  homeTeamId: number;
  awayTeam: string;
  awayTeamId: number;
  homeScore: number | null;
  awayScore: number | null;
  competition: string;
  status: 'SCHEDULED' | 'TIMED' | 'IN_PLAY' | 'FINISHED' | 'POSTPONED';
  matchday: number | null;
}

const CACHE_TTL_MS = 3600_000;

@Injectable()
export class FixturesService implements OnModuleInit {
  private readonly logger = new Logger(FixturesService.name);
  private readonly cacheFile = path.resolve(process.cwd(), 'data', 'fixtures-cache.json');

  constructor(
    private config: ConfigService,
    private readonly bus: EventBusService,
  ) {}

  onModuleInit() {
    this.getFixtures({ force: true }).catch((err) =>
      this.logger.warn(`Initial fixtures refresh failed: ${(err as Error).message}`),
    );
  }

  @Cron('0 */30 * * * *', { name: 'fixtures-refresh', timeZone: 'Europe/Paris' })
  async scheduledRefresh() {
    await this.getFixtures({ force: true }).catch((err) =>
      this.logger.warn(`Periodic fixtures refresh failed: ${(err as Error).message}`),
    );
  }

  async getFixtures(opts: { force?: boolean } = {}): Promise<Match[]> {
    if (!opts.force) {
      const cached = this.readCache();
      if (cached) return cached;
    }

    const apiKey = this.config.get<string>('footballApiKey');
    if (!apiKey) return [];

    try {
      // Two separate calls — football-data v4 only accepts one status at a time
      const [finished, scheduled] = await Promise.all([
        this.fetchMatches(apiKey, 'FINISHED', 20),
        this.fetchMatches(apiKey, 'SCHEDULED', 10),
      ]);

      // Free tier doesn't return scheduled team matches — fallback via competition endpoint
      const scheduledMatches = scheduled.length > 0
        ? scheduled
        : await this.fetchUpcomingFromCompetition(apiKey);

      const matches = [...finished, ...scheduledMatches].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      const previous = this.readCacheRaw();
      this.writeCache(matches);
      if (this.fixturesChanged(previous, matches)) {
        this.bus.emit('fixtures-changed', { count: matches.length });
      }
      return matches;
    } catch (err) {
      this.logger.error('Erreur fetch fixtures', err);
      return [];
    }
  }

  private async fetchUpcomingFromCompetition(apiKey: string): Promise<Match[]> {
    // Try the next 3 matchdays starting from an estimate
    const now = new Date();
    // Fetch current matchday from standings cache if available
    let startMatchday = 30;
    try {
      const standingsCachePath = path.resolve(process.cwd(), 'data', 'standings-cache.json');
      if (fs.existsSync(standingsCachePath)) {
        const { data } = JSON.parse(fs.readFileSync(standingsCachePath, 'utf-8'));
        startMatchday = (data?.currentMatchday ?? 30) + 1;
      }
    } catch (err: unknown) {
      this.logger.warn(`Failed to read standings cache for matchday hint: ${(err as Error)?.message ?? err}`);
    }

    const matchdays = [startMatchday, startMatchday + 1, startMatchday + 2];
    for (const md of matchdays) {
      try {
        const url = `https://api.football-data.org/v4/competitions/${LIGUE1_FOOTBALL_DATA_ID}/matches?matchday=${md}`;
        const res = await fetch(url, {
          headers: { 'X-Auth-Token': apiKey },
          signal: AbortSignal.timeout(10_000),
        });
        if (!res.ok) continue;
        const data = await res.json() as any;
        const olMatch = (data.matches ?? []).find(
          (m: any) => m.homeTeam?.id === OL_TEAM_ID || m.awayTeam?.id === OL_TEAM_ID
        );
        if (olMatch && new Date(olMatch.utcDate) > now) {
          this.logger.log(`Prochain match OL trouvé via compétition J${md}: ${olMatch.homeTeam.shortName} vs ${olMatch.awayTeam.shortName}`);
          return [{
            id: olMatch.id,
            date: olMatch.utcDate,
            homeTeam: olMatch.homeTeam.name ?? olMatch.homeTeam.shortName,
            homeTeamId: olMatch.homeTeam.id,
            awayTeam: olMatch.awayTeam.name ?? olMatch.awayTeam.shortName,
            awayTeamId: olMatch.awayTeam.id,
            homeScore: olMatch.score?.fullTime?.home ?? null,
            awayScore: olMatch.score?.fullTime?.away ?? null,
            competition: olMatch.competition?.name ?? 'Ligue 1',
            status: olMatch.status,
            matchday: olMatch.matchday ?? md,
          }];
        }
      } catch (err) {
        this.logger.warn(`Competition matchday ${md} fetch failed: ${(err as Error).message}`);
      }
    }
    return [];
  }

  private async fetchMatches(apiKey: string, status: string, limit: number): Promise<Match[]> {
    const url = `https://api.football-data.org/v4/teams/${OL_TEAM_ID}/matches?status=${status}&limit=${limit}`;
    const res = await fetch(url, {
      headers: { 'X-Auth-Token': apiKey },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      this.logger.warn(`fixtures?status=${status} → HTTP ${res.status}`);
      return [];
    }
    const data = await res.json() as any;
    return (data.matches ?? []).map((m: any) => ({
      id: m.id,
      date: m.utcDate,
      homeTeam: m.homeTeam.name ?? m.homeTeam.shortName,
      homeTeamId: m.homeTeam.id,
      awayTeam: m.awayTeam.name ?? m.awayTeam.shortName,
      awayTeamId: m.awayTeam.id,
      homeScore: m.score?.fullTime?.home ?? null,
      awayScore: m.score?.fullTime?.away ?? null,
      competition: m.competition?.name ?? '',
      status: m.status,
      matchday: m.matchday ?? null,
    }));
  }

  private readCache(): Match[] | null {
    if (!fs.existsSync(this.cacheFile)) return null;
    try {
      const { ts, data } = JSON.parse(fs.readFileSync(this.cacheFile, 'utf-8'));
      if (Date.now() - ts < CACHE_TTL_MS) return data;
    } catch (err: unknown) {
      this.logger.warn(`Failed to read fixtures cache ${this.cacheFile}: ${(err as Error)?.message ?? err}`);
    }
    return null;
  }

  private readCacheRaw(): Match[] | null {
    if (!fs.existsSync(this.cacheFile)) return null;
    try {
      const { data } = JSON.parse(fs.readFileSync(this.cacheFile, 'utf-8'));
      return data;
    } catch (err: unknown) {
      this.logger.warn(`Failed to read fixtures cache (raw) ${this.cacheFile}: ${(err as Error)?.message ?? err}`);
      return null;
    }
  }

  private writeCache(data: Match[]): void {
    fs.mkdirSync(path.dirname(this.cacheFile), { recursive: true });
    fs.writeFileSync(this.cacheFile, JSON.stringify({ ts: Date.now(), data }));
  }

  private fixturesChanged(prev: Match[] | null, next: Match[]): boolean {
    if (!prev || prev.length !== next.length) return true;
    for (let i = 0; i < next.length; i++) {
      const p = prev[i], n = next[i];
      if (p.id !== n.id || p.status !== n.status || p.homeScore !== n.homeScore || p.awayScore !== n.awayScore || p.date !== n.date) {
        return true;
      }
    }
    return false;
  }
}
