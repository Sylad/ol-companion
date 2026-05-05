import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { EventBusService } from '../events/event-bus.service';
import { aggregate, summarize, LIVE_MATCH_OL_ID } from './live-match.aggregator';
import type { LiveMatchSummary, LiveMatchStats, LiveMatchChangedPayload } from './live-match.types';
import { scores365Headers } from '../../config/scores365-http';
import {
  Scores365GameDetailResponseSchema,
  Scores365GamesResponseSchema,
  type Scores365GameDetailResponse,
} from '../../config/scores365-game.schema';
import { parseExternal } from '../../common/zod-validation.pipe';

const SCORES365_HEADERS = scores365Headers();

const POST_MATCH_WINDOW_MS = 2 * 3600_000; // expose stats up to 2h after final whistle

interface CachedStats {
  payload: LiveMatchStats;
  fetchedAt: number;
}

@Injectable()
export class LiveMatchService implements OnModuleInit {
  private readonly logger = new Logger(LiveMatchService.name);
  private cachedCurrent: LiveMatchSummary | null = null;
  private cachedCurrentAt = 0;
  private readonly cachedStatsByGame = new Map<number, CachedStats>();
  private lastDiffSignature = '';

  constructor(private readonly bus: EventBusService) {}

  onModuleInit() {
    this.refreshCurrent().catch((err) =>
      this.logger.warn(`Initial live-match refresh failed: ${(err as Error).message}`),
    );
  }

  /**
   * Returns the current OL match summary if one is live or recently ended (< 2h),
   * otherwise null.
   */
  async getCurrent({ force = false }: { force?: boolean } = {}): Promise<LiveMatchSummary | null> {
    if (!force && Date.now() - this.cachedCurrentAt < 30_000) {
      return this.cachedCurrent;
    }
    return this.refreshCurrent();
  }

  /**
   * Returns the full stats payload for a given game. Caches based on status:
   * 5s for live, 15s for upcoming, 60s for ended.
   */
  async getStats(gameId: number, matchupId: string, { force = false } = {}): Promise<LiveMatchStats | null> {
    const cached = this.cachedStatsByGame.get(gameId);
    const ttl = ttlForStatus(cached?.payload.status);
    if (!force && cached && Date.now() - cached.fetchedAt < ttl) {
      return cached.payload;
    }

    const raw = await this.fetch365GameDetail(gameId, matchupId);
    if (!raw?.game) {
      this.logger.warn(`No game data from 365scores for ${gameId} (matchupId=${matchupId})`);
      return cached?.payload ?? null;
    }

    let payload: LiveMatchStats;
    try {
      payload = aggregate(raw);
    } catch (err) {
      this.logger.warn(`Could not aggregate game ${gameId}: ${(err as Error).message}`);
      return cached?.payload ?? null;
    }

    this.cachedStatsByGame.set(gameId, { payload, fetchedAt: Date.now() });
    return payload;
  }

  @Cron('*/30 * * * * *', { name: 'live-match-poll', timeZone: 'Europe/Paris' })
  async pollLiveMatch() {
    if (this.shouldSkipPoll()) return;
    try {
      const current = await this.refreshCurrent();
      if (!current) return;
      // Only poll detailed stats for live or just-ended matches.
      const isLive = current.statusGroup === 3;
      const isJustEnded = current.statusGroup === 4 && this.withinPostMatchWindow(current);
      if (!isLive && !isJustEnded) return;

      const stats = await this.getStats(current.gameId, current.matchupId, { force: true });
      if (!stats) return;

      const sig = signatureOf(stats);
      if (sig !== this.lastDiffSignature) {
        this.lastDiffSignature = sig;
        const payload: LiveMatchChangedPayload = { gameId: stats.gameId, matchupId: stats.matchupId };
        this.bus.emit('live-match-changed', payload);
        this.logger.log(`live-match-changed emitted (${stats.gameTimeDisplay} ${stats.home.name} ${stats.home.score ?? '-'} - ${stats.away.score ?? '-'} ${stats.away.name})`);
      }
    } catch (err) {
      this.logger.warn(`pollLiveMatch failed: ${(err as Error).message}`);
    }
  }

  /**
   * Throttle the cron to spare 365scores from useless traffic.
   *
   * - **Night** (02:00-08:00 Europe/Paris) : OL never plays then — hard skip.
   * - **No match in sight** : throttle full refresh to once every 15 min instead
   *   of every 30 s. We still detect new matches at most 15 min late.
   * - **Upcoming match more than 3 h away** : throttle to once every 5 min.
   *
   * Live or just-ended matches keep the 30 s cadence.
   */
  private shouldSkipPoll(): boolean {
    if (this.isNightTimeParis()) return true;

    const sinceLastRefresh = Date.now() - this.cachedCurrentAt;
    const current = this.cachedCurrent;

    // No current/upcoming match known → throttle to 15 min between full refreshes.
    if (!current) {
      return sinceLastRefresh < 15 * 60_000;
    }

    // Upcoming match more than 3 h away → throttle to 5 min.
    const isUpcoming = current.statusGroup === 1 || current.statusGroup === 2;
    if (isUpcoming) {
      const minsToKickoff = (new Date(current.startTime).getTime() - Date.now()) / 60_000;
      if (minsToKickoff > 180) return sinceLastRefresh < 5 * 60_000;
    }

    // Live, just-ended, or kickoff within 3 h → full 30 s cadence.
    return false;
  }

