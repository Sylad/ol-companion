import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import * as fs from 'fs';
import * as path from 'path';
import { atomicWriteJsonSync } from '../../common/atomic-write';
import { EventBusService } from '../events/event-bus.service';
import { getCurrentSeason } from '../scheduler/season.util';
import {
  OL_365SCORES_ID,
  OL_TEAM_ID,
  LIGUE1_365SCORES_ID,
  COUPE_DE_FRANCE_365SCORES_ID,
  EUROPA_LEAGUE_365SCORES_ID,
} from '../../config/constants';
import { scores365Headers, SCORES365_API_BASE, SCORES365_REFERER } from '../../config/scores365-http';
import { Scores365GamesResponseSchema, type Scores365Game, type Scores365GamesResponse } from '../../config/scores365-game.schema';
import { parseExternal } from '../../common/zod-validation.pipe';
import { FixturesService } from '../fixtures/fixtures.service';
import { isKickoffTimeConfirmed } from './kickoff-confirmation';

/**
 * Match in a season-wide bucket. The shape mirrors the existing `Match`
 * interface used by /api/fixtures (so the frontend mapping stays familiar)
 * and adds a stable `competitionCode` discriminator the UI can switch on
 * without parsing free-form competition names.
 */
/** Un match tel qu'il est écrit dans le cache — sans champ dérivé. */
interface StoredSeasonMatch {
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
  /**
   * Journée : `roundNum` de 365scores (J1–J34 en Ligue 1, J1–J8 en phase de
   * ligue européenne). `null` quand la source n'en donne pas (tours à
   * élimination directe).
   */
  matchday: number | null;
}

export interface SeasonMatch extends StoredSeasonMatch {
  /**
   * `false` quand aucune source ne confirme l'heure du coup d'envoi — la date
   * porte alors une heure de remplissage de 365scores, à ne pas afficher. Voir
   * `isKickoffTimeConfirmed`. Dérivé à chaque lecture du dernier calendrier
   * football-data connu, jamais écrit dans le cache.
   */
  timeConfirmed: boolean;
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
/**
 * Marche avant : chaque page « suivante » ne rend que 3 à 5 matchs. Mesuré le
 * 2026-10-03 : avec 8 pages depuis le dernier résultat, la saison s'arrêtait à
 * J28 (17-04-2027) et J29–J34 manquaient. La page `/web/games/fixtures/` rend
 * d'abord ~27 matchs à venir d'un coup ; il reste 3 pages + 1 vide ce jour-là.
 * 12 couvre une saison entière même si cette page échoue ; le plafond atteint
 * avec une page suivante encore annoncée est journalisé, jamais silencieux.
 */
const FORWARD_PAGES = 12;

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
  fetcher: Fetcher = (input, init) => fetch(input, init);

