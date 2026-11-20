import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { atomicWriteJsonSync } from '../../common/atomic-write';
import { LIGUE1_FOOTBALL_DATA_ID } from '../../config/constants';
import { FootballDataMatchesResponseSchema, type FootballDataMatch } from '../../config/football-data.schema';
import { parseExternal } from '../../common/zod-validation.pipe';
import { outboundHeaders } from '../../config/outbound-http';
import type { FdLeagueMatch } from './match-impact';

/** Fraîcheur de la copie : au plus 4 appels par heure, le résultat d'un match y entre en 15 min. */
export const LEAGUE_MATCHES_TTL_MS = 15 * 60_000;

interface CacheFile { ts: number; matches: FdLeagueMatch[]; }

export interface LeagueMatches { matches: FdLeagueMatch[]; fetchedAt: number; }

export function toFdLeagueMatch(m: FootballDataMatch): FdLeagueMatch {
  return {
    id: m.id,
    utcDate: m.utcDate,
    status: m.status,
    matchday: m.matchday ?? null,
    homeTeam: { id: m.homeTeam.id, name: m.homeTeam.shortName ?? m.homeTeam.name ?? '' },
    awayTeam: { id: m.awayTeam.id, name: m.awayTeam.shortName ?? m.awayTeam.name ?? '' },
    score: { home: m.score?.fullTime?.home ?? null, away: m.score?.fullTime?.away ?? null },
  };
}

/**
 * L265 — tous les matchs de la saison de Ligue 1 en cours selon football-data.org
 * (`/v4/competitions/2015/matches`, un seul appel, offre gratuite). Lu à la
 * demande, jamais au démarrage : copie sur disque de 15 min ; un appel en échec
 * sert la dernière copie (quel que soit son âge, `fetchedAt` la date), et sans
 * copie rend `null`.
 */
@Injectable()
export class LeagueMatchesService {
  private readonly logger = new Logger(LeagueMatchesService.name);
  private readonly cacheFile = path.resolve(process.cwd(), 'data', 'ligue1-matches-fd.json');
  private inFlight: Promise<LeagueMatches | null> | null = null;

  constructor(private readonly config: ConfigService) {}

  async getMatches(): Promise<LeagueMatches | null> {
    const cached = this.readCache();
    if (cached && Date.now() - cached.ts < LEAGUE_MATCHES_TTL_MS) return { matches: cached.matches, fetchedAt: cached.ts };
    this.inFlight ??= this.refresh(cached).finally(() => { this.inFlight = null; });
    return this.inFlight;
  }

  private async refresh(cached: CacheFile | null): Promise<LeagueMatches | null> {
    const stale = cached ? { matches: cached.matches, fetchedAt: cached.ts } : null;
    const apiKey = this.config.get<string>('footballApiKey');
    if (!apiKey) return stale;
    const url = `https://api.football-data.org/v4/competitions/${LIGUE1_FOOTBALL_DATA_ID}/matches`;
    try {
      const res = await fetch(url, {
        headers: outboundHeaders({ 'X-Auth-Token': apiKey }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) {
        this.logger.warn(`Ligue 1 (football-data) → HTTP ${res.status} — ${stale ? 'copie gardée' : 'aucune copie'}`);
        return stale;
      }
      const data = parseExternal(FootballDataMatchesResponseSchema, await res.json(), 'football-data Ligue 1');
      const matches = (data.matches ?? []).map(toFdLeagueMatch);
      if (matches.length === 0) {
        this.logger.warn('Ligue 1 (football-data) : 0 match — copie gardée');
        return stale;
      }
      const ts = Date.now();
      fs.mkdirSync(path.dirname(this.cacheFile), { recursive: true });
      atomicWriteJsonSync(this.cacheFile, { ts, matches });
      return { matches, fetchedAt: ts };
    } catch (err) {
      this.logger.warn(`Ligue 1 (football-data) en échec : ${(err as Error)?.message ?? err}`);
      return stale;
    }
  }

  private readCache(): CacheFile | null {
    if (!fs.existsSync(this.cacheFile)) return null;
    try {
      const raw = JSON.parse(fs.readFileSync(this.cacheFile, 'utf-8')) as Partial<CacheFile>;
      if (typeof raw.ts !== 'number' || !Array.isArray(raw.matches)) return null;
      return raw as CacheFile;
    } catch (err) {
      this.logger.warn(`Copie Ligue 1 illisible : ${(err as Error)?.message ?? err}`);
      return null;
    }
  }
}