  private isNightTimeParis(): boolean {
    const hourStr = new Intl.DateTimeFormat('fr-FR', {
      hour: 'numeric',
      hourCycle: 'h23',
      timeZone: 'Europe/Paris',
    }).format(new Date());
    const hour = parseInt(hourStr, 10);
    return hour >= 2 && hour < 8;
  }

  private async refreshCurrent(): Promise<LiveMatchSummary | null> {
    const summary = await this.findCurrentOlMatch();
    this.cachedCurrent = summary;
    this.cachedCurrentAt = Date.now();
    return summary;
  }

  private async findCurrentOlMatch(): Promise<LiveMatchSummary | null> {
    // 1) Live OL match (results endpoint includes only finished, not ideal — use the date-based one).
    // 365scores exposes live games filtered by competitor; fallback to allscores otherwise.
    const liveUrl = `https://data.365scores.com/web/games/?appTypeId=5&langId=15&timezoneName=Europe/Paris&userCountryId=5&onlyLiveGames=true&competitors=${LIVE_MATCH_OL_ID}`;
    let candidate = await this.findCandidate(liveUrl, [3]);
    if (candidate) return candidate;

    // 2) Recently ended OL match (last result, only keep if < 2h since kick-off).
    const recentUrl = `https://data.365scores.com/web/games/results/?appTypeId=5&langId=15&timezoneName=Europe/Paris&userCountryId=5&competitors=${LIVE_MATCH_OL_ID}&limit=1`;
    candidate = await this.findCandidate(recentUrl, [4], { onlyRecent: true });
    if (candidate) return candidate;

    // 3) Next upcoming OL match (within 24h).
    const upcomingUrl = `https://data.365scores.com/web/games/fixtures/?appTypeId=5&langId=15&timezoneName=Europe/Paris&userCountryId=5&competitors=${LIVE_MATCH_OL_ID}&limit=1`;
    candidate = await this.findCandidate(upcomingUrl, [1, 2], { onlyUpcoming: true });
    return candidate;
  }

  private async findCandidate(
    url: string,
    statusGroups: number[],
    opts: { onlyRecent?: boolean; onlyUpcoming?: boolean } = {},
  ): Promise<LiveMatchSummary | null> {
    try {
      const res = await fetch(url, { headers: SCORES365_HEADERS, signal: AbortSignal.timeout(8_000) });
      if (!res.ok) return null;
      const d = parseExternal(Scores365GamesResponseSchema, await res.json(), '365scores live-match candidate');
      for (const g of d.games ?? []) {
        if (g.statusGroup === undefined || !statusGroups.includes(g.statusGroup)) continue;
        const summary = summarize(g);
        if (opts.onlyRecent && !this.withinPostMatchWindow(summary)) continue;
        if (opts.onlyUpcoming && !this.withinUpcomingWindow(summary)) continue;
        return summary;
      }
    } catch (err) {
      this.logger.warn(`findCandidate ${url} failed: ${(err as Error).message}`);
    }
    return null;
  }

  private withinPostMatchWindow(summary: LiveMatchSummary): boolean {
    const start = new Date(summary.startTime).getTime();
    if (!Number.isFinite(start)) return false;
    // Approximate match end at start + 2h (90 min + extra time + post-match buffer)
    const approxEnd = start + 2 * 3600_000;
    return Date.now() - approxEnd < POST_MATCH_WINDOW_MS;
  }

  private withinUpcomingWindow(summary: LiveMatchSummary): boolean {
    const start = new Date(summary.startTime).getTime();
    if (!Number.isFinite(start)) return false;
    const delta = start - Date.now();
    return delta > 0 && delta < 24 * 3600_000;
  }

  private async fetch365GameDetail(
    gameId: number,
    matchupId: string,
  ): Promise<Scores365GameDetailResponse | null> {
    const url = `https://webws.365scores.com/web/game/?appTypeId=5&langId=15&gameId=${gameId}&matchupId=${matchupId}&timezoneName=Europe/Paris&userCountryId=5`;
    const res = await fetch(url, { headers: SCORES365_HEADERS, signal: AbortSignal.timeout(10_000) });
    if (!res.ok) {
      this.logger.warn(`365 game HTTP ${res.status} for ${gameId}`);
      return null;
    }
    try {
      const json = await res.json();
      return parseExternal(Scores365GameDetailResponseSchema, json, '365scores game detail');
    } catch (err) {
      // Schema drift on 365scores → log and degrade gracefully instead of crashing.
      this.logger.warn(`365 game payload validation failed for ${gameId}: ${(err as Error).message}`);
      return null;
    }
  }
}

function ttlForStatus(status?: 'live' | 'ended' | 'upcoming'): number {
  if (status === 'live') return 5_000;
  if (status === 'ended') return 60_000;
  return 30_000;
}

function signatureOf(s: LiveMatchStats): string {
  // Concise signature to detect meaningful changes (score, gameTime, events, status).
  return [
    s.statusGroup,
    s.home.score,
    s.away.score,
    Math.floor(s.gameTime),
    s.events.length,
    s.shots.length,
  ].join('|');
}
