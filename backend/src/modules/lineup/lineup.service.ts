import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

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

const OL_365_ID = 465;
const CACHE_TTL_MS = 6 * 3600_000; // 6h
const CACHE_FILE = path.resolve(process.cwd(), 'data', 'lineup-cache.json');

const SCORES365_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'application/json',
  'Accept-Language': 'fr-FR,fr;q=0.9',
  'X-Domain': 'fr',
  'Referer': 'https://www.365scores.com/fr/football/team/lyon-465',
  'Origin': 'https://www.365scores.com',
};

@Injectable()
export class LineupService {
  private readonly logger = new Logger(LineupService.name);

  async getLatestLineup(): Promise<LineupResponse | null> {
    const cached = this.readCache();
    if (cached) return cached;

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
    const url = `https://data.365scores.com/web/games/results/?appTypeId=5&langId=1&timezoneName=Europe/Paris&userCountryId=75&competitors=${OL_365_ID}&limit=10`;
    const res = await fetch(url, { headers: SCORES365_HEADERS, signal: AbortSignal.timeout(10_000) });
    if (!res.ok) {
      this.logger.warn(`results endpoint HTTP ${res.status}`);
      return null;
    }
    const data = (await res.json()) as any;
    const games: any[] = data.games ?? [];
    const finished = games.find((g) => g.statusGroup === 4 && g.hasLineups);
    return finished?.id ?? games[0]?.id ?? null;
  }

  private async fetchAndParseGame(gameId: number): Promise<LineupResponse | null> {
    const url = `https://webws.365scores.com/web/game/?appTypeId=5&langId=1&timezoneName=Europe/Paris&userCountryId=75&gameId=${gameId}&withLineups=true`;
    const res = await fetch(url, { headers: SCORES365_HEADERS, signal: AbortSignal.timeout(15_000) });
    if (!res.ok) {
      this.logger.warn(`game ${gameId} HTTP ${res.status}`);
      return null;
    }

    const data = (await res.json()) as any;
    const g = data.game;
    if (!g) return null;

    const olIsHome = g.homeCompetitor?.id === OL_365_ID;
    const olCompetitor = olIsHome ? g.homeCompetitor : g.awayCompetitor;
    const opponentCompetitor = olIsHome ? g.awayCompetitor : g.homeCompetitor;

    const olLineup = olCompetitor?.lineups;
    if (!olLineup?.members?.length) {
      this.logger.warn(`Game ${gameId}: no OL lineup members`);
      return null;
    }

    const memberById = new Map<number, any>();
    for (const m of g.members ?? []) memberById.set(m.id, m);

    const allPlayers: LineupPlayer[] = olLineup.members.map((m: any): LineupPlayer => {
      const meta = memberById.get(m.id) ?? {};
      const positionName = m.position?.name ?? '';
      const positionShort = m.formation?.shortName ?? this.shortenPosition(positionName);
      return {
        id: m.id,
        athleteId: meta.athleteId ?? m.id,
        name: meta.name ?? `Joueur #${m.id}`,
        shortName: meta.shortName ?? meta.name ?? `Joueur #${m.id}`,
        jerseyNumber: typeof meta.jerseyNumber === 'number' ? meta.jerseyNumber : null,
        position: positionName,
        positionShort,
        yardLine: m.yardFormation?.line ?? 0,
        yardSide: m.yardFormation?.fieldSide ?? 50,
        ranking: typeof m.ranking === 'number' ? m.ranking : null,
        isStarting: m.status === 1,
        imageVersion: meta.imageVersion,
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
    } catch {}
    return null;
  }

  private writeCache(data: LineupResponse): void {
    fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
    fs.writeFileSync(CACHE_FILE, JSON.stringify({ ts: Date.now(), data }));
  }
}
