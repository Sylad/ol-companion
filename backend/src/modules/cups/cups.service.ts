import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { getCurrentSeason } from '../scheduler/season.util';

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
}

export interface CupInfo {
  competitionId: number;
  name: string;
  currentStageFr: string;
  isEliminated: boolean;
  matches: CupMatch[];
}

const OL_365SCORES_ID = 465;
const LIGUE1_COMP_ID = 35;

const COMP_NAMES: Record<number, string> = {
  37: 'Coupe de France',
  573: 'UEFA Europa League',
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

// Europa League: stageNum → French name
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

// Cup display order (first = most important)
const COMP_ORDER = [37, 573];

const CACHE_TTL_MS = 7200_000; // 2h
const CACHE_FILE = path.resolve(process.cwd(), 'data', 'cups-cache.json');

const SCORES365_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'application/json',
  'Accept-Language': 'fr-FR,fr;q=0.9',
  'X-Domain': 'fr',
  'Referer': 'https://www.365scores.com/fr/football/team/lyon-465',
  'Origin': 'https://www.365scores.com',
};

@Injectable()
export class CupsService {
  private readonly logger = new Logger(CupsService.name);

  constructor(private config: ConfigService) {}

  async getCups(): Promise<CupInfo[]> {
    const cached = this.readCache();
    if (cached) return cached;

    try {
      const results = await this.fetchCupsFrom365Scores();
      this.writeCache(results);
      return results;
    } catch (err) {
      this.logger.error('getCups (365scores) failed', err);
      return [];
    }
  }

  private async fetchCupsFrom365Scores(): Promise<CupInfo[]> {
    const allGames: any[] = [];
    const baseUrl = 'https://data.365scores.com/web/games';
    const seasonStart = getCurrentSeason().startDate.getTime();

    // Fetch paginated results (follow previousPage up to 3 pages to cover full season)
    let url: string | null = `${baseUrl}/results/?appTypeId=5&langId=1&timezoneName=Europe/Paris&userCountryId=75&competitors=${OL_365SCORES_ID}&limit=50`;
    for (let page = 0; page < 4 && url; page++) {
      try {
        const res = await fetch(url, { headers: SCORES365_HEADERS, signal: AbortSignal.timeout(10_000) });
        if (!res.ok) break;
        const d = await res.json() as any;
        const games: any[] = d.games ?? [];
        allGames.push(...games);

        // Stop if oldest game is before this season
        const oldest = games[games.length - 1];
        if (!oldest || new Date(oldest.startTime).getTime() < seasonStart) break;

        const prev: string = d.paging?.previousPage;
        url = prev ? `https://data.365scores.com${prev}` : null;
      } catch { break; }
    }

    // Fetch upcoming games (for future cup matches)
    try {
      const res = await fetch(
        `${baseUrl}/?appTypeId=5&langId=1&timezoneName=Europe/Paris&userCountryId=75&competitors=${OL_365SCORES_ID}&limit=20`,
        { headers: SCORES365_HEADERS, signal: AbortSignal.timeout(10_000) }
      );
      if (res.ok) {
        const d = await res.json() as any;
        allGames.push(...(d.games ?? []));
      }
    } catch { /* ignore */ }

    this.logger.log(`365scores: ${allGames.length} événements récupérés`);

    // Filter: keep only cup competitions, current season (since Aug 2025)
    const cupGames = allGames.filter(g => {
      if (g.competitionId === LIGUE1_COMP_ID) return false;
      if (!COMP_NAMES[g.competitionId]) return false;
      return new Date(g.startTime).getTime() >= seasonStart;
    });

    // Group by competition
    const byComp = new Map<number, any[]>();
    for (const g of cupGames) {
      if (!byComp.has(g.competitionId)) byComp.set(g.competitionId, []);
      byComp.get(g.competitionId)!.push(g);
    }

    const results: CupInfo[] = [];
    for (const [cid, games] of byComp) {
      const stageNames = COMP_STAGES[cid] ?? {};
      const matches: CupMatch[] = games
        .map(g => this.gameToMatch(g, cid, stageNames))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      const compName = COMP_NAMES[cid] ?? `Compétition #${cid}`;
      const finished = matches.filter(m => m.status === 'FINISHED');
      const upcoming = matches.filter(m => m.status === 'SCHEDULED' || m.status === 'IN_PLAY');
      const lastFinished = finished[finished.length - 1];

      // Eliminated = played at least one game and nothing upcoming
      const isEliminated = finished.length > 0 && upcoming.length === 0;
      const currentStage = upcoming[0]?.stageFr ?? lastFinished?.stageFr ?? '';

      results.push({ competitionId: cid, name: compName, currentStageFr: currentStage, isEliminated, matches });
      this.logger.log(`Cup: ${compName} — ${matches.length} matchs, éliminé=${isEliminated}`);
    }

    // Sort: CdF first, then EL (per user preference)
    results.sort((a, b) => {
      const ai = COMP_ORDER.indexOf(a.competitionId);
      const bi = COMP_ORDER.indexOf(b.competitionId);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });

    return results;
  }

  private gameToMatch(g: any, compId: number, stageNames: Record<number, string>): CupMatch {
    const date = new Date(g.startTime).toISOString();
    const statusGroup: number = g.statusGroup;
    const status = statusGroup === 4 ? 'FINISHED' : statusGroup === 2 ? 'IN_PLAY' : 'SCHEDULED';

    const stageNum: number = g.stageNum ?? 0;
    const roundNum: number = g.roundNum ?? 0;
    const stageFr = stageNames[stageNum] ?? (stageNum ? `Tour ${stageNum}` : '');

    // EL league phase: append match day
    let stage = stageFr;
    if (compId === 573 && stageNum === 1 && roundNum) {
      stage = `Phase de ligue — J${roundNum}`;
    }

    const hasScore = status !== 'SCHEDULED';
    const homeScore = hasScore ? (g.homeCompetitor?.score ?? null) : null;
    const awayScore = hasScore ? (g.awayCompetitor?.score ?? null) : null;

    return {
      id: g.id,
      date,
      homeTeam: g.homeCompetitor?.name ?? '',
      homeTeamId: g.homeCompetitor?.id ?? 0,
      awayTeam: g.awayCompetitor?.name ?? '',
      awayTeamId: g.awayCompetitor?.id ?? 0,
      homeScore,
      awayScore,
      status,
      stage,
      stageFr,
    };
  }

  private readCache(): CupInfo[] | null {
    if (!fs.existsSync(CACHE_FILE)) return null;
    try {
      const { ts, data } = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
      if (Date.now() - ts < CACHE_TTL_MS) return data;
    } catch {}
    return null;
  }

  private writeCache(data: CupInfo[]): void {
    fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
    fs.writeFileSync(CACHE_FILE, JSON.stringify({ ts: Date.now(), data }));
  }
}
