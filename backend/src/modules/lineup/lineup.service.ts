import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import * as fs from 'fs';
import * as path from 'path';
import { OL_365SCORES_ID } from '../../config/constants';
import { scores365Headers, SCORES365_REFERER } from '../../config/scores365-http';
import {
  Scores365GameDetailResponseSchema,
  Scores365GamesResponseSchema,
  type Scores365LineupMember,
} from '../../config/scores365-game.schema';
import { parseExternal } from '../../common/zod-validation.pipe';

export interface LineupPlayer {
  id: number;
  athleteId: number;
  name: string;
  shortName: string;
  jerseyNumber: number | null;
  position: string;
  positionShort: string;
  yardLine: number;          // 1=GK, 2=DEF, 3=MID, 4=ATK
  yardSide: number;          // 0..100, 50=center
  ranking: number | null;
  isStarting: boolean;
  imageVersion?: number;
}

export interface LineupResponse {
  gameId: number;
  date: string;
  competition: string;
  matchday: number | null;
  opponent: string;
  opponentId: number;
  isHome: boolean;
  homeScore: number | null;
  awayScore: number | null;
  formation: string;
  starters: LineupPlayer[];
  bench: LineupPlayer[];
  injured: LineupPlayer[];
}

const CACHE_TTL_MS = 6 * 3600_000; // 6h
const CACHE_FILE = path.resolve(process.cwd(), 'data', 'lineup-cache.json');

const SCORES365_HEADERS = scores365Headers(SCORES365_REFERER.team);

@Injectable()
export class LineupService implements OnModuleInit {
  private readonly logger = new Logger(LineupService.name);

  onModuleInit() {
    this.getLatestLineup({ force: true }).catch((err) =>
      this.logger.warn(`Initial lineup refresh failed: ${(err as Error).message}`),
    );
  }

  @Cron('0 */15 * * * *', { name: 'lineup-refresh', timeZone: 'Europe/Paris' })
  async scheduledRefresh() {
    await this.getLatestLineup({ force: true }).catch((err) =>
      this.logger.warn(`Periodic lineup refresh failed: ${(err as Error).message}`),
    );
  }

  async getLatestLineup(opts: { force?: boolean } = {}): Promise<LineupResponse | null> {
    if (!opts.force) {
      const cached = this.readCache();
      if (cached) return cached;
    }

    try {
      const gameId = await this.findLatestGameId();
      if (!gameId) {
        this.logger.warn('No recent OL game found');
        return null;
      }

      const lineup = await this.fetchAndParseGame(gameId);
      if (lineup) this.writeCache(lineup);
      return lineup;
    } catch (err) {
      this.logger.error(`getLatestLineup failed: ${(err as Error).message}`);
      return null;
    }
  }

  private async findLatestGameId(): Promise<number | null> {
    const url = `https://data.365scores.com/web/games/results/?appTypeId=5&langId=1&timezoneName=Europe/Paris&userCountryId=75&competitors=${OL_365SCORES_ID}&limit=10`;
    const res = await fetch(url, { headers: SCORES365_HEADERS, signal: AbortSignal.timeout(10_000) });
    if (!res.ok) {
      this.logger.warn(`results endpoint HTTP ${res.status}`);
      return null;
    }
    const data = parseExternal(Scores365GamesResponseSchema, await res.json(), '365scores lineup results');
    const games = data.games ?? [];
    const finished = games.find((g) => g.statusGroup === 4 && g.hasLineups === true);
    return finished?.id ?? games[0]?.id ?? null;
  }

