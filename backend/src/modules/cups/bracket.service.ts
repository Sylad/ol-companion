import { Injectable, Logger } from '@nestjs/common';
import type { BracketInfo, BracketMatch, BracketStage } from './cups.service';

const OL_365SCORES_ID = 465;

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

const SCORES365_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'application/json',
  'Accept-Language': 'fr-FR,fr;q=0.9',
  'X-Domain': 'fr',
  'Referer': 'https://www.365scores.com/fr/football',
  'Origin': 'https://www.365scores.com',
};

@Injectable()
export class BracketService {
  private readonly logger = new Logger(BracketService.name);

  async fetchBracket(competitionId: number, fromStageNum: number, seasonStart: Date): Promise<BracketInfo | null> {
    const url = `https://data.365scores.com/web/games/?appTypeId=5&langId=1&timezoneName=Europe/Paris&competitions=${competitionId}&limit=200`;

    let games: any[] = [];
    try {
      const res = await fetch(url, { headers: SCORES365_HEADERS, signal: AbortSignal.timeout(10_000) });
      if (!res.ok) {
        this.logger.warn(`Bracket fetch HTTP ${res.status} for comp ${competitionId}`);
        return null;
      }
      const d = await res.json() as any;
      games = d.games ?? [];
    } catch (err) {
      this.logger.warn(`Bracket fetch failed for comp ${competitionId}: ${(err as Error).message}`);
      return null;
    }

    const seasonStartMs = seasonStart.getTime();
    const stageNames = STAGE_NAMES[competitionId] ?? {};

    const eligible = games
      .filter((g) => (g.stageNum ?? 0) >= fromStageNum)
      .filter((g) => new Date(g.startTime).getTime() >= seasonStartMs);

    if (eligible.length === 0) return null;

    const byStage = new Map<number, BracketMatch[]>();
    for (const g of eligible) {
      const stageNum = g.stageNum;
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

  private toBracketMatch(g: any, stageNames: Record<number, string>): BracketMatch {
    const status =
      g.statusGroup === 4 ? 'FINISHED'
      : g.statusGroup === 2 ? 'IN_PLAY'
      : 'SCHEDULED';
    const homeId = g.homeCompetitor?.id ?? 0;
    const awayId = g.awayCompetitor?.id ?? 0;
    const hasScore = status !== 'SCHEDULED';
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
      stageNum: g.stageNum,
      stageFr: stageNames[g.stageNum] ?? `Stage ${g.stageNum}`,
      hasOL: homeId === OL_365SCORES_ID || awayId === OL_365SCORES_ID,
    };
  }
}
