import { Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import * as fs from 'fs';
import * as path from 'path';
import { atomicWriteJsonSync } from '../../common/atomic-write';
import { getCurrentSeason } from '../scheduler/season.util';
import { SeasonResetService } from '../scheduler/season-reset.service';
import { isCupEliminated } from './cup-status';
import { BracketService } from './bracket.service';
import { OL_365SCORES_ID, LIGUE1_365SCORES_ID } from '../../config/constants';
import { scores365Headers, SCORES365_API_BASE, SCORES365_REFERER } from '../../config/scores365-http';
import { Scores365GamesResponseSchema, type Scores365Game, type Scores365GamesResponse } from '../../config/scores365-game.schema';
import { parseExternal } from '../../common/zod-validation.pipe';

export interface CupMatch {
  id: number;
  date: string;
  homeTeam: string;
  homeTeamId: number;
  awayTeam: string;
  awayTeamId: number;
  homeScore: number | null;
  awayScore: number | null;
  status: string;
  stage: string;
  stageFr: string;
  /** Issue de la confrontation lue sur sa dernière manche : vrai si l'OL est qualifié, faux si l'adversaire l'est ; absent sinon. */
  olQualified?: boolean;
}

export interface CupInfo {
  competitionId: number;
  name: string;
  currentStageFr: string;
  isEliminated: boolean;
  matches: CupMatch[];
  bracket?: BracketInfo;
}

export interface BracketMatch {
  id: number;
  date: string;
  homeTeam: string; homeTeamId: number; homeLogo?: string;
  awayTeam: string; awayTeamId: number; awayLogo?: string;
  homeScore: number | null; awayScore: number | null;
  status: 'SCHEDULED' | 'IN_PLAY' | 'FINISHED';
  stageNum: number;
  stageFr: string;
  hasOL: boolean;
}

export interface BracketStage {
  stageNum: number;
  stageFr: string;
  matches: BracketMatch[];
}

export interface BracketInfo {
  competitionId: number;
  fromStageNum: number;
  stages: BracketStage[];
}

const COMP_NAMES: Record<number, string> = {
  37: 'Coupe de France',
  573: 'Ligue Europa',
};

// Coupe de France: stageNum → French name
const CDF_STAGES: Record<number, string> = {
  1: 'Tour préliminaire',
  2: '7ème tour',
  3: '32ème de finale',
  4: '16ème de finale',
  5: 'Huitième de finale',
  6: 'Quart de finale',
  7: 'Demi-finale',
  8: 'Finale',
};

// Ligue Europa: stageNum → French name
const EL_STAGES: Record<number, string> = {
  1: 'Phase de ligue',
  2: 'Barrages',
  3: '1/8 de finale',
  4: '1/4 de finale',
  5: 'Demi-finale',
  6: 'Finale',
};

const COMP_STAGES: Record<number, Record<number, string>> = {
  37: CDF_STAGES,
  573: EL_STAGES,
};

const BRACKET_FROM_STAGE: Record<number, number> = {
  37: 6,   // CdF: from quarter-finals
  573: 3,  // EL: from round of 16
};

// Cup display order (first = most important)
const COMP_ORDER = [37, 573];

const CACHE_TTL_MS = 7200_000; // 2h
/** Cache écrit sans les matchs à venir : on réessaie au bout de 5 min, pas 2 h. */
const DEGRADED_TTL_MS = 300_000;
const UPCOMING_ATTEMPTS = 3;
const UPCOMING_RETRY_DELAY_MS = 1_000;
const CACHE_FILE = path.resolve(process.cwd(), 'data', 'cups-cache.json');

const SCORES365_HEADERS = scores365Headers(SCORES365_REFERER.team);

@Injectable()
export class CupsService implements OnModuleInit {
  private readonly logger = new Logger(CupsService.name);

  /** Dernier résultat connu (cache d'avant le démarrage compris) : repli si les matchs à venir échouent. */
  private lastKnown: CupInfo[] | null = null;

  constructor(
    private config: ConfigService,
    private readonly bracketService: BracketService,
    @Optional() seasonReset?: SeasonResetService,
  ) {
    // Le cache fichier part à l'archive le 1er août : la copie en mémoire doit partir avec lui.
    seasonReset?.onReset(() => { this.lastKnown = null; });
  }

  onModuleInit() {
    try {
      this.lastKnown = this.readCache({ ignoreTtl: true });
      if (fs.existsSync(CACHE_FILE)) fs.unlinkSync(CACHE_FILE);
    } catch (err) {
      this.logger.warn(`Could not invalidate cups cache: ${(err as Error).message}`);
    }
    this.getCups({ force: true }).catch((err) =>
      this.logger.warn(`Initial cups refresh failed: ${(err as Error).message}`),
    );
  }

  @Cron('0 0 */2 * * *', { name: 'cups-refresh', timeZone: 'Europe/Paris' })
  async scheduledRefresh() {
    await this.getCups({ force: true }).catch((err) =>
      this.logger.warn(`Periodic cups refresh failed: ${(err as Error).message}`),
    );
  }

  async getCups(opts: { force?: boolean } = {}): Promise<CupInfo[]> {
    if (!opts.force) {
      const cached = this.readCache();
      if (cached) return cached;
    }

    try {
      const { results, upcomingOk } = await this.fetchCupsFrom365Scores();
      const previous = this.readCache() ?? this.lastKnown;
      if (results.length === 0 && previous && previous.length > 0) {
        this.logger.warn('365scores a rendu 0 coupe — cache existant conservé');
        return previous;
      }
      if (upcomingOk) {
        this.lastKnown = results;
        this.writeCache(results);
      } else {
        this.writeCache(results, DEGRADED_TTL_MS);
      }
      return results;
    } catch (err) {
      this.logger.error('getCups (365scores) failed', err);
      return [];
    }
  }

  private async fetchCupsFrom365Scores(): Promise<{ results: CupInfo[]; upcomingOk: boolean }> {
    const allGames: Scores365Game[] = [];
    const baseUrl = `${SCORES365_API_BASE}/web/games`;
    const seasonStart = getCurrentSeason().startDate.getTime();

    // Fetch paginated results (follow previousPage up to 3 pages to cover full season)
    let url: string | null = `${baseUrl}/results/?appTypeId=5&langId=1&timezoneName=Europe/Paris&userCountryId=75&competitors=${OL_365SCORES_ID}&limit=50`;
    for (let page = 0; page < 4 && url; page++) {
      try {
        const res: Response = await fetch(url, { headers: SCORES365_HEADERS, signal: AbortSignal.timeout(10_000) });
        if (!res.ok) break;
        const d: Scores365GamesResponse = parseExternal(Scores365GamesResponseSchema, await res.json(), '365scores cups results');
        const games = d.games ?? [];
        allGames.push(...games);

        // Stop if oldest game is before this season
        const oldest = games[games.length - 1];
        if (!oldest || new Date(oldest.startTime).getTime() < seasonStart) break;

        const prev: string | undefined = d.paging?.previousPage;
        url = prev ? `${SCORES365_API_BASE}${prev}` : null;
      } catch (err: unknown) {
        this.logger.warn(`365scores results pagination failed at page ${page}: ${(err as Error)?.message ?? err}`);
        break;
      }
    }

    // Fetch upcoming games (for future cup matches), with retries: a miss must not read as "no match left"
    const upcomingOk = await this.fetchUpcoming(baseUrl, allGames);

    this.logger.log(`365scores: ${allGames.length} événements récupérés`);

    // Filter: keep only cup competitions, current season (since Aug 2025)
    const cupGames = allGames.filter(g => {
      if (g.competitionId === LIGUE1_365SCORES_ID) return false;
      if (g.competitionId === undefined || !COMP_NAMES[g.competitionId]) return false;
      return new Date(g.startTime).getTime() >= seasonStart;
    });

    // Group by competition
    const byComp = new Map<number, Scores365Game[]>();
    for (const g of cupGames) {
      const cid = g.competitionId!;
      if (!byComp.has(cid)) byComp.set(cid, []);
      byComp.get(cid)!.push(g);
    }

    const results: CupInfo[] = [];
    for (const [cid, games] of byComp) {
      const stageNames = COMP_STAGES[cid] ?? {};
      const matches: CupMatch[] = games
        .map(g => this.gameToMatch(g, cid, stageNames))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      const compName = COMP_NAMES[cid] ?? `Compétition #${cid}`;
      const finished = matches.filter(m => m.status === 'FINISHED');

      if (!upcomingOk) {
        // Appel des matchs à venir en échec : on reprend ceux du dernier résultat connu.
        const known = new Set(matches.map((m) => m.id));
        const kept = (this.lastKnown ?? [])
          .find((c) => c.competitionId === cid)
          ?.matches.filter((m) => m.status !== 'FINISHED' && !known.has(m.id)) ?? [];
        matches.push(...kept);
        matches.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      }
      const upcoming = matches.filter(m => m.status === 'SCHEDULED' || m.status === 'IN_PLAY');
      const lastFinished = finished[finished.length - 1];

      const isEliminated = isCupEliminated(matches, new Date(), upcomingOk);
      const currentStage = upcoming[0]?.stageFr ?? lastFinished?.stageFr ?? '';

      results.push({ competitionId: cid, name: compName, currentStageFr: currentStage, isEliminated, matches });
      this.logger.log(`Cup: ${compName} — ${matches.length} matchs, éliminé=${isEliminated}`);
    }

    const seasonStartDate = getCurrentSeason().startDate;
    for (const cup of results) {
      const fromStageNum = BRACKET_FROM_STAGE[cup.competitionId];
      if (fromStageNum === undefined) continue;
      const olStageNumbers = cup.matches
        .map((m) => this.stageFrToNum(cup.competitionId, m.stageFr))
        .filter((n): n is number => n !== null);
      const olMaxStage = olStageNumbers.length ? Math.max(...olStageNumbers) : 0;
      if (olMaxStage < fromStageNum) continue;
      const bracket = await this.bracketService.fetchBracket(cup.competitionId, fromStageNum, seasonStartDate);
      if (bracket) cup.bracket = bracket;
    }

    // Sort: CdF first, then EL (per user preference)
    results.sort((a, b) => {
      const ai = COMP_ORDER.indexOf(a.competitionId);
      const bi = COMP_ORDER.indexOf(b.competitionId);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });

    return { results, upcomingOk };
  }

  private async fetchUpcoming(baseUrl: string, into: Scores365Game[]): Promise<boolean> {
    const url = `${baseUrl}/fixtures/?appTypeId=5&langId=1&timezoneName=Europe/Paris&userCountryId=75&competitors=${OL_365SCORES_ID}&limit=50`;
    for (let attempt = 1; attempt <= UPCOMING_ATTEMPTS; attempt++) {
      try {
        const res = await fetch(url, { headers: SCORES365_HEADERS, signal: AbortSignal.timeout(10_000) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const d = parseExternal(Scores365GamesResponseSchema, await res.json(), '365scores cups upcoming');
        into.push(...(d.games ?? []));
        return true;
      } catch (err: unknown) {
        this.logger.warn(`365scores upcoming fetch failed (essai ${attempt}/${UPCOMING_ATTEMPTS}): ${(err as Error)?.message ?? err}`);
        if (attempt < UPCOMING_ATTEMPTS) await new Promise((r) => setTimeout(r, UPCOMING_RETRY_DELAY_MS));
      }
    }
    return false;
  }

  private gameToMatch(g: Scores365Game, compId: number, stageNames: Record<number, string>): CupMatch {
    const date = new Date(g.startTime).toISOString();
    const statusGroup = g.statusGroup;
    // 365scores statusGroups: 1=scheduled-soon, 2=scheduled-future, 3=live, 4=ended.
    // (cf. season-matches.service.ts:226 for canonical mapping.)
    const status = statusGroup === 4 ? 'FINISHED' : statusGroup === 3 ? 'IN_PLAY' : 'SCHEDULED';

    const stageNum = g.stageNum ?? 0;
    const roundNum = g.roundNum ?? 0;
    const stageFr = stageNames[stageNum] ?? (stageNum ? `Tour ${stageNum}` : '');

    // EL league phase: append match day
    let stage = stageFr;
    if (compId === 573 && stageNum === 1 && roundNum) {
      stage = `Phase de ligue — J${roundNum}`;
    }

    const hasScore = status !== 'SCHEDULED';
    const homeScore = hasScore ? (g.homeCompetitor?.score ?? null) : null;
    const awayScore = hasScore ? (g.awayCompetitor?.score ?? null) : null;

    const olIsHome = g.homeCompetitor?.id === OL_365SCORES_ID;
    const olSide = olIsHome ? g.homeCompetitor : g.awayCompetitor;
    const oppSide = olIsHome ? g.awayCompetitor : g.homeCompetitor;
    const olQualified = status !== 'FINISHED' ? undefined
      : olSide?.isQualified === true ? true
      : oppSide?.isQualified === true ? false
      : undefined;

    return {
      id: g.id,
      date,
      homeTeam: g.homeCompetitor?.name ?? '',
      homeTeamId: g.homeCompetitor?.id ?? 0,
      awayTeam: g.awayCompetitor?.name ?? '',
      awayTeamId: g.awayCompetitor?.id ?? 0,
      homeScore: homeScore ?? null,
      awayScore: awayScore ?? null,
      status,
      stage,
      stageFr,
      ...(olQualified === undefined ? {} : { olQualified }),
    };
  }

  private readCache(opts: { ignoreTtl?: boolean } = {}): CupInfo[] | null {
    if (!fs.existsSync(CACHE_FILE)) return null;
    try {
      const { ts, data } = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
      if (opts.ignoreTtl || Date.now() - ts < CACHE_TTL_MS) return data;
    } catch (err: unknown) {
      this.logger.warn(`Failed to read cups cache ${CACHE_FILE}: ${(err as Error)?.message ?? err}`);
    }
    return null;
  }

  private writeCache(data: CupInfo[], ttlMs = CACHE_TTL_MS): void {
    fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
    atomicWriteJsonSync(CACHE_FILE, { ts: Date.now() - (CACHE_TTL_MS - ttlMs), data });
  }

  private stageFrToNum(competitionId: number, stageFr: string): number | null {
    const stages = COMP_STAGES[competitionId] ?? {};
    for (const [num, label] of Object.entries(stages)) {
      if (label === stageFr || stageFr.startsWith(label)) return Number(num);
    }
    return null;
  }
}
