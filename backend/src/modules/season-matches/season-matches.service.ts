import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import * as fs from 'fs';
import * as path from 'path';
import { EventBusService } from '../events/event-bus.service';
import { getCurrentSeason } from '../scheduler/season.util';
import {
  OL_365SCORES_ID,
  OL_TEAM_ID,
  LIGUE1_365SCORES_ID,
  COUPE_DE_FRANCE_365SCORES_ID,
  EUROPA_LEAGUE_365SCORES_ID,
} from '../../config/constants';
import { scores365Headers, SCORES365_REFERER } from '../../config/scores365-http';
import { Scores365GamesResponseSchema, type Scores365Game } from '../../config/scores365-game.schema';
import { parseExternal } from '../../common/zod-validation.pipe';

/**
 * Match in a season-wide bucket. The shape mirrors the existing `Match`
 * interface used by /api/fixtures (so the frontend mapping stays familiar)
 * and adds a stable `competitionCode` discriminator the UI can switch on
 * without parsing free-form competition names.
 */
export interface SeasonMatch {
  id: number;
  date: string;
  homeTeam: string;
  homeTeamId: number;
  awayTeam: string;
  awayTeamId: number;
  homeScore: number | null;
  awayScore: number | null;
  competition: string;
  /** Stable code for the consumer (map markers L1, popup CdF section, …). */
  competitionCode: 'L1' | 'CDF' | 'UEL' | 'OTHER';
  competitionId: number;
  status: 'SCHEDULED' | 'IN_PLAY' | 'FINISHED';
  /** matchday is not exposed by 365scores results — kept for shape-compat with /api/fixtures Match */
  matchday: number | null;
}

const COMP_NAME: Record<number, string> = {
  [LIGUE1_365SCORES_ID]: 'Ligue 1',
  [COUPE_DE_FRANCE_365SCORES_ID]: 'Coupe de France',
  [EUROPA_LEAGUE_365SCORES_ID]: 'UEFA Europa League',
};

const COMP_CODE: Record<number, SeasonMatch['competitionCode']> = {
  [LIGUE1_365SCORES_ID]: 'L1',
  [COUPE_DE_FRANCE_365SCORES_ID]: 'CDF',
  [EUROPA_LEAGUE_365SCORES_ID]: 'UEL',
};

const TRACKED_COMP_IDS = new Set([
  LIGUE1_365SCORES_ID,
  COUPE_DE_FRANCE_365SCORES_ID,
  EUROPA_LEAGUE_365SCORES_ID,
]);

const CACHE_TTL_MS = 1800_000; // 30 min — FINISHED never changes, SCHEDULED rarely shifts
/**
 * Pagination depth — page 1 returns ~50 events but `paging.previousPage`
 * URLs carry `games=1` from 365scores, so each subsequent call only yields
 * ~5 events. 8 pages covers a full Ligue 1 season + cups + Europa group
 * stage starting in early August.
 */
const PAGES = 8;
const PAGE_LIMIT = 50;

const SCORES365_HEADERS = scores365Headers(SCORES365_REFERER.team);

/**
 * Fetcher type aliased so tests can swap `fetch` without DI churn.
 * (Mirrors what bracket.service.ts does with global fetch.)
 */
type Fetcher = typeof fetch;

@Injectable()
export class SeasonMatchesService implements OnModuleInit {
  private readonly logger = new Logger(SeasonMatchesService.name);
  private readonly cacheFile = path.resolve(process.cwd(), 'data', 'season-matches-cache.json');

  /** Test seam — overriden via spec, defaults to global fetch. */
  fetcher: Fetcher = (input, init) => fetch(input as any, init);

  constructor(private readonly bus: EventBusService) {}

  onModuleInit() {
    this.getMatches({ force: true }).catch((err) =>
      this.logger.warn(`Initial season-matches refresh failed: ${(err as Error).message}`),
    );
  }

  @Cron('0 */30 * * * *', { name: 'season-matches-refresh', timeZone: 'Europe/Paris' })
  async scheduledRefresh() {
    await this.getMatches({ force: true }).catch((err) =>
      this.logger.warn(`Periodic season-matches refresh failed: ${(err as Error).message}`),
    );
  }

