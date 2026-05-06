import { Injectable, Logger } from '@nestjs/common';
import type { BracketInfo, BracketMatch, BracketStage } from './cups.service';
import { OL_365SCORES_ID } from '../../config/constants';
import { scores365Headers } from '../../config/scores365-http';
import { Scores365GamesResponseSchema, type Scores365Game } from '../../config/scores365-game.schema';
import { parseExternal } from '../../common/zod-validation.pipe';

const CDF_STAGES: Record<number, string> = {
  6: '1/4 de finale',
  7: 'Demi-finale',
  8: 'Finale',
};

const EL_STAGES: Record<number, string> = {
  3: '1/8 de finale',
  4: '1/4 de finale',
  5: 'Demi-finale',
  6: 'Finale',
};

const STAGE_NAMES: Record<number, Record<number, string>> = {
  37: CDF_STAGES,
  573: EL_STAGES,
};

const SCORES365_HEADERS = scores365Headers();

@Injectable()
export class BracketService {
  private readonly logger = new Logger(BracketService.name);

  async fetchBracket(competitionId: number, fromStageNum: number, seasonStart: Date): Promise<BracketInfo | null> {
    // 365scores splits its game list across two endpoints: /results/ for finished
    // matches, /fixtures/ for upcoming. Merge both for a complete bracket view.
    const base = `https://data.365scores.com/web/games`;
    const params = `appTypeId=5&langId=1&timezoneName=Europe/Paris&competitions=${competitionId}&limit=200`;
    const urls = [`${base}/results/?${params}`, `${base}/fixtures/?${params}`];

    const games: Scores365Game[] = [];
    for (const url of urls) {
      try {
        const res = await fetch(url, { headers: SCORES365_HEADERS, signal: AbortSignal.timeout(10_000) });
        if (!res.ok) {
          this.logger.warn(`Bracket fetch HTTP ${res.status} for comp ${competitionId} (${url})`);
          continue;
        }
        const d = parseExternal(Scores365GamesResponseSchema, await res.json(), '365scores bracket');
        games.push(...(d.games ?? []));
      } catch (err) {
        this.logger.warn(`Bracket fetch failed for comp ${competitionId}: ${(err as Error).message}`);
      }
    }
    if (games.length === 0) return null;

    const seasonStartMs = seasonStart.getTime();
    const stageNames = STAGE_NAMES[competitionId] ?? {};

    // Dedupe by id (the two endpoints can overlap on the same game)
    const dedupedById = new Map<number, Scores365Game>();
    for (const g of games) dedupedById.set(g.id, g);

    const eligible = Array.from(dedupedById.values())
      .filter((g) => (g.stageNum ?? 0) >= fromStageNum)
      .filter((g) => new Date(g.startTime).getTime() >= seasonStartMs);

    if (eligible.length === 0) return null;

    const byStage = new Map<number, BracketMatch[]>();
    for (const g of eligible) {
      const stageNum = g.stageNum ?? 0;
      if (!byStage.has(stageNum)) byStage.set(stageNum, []);
      byStage.get(stageNum)!.push(this.toBracketMatch(g, stageNames));
    }

    const stages: BracketStage[] = Array.from(byStage.entries())
      .sort(([a], [b]) => a - b)
      .map(([stageNum, matches]) => ({
        stageNum,
        stageFr: stageNames[stageNum] ?? `Stage ${stageNum}`,
        matches: matches.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
      }));

    return { competitionId, fromStageNum, stages };
  }

  private toBracketMatch(g: Scores365Game, stageNames: Record<number, string>): BracketMatch {
    // 365scores statusGroups: 1=scheduled-soon, 2=scheduled-future, 3=live, 4=ended.
    // Treating 2 as IN_PLAY would tag a "future scheduled" match as in-play (cf.
    // season-matches.service.ts:226 for the canonical mapping documentation).
    const status =
      g.statusGroup === 4 ? 'FINISHED'
      : g.statusGroup === 3 ? 'IN_PLAY'
      : 'SCHEDULED';
    const homeId = g.homeCompetitor?.id ?? 0;
    const awayId = g.awayCompetitor?.id ?? 0;
    const hasScore = status !== 'SCHEDULED';
    const stageNum = g.stageNum ?? 0;
    return {
      id: g.id,
      date: new Date(g.startTime).toISOString(),
      homeTeam: g.homeCompetitor?.name ?? '',
      homeTeamId: homeId,
      awayTeam: g.awayCompetitor?.name ?? '',
      awayTeamId: awayId,
      homeScore: hasScore ? (g.homeCompetitor?.score ?? null) : null,
      awayScore: hasScore ? (g.awayCompetitor?.score ?? null) : null,
      status,
      stageNum,
      stageFr: stageNames[stageNum] ?? `Stage ${stageNum}`,
      hasOL: homeId === OL_365SCORES_ID || awayId === OL_365SCORES_ID,
    };
  }
}
