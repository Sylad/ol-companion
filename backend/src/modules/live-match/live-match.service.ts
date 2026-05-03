import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { EventBusService } from '../events/event-bus.service';
import { aggregate, summarize, LIVE_MATCH_OL_ID } from './live-match.aggregator';
import type { LiveMatchSummary, LiveMatchStats, LiveMatchChangedPayload } from './live-match.types';

const SCORES365_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'application/json',
  'Accept-Language': 'fr-FR,fr;q=0.9',
  'X-Domain': 'fr',
  'Referer': 'https://www.365scores.com/fr/football',
  'Origin': 'https://www.365scores.com',
};

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

    const raw = await this.fetch365Game(gameId, matchupId);
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
      const d = (await res.json()) as any;
      const games: any[] = d?.games ?? [];
      for (const g of games) {
        if (!statusGroups.includes(g.statusGroup)) continue;
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

  private async fetch365Game(gameId: number, matchupId: string): Promise<any> {
    const url = `https://webws.365scores.com/web/game/?appTypeId=5&langId=15&gameId=${gameId}&matchupId=${matchupId}&timezoneName=Europe/Paris&userCountryId=5`;
    const res = await fetch(url, { headers: SCORES365_HEADERS, signal: AbortSignal.timeout(10_000) });
    if (!res.ok) {
      this.logger.warn(`365 game HTTP ${res.status} for ${gameId}`);
      return null;
    }
    return res.json();
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