  async getMatches(opts: { force?: boolean } = {}): Promise<SeasonMatch[]> {
    if (!opts.force) {
      const cached = this.readCache();
      if (cached) return cached;
    }

    try {
      const matches = await this.fetchFrom365Scores();
      const previous = this.readCacheRaw();
      this.writeCache(matches);
      if (this.matchesChanged(previous, matches)) {
        this.bus.emit('season-matches-changed', { count: matches.length });
      }
      return matches;
    } catch (err) {
      this.logger.error('getMatches (365scores) failed', err);
      return [];
    }
  }

  private async fetchFrom365Scores(): Promise<SeasonMatch[]> {
    const seasonStart = getCurrentSeason().startDate.getTime();
    const games = new Map<number, Scores365Game>();

    // 1. Past results + collect future-direction cursor.
    // Page 1 returns ~50 events with both `paging.previousPage` (older) and
    // `paging.nextPage` (newer). The `competitors=465` upcoming endpoint
    // mysteriously returns 0 events even when fixtures are scheduled, so we
    // walk `nextPage` as well to catch end-of-season L1 matches (Toulouse,
    // Lens, …) that haven't been played yet.
    const baseUrl = 'https://data.365scores.com/web/games';
    let url: string | null = `${baseUrl}/results/?appTypeId=5&langId=1&timezoneName=Europe/Paris&userCountryId=75&competitors=${OL_365SCORES_ID}&limit=${PAGE_LIMIT}`;
    let nextPageHref: string | null = null;

    for (let page = 0; page < PAGES && url; page++) {
      try {
        const res = await this.fetcher(url, { headers: SCORES365_HEADERS, signal: AbortSignal.timeout(10_000) });
        if (!res.ok) {
          this.logger.warn(`365scores results page ${page} → HTTP ${res.status}`);
          break;
        }
        const d = parseExternal(Scores365GamesResponseSchema, await res.json(), '365scores season results');
        const list = d.games ?? [];
        for (const g of list) games.set(g.id, g);

        // Capture forward cursor on the very first page only (subsequent
        // pages' nextPage points back into already-known events).
        if (page === 0 && d.paging?.nextPage) {
          nextPageHref = d.paging.nextPage;
        }

        // Stop paginating once we crossed the season boundary
        const oldest = list[list.length - 1];
        if (!oldest || new Date(oldest.startTime).getTime() < seasonStart) break;

        const prev = d.paging?.previousPage;
        url = prev ? `https://data.365scores.com${prev}` : null;
      } catch (err) {
        this.logger.warn(`365scores results pagination failed at page ${page}: ${(err as Error)?.message ?? err}`);
        break;
      }
    }

    // 2. Upcoming — try the standard endpoint AND walk `nextPage` from page 1.
    try {
      const upRes = await this.fetcher(
        `${baseUrl}/?appTypeId=5&langId=1&timezoneName=Europe/Paris&userCountryId=75&competitors=${OL_365SCORES_ID}&limit=20`,
        { headers: SCORES365_HEADERS, signal: AbortSignal.timeout(10_000) },
      );
      if (upRes.ok) {
        const d = parseExternal(Scores365GamesResponseSchema, await upRes.json(), '365scores season upcoming');
        for (const g of d.games ?? []) games.set(g.id, g);
      } else {
        this.logger.warn(`365scores upcoming → HTTP ${upRes.status}`);
      }
    } catch (err) {
      this.logger.warn(`365scores upcoming fetch failed: ${(err as Error)?.message ?? err}`);
    }

    // 3. Walk the forward cursor — pulls SCHEDULED matches the upcoming
    // endpoint silently drops.
    let forwardUrl: string | null = nextPageHref ? `https://data.365scores.com${nextPageHref}` : null;
    for (let page = 0; page < PAGES && forwardUrl; page++) {
      try {
        const res = await this.fetcher(forwardUrl, { headers: SCORES365_HEADERS, signal: AbortSignal.timeout(10_000) });
        if (!res.ok) {
          this.logger.warn(`365scores forward page ${page} → HTTP ${res.status}`);
          break;
        }
        const d = parseExternal(Scores365GamesResponseSchema, await res.json(), '365scores season forward');
        const list = d.games ?? [];
        if (list.length === 0) break;
        for (const g of list) games.set(g.id, g);
        const next = d.paging?.nextPage;
        forwardUrl = next ? `https://data.365scores.com${next}` : null;
      } catch (err) {
        this.logger.warn(`365scores forward pagination failed at page ${page}: ${(err as Error)?.message ?? err}`);
        break;
      }
    }

    const all = Array.from(games.values());
    this.logger.log(`365scores: ${all.length} événements OL (toutes compétitions, brut)`);

    const filtered = all.filter((g) => {
      if (g.competitionId === undefined || !TRACKED_COMP_IDS.has(g.competitionId)) return false;
      return new Date(g.startTime).getTime() >= seasonStart;
    });

    const matches = filtered
      .map((g) => this.toSeasonMatch(g))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const counts = matches.reduce<Record<string, number>>((acc, m) => {
      acc[m.competitionCode] = (acc[m.competitionCode] ?? 0) + 1;
      return acc;
    }, {});
    this.logger.log(
      `season-matches: ${matches.length} retenus — ${Object.entries(counts).map(([k, v]) => `${k}=${v}`).join(', ')}`,
    );

    return matches;
  }

