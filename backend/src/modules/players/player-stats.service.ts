import { Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import { Subscription } from 'rxjs';
import * as fs from 'fs';
import * as path from 'path';
import { atomicWriteJsonSync } from '../../common/atomic-write';
import { EventBusService } from '../events/event-bus.service';
import {
  SeasonMatchesService,
  type SeasonMatch,
} from '../season-matches/season-matches.service';
import { SeasonResetService } from '../scheduler/season-reset.service';
import { OL_TEAM_ID } from '../../config/constants';
import {
  scores365Headers,
  SCORES365_API_BASE,
  SCORES365_REFERER,
} from '../../config/scores365-http';
import {
  Scores365GameDetailResponseSchema,
  type Scores365GameDetailed,
} from '../../config/scores365-game.schema';
import { parseExternal } from '../../common/zod-validation.pipe';
import {
  accumulateGame,
  finalize,
  type MatchContext,
} from './player-stats.aggregator';
import type { PlayerSeasonStats } from './player-stats.types';

const SCORES365_HEADERS = scores365Headers(SCORES365_REFERER.team);

const CACHE_TTL_MS = 60 * 60 * 1000; // 1h
/** Après une reconstruction sans aucun match lu, on réessaie dans 5 min, pas à chaque requête. */
const RETRY_AFTER_FAILURE_MS = 5 * 60 * 1000;
const CACHE_FILE_NAME = 'player-stats-cache.json';

/**
 * Fetcher type aliased so tests can swap `fetch` without DI churn —
 * mirrors `SeasonMatchesService`.
 */
type Fetcher = typeof fetch;

interface CachedFile {
  ts: number;
  /** Map athleteId → stats. Stored as plain object so JSON.parse handles it. */
  data: Record<string, PlayerSeasonStats>;
}

@Injectable()
export class PlayerStatsService implements OnModuleInit {
  private readonly logger = new Logger(PlayerStatsService.name);
  private cache = new Map<number, PlayerSeasonStats>();
  private cacheBuiltAt = 0;
  /** Matchs lus pour bâtir la copie en mémoire (0 après une relecture du disque) : une panne partielle ne doit pas la remplacer par moins. */
  private cacheMatchCount = 0;
  private busSub: Subscription | null = null;

  /** Test seam — overridden via spec, defaults to global fetch. */
  fetcher: Fetcher = (input, init) => fetch(input, init);

  constructor(
    private readonly bus: EventBusService,
    private readonly seasonMatches: SeasonMatchesService,
    @Optional() seasonReset?: SeasonResetService,
  ) {
    // Le cache fichier part à l'archive le 1er août : la copie en mémoire et son nombre de matchs partent avec lui.
    seasonReset?.onReset(() => {
      this.cache = new Map();
      this.cacheBuiltAt = 0;
      this.cacheMatchCount = 0;
    });
  }

  onModuleInit() {
    // Hydrate from disk so a fresh container doesn't need to refetch every match.
    this.readCacheFromDisk();
    this.busSub = this.bus.events$.subscribe((e) => {
      if (e.type === 'season-matches-changed') {
        this.logger.log(
          'Invalidating player-stats cache (season-matches-changed)',
        );
        this.invalidate();
      }
    });
  }

  onModuleDestroy() {
    this.busSub?.unsubscribe();
  }

  /**
   * Returns all OL players for the season, sorted by goal contributions desc.
   * Triggers a (one-shot) rebuild if the cache is stale or empty.
   */
  async getAll(): Promise<PlayerSeasonStats[]> {
    if (this.isFresh()) return [...this.cache.values()];
    await this.rebuild();
    return [...this.cache.values()];
  }

  async getOne(athleteId: number): Promise<PlayerSeasonStats | null> {
    if (!this.isFresh()) await this.rebuild();
    return this.cache.get(athleteId) ?? null;
  }

  /**
   * Marque la copie périmée pour que la prochaine lecture reconstruise, sans la jeter : si 365scores est en
   * panne à ce moment, la dernière copie reste servie (L34).
   */
  invalidate(): void {
    this.cacheBuiltAt = 0;
  }

  private isFresh(): boolean {
    return this.cache.size > 0 && Date.now() - this.cacheBuiltAt < CACHE_TTL_MS;
  }

  /** In-flight rebuild promise — prevents concurrent rebuild storms. */
  private rebuildPromise: Promise<void> | null = null;

  private rebuild(): Promise<void> {
    if (this.rebuildPromise) return this.rebuildPromise;
    this.rebuildPromise = this.doRebuild().finally(() => {
      this.rebuildPromise = null;
    });
    return this.rebuildPromise;
  }

  private async doRebuild(): Promise<void> {
    let matches: SeasonMatch[];
    try {
      matches = await this.seasonMatches.getMatches();
    } catch (err) {
      if (this.cache.size === 0) throw err;
      this.keepLastCopy(`liste des matchs indisponible (${(err as Error).message})`);
      return;
    }
    const finished = matches.filter((m) => m.status === 'FINISHED');
    this.logger.log(
      `Rebuilding player-stats from ${finished.length} finished matches`,
    );

    const acc = new Map<number, any>();
    let succeeded = 0;
    // Un détail en échec (timeout, HTTP non-2xx, charge illisible) est relu une fois après la passe, puis nommé s'il reste manquant (L53).
    let missing: SeasonMatch[] = [];
    for (const m of finished) {
      if (await this.accumulateMatch(acc, m)) succeeded++;
      else missing.push(m);
    }
    // Rien de lu : 365scores est tombé, rejouer les N détails ne ferait qu'allonger l'attente (chacun jusqu'à 10 s).
    if (succeeded > 0) {
      const retry = missing;
      missing = [];
      for (const m of retry) {
        if (await this.accumulateMatch(acc, m)) succeeded++;
        else missing.push(m);
      }
    }

    // Panne de 365scores, pas une saison sans stat : aucun match lu, ou moins que pour la copie actuelle (panne partielle). On la garde.
    if (
      finished.length > 0 &&
      this.cache.size > 0 &&
      succeeded < Math.max(1, this.cacheMatchCount)
    ) {
      this.keepLastCopy(
        `${succeeded}/${finished.length} matchs lisibles, la copie en comptait ${this.cacheMatchCount}`,
      );
      return;
    }

    const stats = finalize(acc);
    this.cache = new Map(stats.map((s) => [s.athleteId, s]));
    // Copie bâtie sans tous les matchs : valable 5 min seulement (le disque garde la même date), pas 1 h.
    this.cacheBuiltAt =
      missing.length > 0
        ? Date.now() - CACHE_TTL_MS + RETRY_AFTER_FAILURE_MS
        : Date.now();
    if (missing.length > 0) {
      this.logger.warn(
        `player-stats : ${missing.length}/${finished.length} détails de match illisibles (${missing.map((m) => m.id).join(', ')}) — stats partielles, nouvelle tentative dans 5 min`,
      );
    }
    this.cacheMatchCount = succeeded;
    this.writeCacheToDisk();
    this.logger.log(
      `player-stats rebuilt: ${stats.length} OL players from ${succeeded}/${finished.length} matches`,
    );
  }

  /** Lit un match et l'ajoute à l'accumulateur ; faux si son détail est illisible (échec journalisé). */
  private async accumulateMatch(
    acc: Map<number, any>,
    m: SeasonMatch,
  ): Promise<boolean> {
    try {
      const game = await this.fetchGameDetail(m.id);
      if (!game) return false;
      accumulateGame(acc, game, this.toContext(m));
      return true;
    } catch (err) {
      this.logger.warn(`Skip match ${m.id}: ${(err as Error).message}`);
      return false;
    }
  }

  /** Garde la copie en mémoire et sur disque telle quelle ; la prochaine tentative est reportée de 5 min. */
  private keepLastCopy(reason: string): void {
    this.cacheBuiltAt = Date.now() - CACHE_TTL_MS + RETRY_AFTER_FAILURE_MS;
    this.logger.warn(
      `player-stats : reconstruction impossible, ${reason} — dernière copie conservée (${this.cache.size} joueurs)`,
    );
  }

  private toContext(m: SeasonMatch): MatchContext {
    // SeasonMatch already remaps OL's id to football-data 523 — see
    // `SeasonMatchesService.toSeasonMatch`. Determine OL side by comparing
    // homeTeamId to OL_TEAM_ID rather than the raw 365scores id.
    const isHome = m.homeTeamId === OL_TEAM_ID;
    const opponent = isHome ? m.awayTeam : m.homeTeam;
    const olScore = isHome ? m.homeScore : m.awayScore;
    const opponentScore = isHome ? m.awayScore : m.homeScore;
    return {
      gameId: m.id,
      date: m.date,
      opponent,
      isHome,
      olScore,
      opponentScore,
      competitionCode: m.competitionCode,
    };
  }

  private async fetchGameDetail(
    gameId: number,
  ): Promise<Scores365GameDetailed | null> {
    const url = `${SCORES365_API_BASE}/web/game/?appTypeId=5&langId=15&gameId=${gameId}&timezoneName=Europe/Paris&userCountryId=5&withLineups=true`;
    const res = await this.fetcher(url, {
      headers: SCORES365_HEADERS,
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      this.logger.warn(`365 game ${gameId} HTTP ${res.status}`);
      return null;
    }
    const json = await res.json();
    const parsed = parseExternal(
      Scores365GameDetailResponseSchema,
      json,
      '365scores game detail',
    );
    return parsed.game ?? null;
  }

  private get cacheFile(): string {
    return path.resolve(process.cwd(), 'data', CACHE_FILE_NAME);
  }

  private readCacheFromDisk(): void {
    const file_ = this.cacheFile;
    if (!fs.existsSync(file_)) return;
    try {
      const file = JSON.parse(fs.readFileSync(file_, 'utf-8')) as CachedFile;
      if (!file.data) return;
      this.cache = new Map(
        Object.entries(file.data).map(([id, v]) => [Number(id), v]),
      );
      this.cacheBuiltAt = file.ts;
      this.logger.log(
        `Loaded player-stats cache from disk (${this.cache.size} players)`,
      );
    } catch (err) {
      this.logger.warn(
        `Failed to read player-stats cache: ${(err as Error).message}`,
      );
    }
  }

  private writeCacheToDisk(): void {
    try {
      const file_ = this.cacheFile;
      const dump: CachedFile = {
        ts: this.cacheBuiltAt,
        data: Object.fromEntries(
          [...this.cache.entries()].map(([id, s]) => [String(id), s]),
        ),
      };
      atomicWriteJsonSync(file_, dump);
    } catch (err) {
      this.logger.warn(
        `Failed to write player-stats cache: ${(err as Error).message}`,
      );
    }
  }
}