  constructor(
    private readonly bus: EventBusService,
    private readonly fixtures: FixturesService,
  ) {}

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
    const footballData = this.fixtures.peekFixtures();
    return (await this.loadMatches(opts)).map((m) => ({
      ...m,
      timeConfirmed: isKickoffTimeConfirmed(m, footballData),
    }));
  }

  private async loadMatches(opts: { force?: boolean }): Promise<StoredSeasonMatch[]> {
    if (!opts.force) {
      const cached = this.readCache();
      if (cached) return cached;
    }

    try {
      const matches = await this.fetchFrom365Scores();
      const previous = this.readCacheRaw();
      // Garde anti-outage : fetchFrom365Scores avale ses erreurs et peut
      // rendre [] — ne jamais écraser une saison complète par du vide
      // (même garde que news.service). Review 2026-08-14.
      if (matches.length === 0 && previous && previous.length > 0) {
        this.logger.warn('365scores a rendu 0 match — cache existant conservé');
        return previous;
      }
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

  private async fetchFrom365Scores(): Promise<StoredSeasonMatch[]> {
    const seasonStart = getCurrentSeason().startDate.getTime();
    const games = new Map<number, Scores365Game>();

    // 1. Past results + collect future-direction cursor.
    // Page 1 returns ~50 events with both `paging.previousPage` (older) and
    // `paging.nextPage` (newer) — the latter is only the fallback cursor of
    // step 3, used when the fixtures page of step 2 fails.
    const baseUrl = `${SCORES365_API_BASE}/web/games`;
    let url: string | null = `${baseUrl}/results/?appTypeId=5&langId=1&timezoneName=Europe/Paris&userCountryId=75&competitors=${OL_365SCORES_ID}&limit=${PAGE_LIMIT}`;
    let nextPageHref: string | null = null;

    for (let page = 0; page < PAGES && url; page++) {
      try {
        const res: Response = await this.fetcher(url, { headers: SCORES365_HEADERS, signal: AbortSignal.timeout(10_000) });
        if (!res.ok) {
          this.logger.warn(`365scores results page ${page} → HTTP ${res.status}`);
          break;
        }
        const d: Scores365GamesResponse = parseExternal(Scores365GamesResponseSchema, await res.json(), '365scores season results');
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

        const prev: string | undefined = d.paging?.previousPage;
        url = prev ? `${SCORES365_API_BASE}${prev}` : null;
      } catch (err) {
        this.logger.warn(`365scores results pagination failed at page ${page}: ${(err as Error)?.message ?? err}`);
        break;
      }
    }

    // 2. Upcoming — the fixtures page returns the next ~27 matches in one call
    // (`/web/games/?…competitors=465`, used here before, returns 0 game), and
    // its `paging.nextPage` continues after the last of them.
    try {
      const upRes = await this.fetcher(
        `${baseUrl}/fixtures/?appTypeId=5&langId=1&timezoneName=Europe/Paris&userCountryId=75&competitors=${OL_365SCORES_ID}&limit=${PAGE_LIMIT}`,
        { headers: SCORES365_HEADERS, signal: AbortSignal.timeout(10_000) },
      );
      if (upRes.ok) {
        const d = parseExternal(Scores365GamesResponseSchema, await upRes.json(), '365scores season upcoming');
        const list = d.games ?? [];
        for (const g of list) games.set(g.id, g);
        // Continue from the end of this page rather than from the last result.
        if (list.length > 0) nextPageHref = d.paging?.nextPage ?? null;
      } else {
        this.logger.warn(`365scores upcoming → HTTP ${upRes.status}`);
      }
    } catch (err) {
      this.logger.warn(`365scores upcoming fetch failed: ${(err as Error)?.message ?? err}`);
    }

    // 3. Walk the forward cursor down to the empty page that ends the season.
    let forwardUrl: string | null = nextPageHref ? `${SCORES365_API_BASE}${nextPageHref}` : null;
    for (let page = 0; forwardUrl; page++) {
      if (page >= FORWARD_PAGES) {
        this.logger.warn(
          `365scores forward : ${FORWARD_PAGES} pages lues et une page suivante encore annoncée — la fin de saison peut manquer`,
        );
        break;
      }
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
        forwardUrl = next ? `${SCORES365_API_BASE}${next}` : null;
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

  private toSeasonMatch(g: Scores365Game): StoredSeasonMatch {
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
      matchday: g.roundNum ?? null,
    };
  }

  private readCache(): StoredSeasonMatch[] | null {
    if (!fs.existsSync(this.cacheFile)) return null;
    try {
      const { ts, data } = JSON.parse(fs.readFileSync(this.cacheFile, 'utf-8'));
      if (Date.now() - ts < CACHE_TTL_MS) return data;
    } catch (err) {
      this.logger.warn(`Failed to read season-matches cache ${this.cacheFile}: ${(err as Error)?.message ?? err}`);
    }
    return null;
  }

  private readCacheRaw(): StoredSeasonMatch[] | null {
    if (!fs.existsSync(this.cacheFile)) return null;
    try {
      const { data } = JSON.parse(fs.readFileSync(this.cacheFile, 'utf-8'));
      return data;
    } catch (err) {
      this.logger.warn(`Failed to read season-matches cache (raw): ${(err as Error)?.message ?? err}`);
      return null;
    }
  }

  private writeCache(data: StoredSeasonMatch[]): void {
    fs.mkdirSync(path.dirname(this.cacheFile), { recursive: true });
    atomicWriteJsonSync(this.cacheFile, { ts: Date.now(), data });
  }

  private matchesChanged(prev: StoredSeasonMatch[] | null, next: StoredSeasonMatch[]): boolean {
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