  private toSeasonMatch(g: Scores365Game): SeasonMatch {
    // 365scores statusGroups: 1=scheduled-soon, 2=scheduled-future, 3=live, 4=ended
    // (cf. live-match.types.ts). Treating 2 as IN_PLAY would tag a "next L1 match
    // in 4 days" as in-play, so map both 1 and 2 to SCHEDULED.
    const sg = g.statusGroup;
    const status: SeasonMatch['status'] =
      sg === 4 ? 'FINISHED' : sg === 3 ? 'IN_PLAY' : 'SCHEDULED';
    const compId = g.competitionId!;
    const competition = COMP_NAME[compId] ?? `Compétition #${compId}`;
    const competitionCode = COMP_CODE[compId] ?? 'OTHER';

    const home = g.homeCompetitor;
    const away = g.awayCompetitor;
    const hasScore = status !== 'SCHEDULED';

    // Frontend keeps the football-data id as canonical for OL specifically
    // (see frontend/src/types/api.ts OL_TEAM_ID = 523). Remap on the way out
    // so existing consumers (map markers, lookups) keep working.
    const remapId = (id: number | undefined): number => {
      if (id === undefined) return 0;
      if (id === OL_365SCORES_ID) return OL_TEAM_ID;
      return id;
    };

    return {
      id: g.id,
      date: new Date(g.startTime).toISOString(),
      homeTeam: home?.name ?? '',
      homeTeamId: remapId(home?.id),
      awayTeam: away?.name ?? '',
      awayTeamId: remapId(away?.id),
      homeScore: hasScore ? home?.score ?? null : null,
      awayScore: hasScore ? away?.score ?? null : null,
      competition,
      competitionCode,
      competitionId: compId,
      status,
      matchday: null,
    };
  }

  private readCache(): SeasonMatch[] | null {
    if (!fs.existsSync(this.cacheFile)) return null;
    try {
      const { ts, data } = JSON.parse(fs.readFileSync(this.cacheFile, 'utf-8'));
      if (Date.now() - ts < CACHE_TTL_MS) return data;
    } catch (err) {
      this.logger.warn(`Failed to read season-matches cache ${this.cacheFile}: ${(err as Error)?.message ?? err}`);
    }
    return null;
  }

  private readCacheRaw(): SeasonMatch[] | null {
    if (!fs.existsSync(this.cacheFile)) return null;
    try {
      const { data } = JSON.parse(fs.readFileSync(this.cacheFile, 'utf-8'));
      return data;
    } catch (err) {
      this.logger.warn(`Failed to read season-matches cache (raw): ${(err as Error)?.message ?? err}`);
      return null;
    }
  }

  private writeCache(data: SeasonMatch[]): void {
    fs.mkdirSync(path.dirname(this.cacheFile), { recursive: true });
    fs.writeFileSync(this.cacheFile, JSON.stringify({ ts: Date.now(), data }));
  }

  private matchesChanged(prev: SeasonMatch[] | null, next: SeasonMatch[]): boolean {
    if (!prev || prev.length !== next.length) return true;
    for (let i = 0; i < next.length; i++) {
      const p = prev[i];
      const n = next[i];
      if (
        p.id !== n.id ||
        p.status !== n.status ||
        p.homeScore !== n.homeScore ||
        p.awayScore !== n.awayScore ||
        p.date !== n.date
      ) {
        return true;
      }
    }
    return false;
  }
}