  private async fetchAndParseGame(gameId: number): Promise<LineupResponse | null> {
    const url = `https://webws.365scores.com/web/game/?appTypeId=5&langId=1&timezoneName=Europe/Paris&userCountryId=75&gameId=${gameId}&withLineups=true`;
    const res = await fetch(url, { headers: SCORES365_HEADERS, signal: AbortSignal.timeout(15_000) });
    if (!res.ok) {
      this.logger.warn(`game ${gameId} HTTP ${res.status}`);
      return null;
    }

    const json = await res.json();
    const data = parseExternal(Scores365GameDetailResponseSchema, json, `365scores lineup game ${gameId}`);
    const g = data.game;
    if (!g) return null;

    const olIsHome = g.homeCompetitor?.id === OL_365SCORES_ID;
    const olCompetitor = olIsHome ? g.homeCompetitor : g.awayCompetitor;
    const opponentCompetitor = olIsHome ? g.awayCompetitor : g.homeCompetitor;

    const olLineup = olCompetitor?.lineups;
    if (!olLineup?.members?.length) {
      this.logger.warn(`Game ${gameId}: no OL lineup members`);
      return null;
    }

    /** Top-level `game.members[]` carries display metadata (name/jersey/imageVersion);
     *  lineup `members[]` carries on-pitch state (formation/ranking/status). We index
     *  the meta map by id then merge per lineup row. */
    type TopLevelMember = NonNullable<typeof g.members>[number];
    const memberById = new Map<number, TopLevelMember>();
    for (const m of g.members ?? []) memberById.set(m.id, m);

    const allPlayers: LineupPlayer[] = olLineup.members.map((m: Scores365LineupMember): LineupPlayer => {
      const meta = memberById.get(m.id);
      const positionName = m.position?.name ?? '';
      const positionShort = m.formation?.shortName ?? this.shortenPosition(positionName);
      return {
        id: m.id,
        athleteId: meta?.athleteId ?? m.athleteId ?? m.id,
        name: meta?.name ?? `Joueur #${m.id}`,
        shortName: meta?.shortName ?? meta?.name ?? `Joueur #${m.id}`,
        jerseyNumber: typeof meta?.jerseyNumber === 'number' ? meta.jerseyNumber : null,
        position: positionName,
        positionShort,
        yardLine: m.yardFormation?.line ?? 0,
        yardSide: m.yardFormation?.fieldSide ?? 50,
        ranking: typeof m.ranking === 'number' ? m.ranking : null,
        isStarting: m.status === 1,
        imageVersion: meta?.imageVersion,
      };
    });

    const starters = allPlayers
      .filter((p) => p.isStarting)
      .sort((a, b) => a.yardLine - b.yardLine);
    const bench = allPlayers.filter((p) => !p.isStarting && (p.yardLine === 0 || p.yardLine > 4));
    const benchOnly = allPlayers.filter((p) => !p.isStarting);

    return {
      gameId: g.id,
      date: g.startTime,
      competition: g.competitionDisplayName ?? '',
      matchday: g.roundNum ?? null,
      opponent: opponentCompetitor?.name ?? '',
      opponentId: opponentCompetitor?.id ?? 0,
      isHome: olIsHome,
      homeScore: g.homeCompetitor?.score ?? null,
      awayScore: g.awayCompetitor?.score ?? null,
      formation: olLineup.formation ?? '',
      starters,
      bench: benchOnly,
      injured: [],
    };
  }

  private shortenPosition(name: string): string {
    const map: Record<string, string> = {
      Goalkeeper: 'GK',
      Defender: 'DEF',
      'Centre-Back': 'CB',
      'Right-Back': 'RB',
      'Left-Back': 'LB',
      Midfielder: 'MID',
      'Defensive Midfield': 'DM',
      'Central Midfield': 'CM',
      'Attacking Midfield': 'AM',
      'Right Winger': 'RW',
      'Left Winger': 'LW',
      Forward: 'FW',
      Striker: 'ST',
      Attacker: 'ATK',
    };
    return map[name] ?? name.slice(0, 3).toUpperCase();
  }

  private readCache(): LineupResponse | null {
    if (!fs.existsSync(CACHE_FILE)) return null;
    try {
      const { ts, data } = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
      if (Date.now() - ts < CACHE_TTL_MS) return data;
    } catch (err: unknown) {
      this.logger.warn(`Failed to read lineup cache ${CACHE_FILE}: ${(err as Error)?.message ?? err}`);
    }
    return null;
  }

  private writeCache(data: LineupResponse): void {
    fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
    fs.writeFileSync(CACHE_FILE, JSON.stringify({ ts: Date.now(), data }));
  }
}
