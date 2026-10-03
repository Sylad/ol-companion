import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import * as fs from 'fs';
import * as path from 'path';
import { atomicWriteJsonSync } from '../../common/atomic-write';
import { EventBusService } from '../events/event-bus.service';
import { OL_TEAM_ID, LIGUE1_FOOTBALL_DATA_ID } from '../../config/constants';
import {
  FootballDataMatchesResponseSchema,
  type FootballDataMatch,
} from '../../config/football-data.schema';
import { parseExternal } from '../../common/zod-validation.pipe';
import { footballDataTimeConfirmed } from './kickoff-time';

/** Un match tel qu'il est écrit dans le cache — sans champ dérivé. */
interface StoredMatch {
  id: number;
  date: string;
  homeTeam: string;
  homeTeamId: number;
  awayTeam: string;
  awayTeamId: number;
  homeScore: number | null;
  awayScore: number | null;
  competition: string;
  status: 'SCHEDULED' | 'TIMED' | 'IN_PLAY' | 'FINISHED' | 'POSTPONED';
  matchday: number | null;
}

export interface Match extends StoredMatch {
  /**
   * `false` quand football-data dit que l'heure du coup d'envoi n'est pas
   * fixée (cf. `footballDataTimeConfirmed`). Dérivé du statut et de la date à
   * chaque lecture, jamais écrit dans le cache : un cache antérieur à ce champ
   * est servi correctement.
   */
  timeConfirmed: boolean;
}

function withTimeConfirmed(matches: StoredMatch[]): Match[] {
  return matches.map((m) => ({
    ...m,
    timeConfirmed: footballDataTimeConfirmed(m.status, m.date),
  }));
}

const CACHE_TTL_MS = 3600_000;

/** Les 20 derniers résultats suffisent au tableau de bord (dernier résultat). */
const FINISHED_LIMIT = 20;
/**
 * Toute la fin de saison, pas les 10 prochains matchs : le calendrier a besoin
 * de savoir, journée par journée, si l'heure est fixée. `limit` va de 1 à 500
 * sur `/v4/teams/{id}/matches` et vaut 100 par défaut (documentation publique
 * de football-data, pages « Team » et « Lookup Tables », lues le 2026-10-03) ;
 * une saison compte au plus 34 journées de Ligue 1 plus les coupes couvertes.
 */
const UPCOMING_LIMIT = 100;

const isFinished = (m: StoredMatch): boolean => m.status === 'FINISHED';

@Injectable()
export class FixturesService implements OnModuleInit {
  private readonly logger = new Logger(FixturesService.name);
  private readonly cacheFile = path.resolve(process.cwd(), 'data', 'fixtures-cache.json');

  constructor(
    private config: ConfigService,
    private readonly bus: EventBusService,
  ) {}

  onModuleInit() {
    this.getFixtures({ force: true }).catch((err) =>
      this.logger.warn(`Initial fixtures refresh failed: ${(err as Error).message}`),
    );
  }

  @Cron('0 */30 * * * *', { name: 'fixtures-refresh', timeZone: 'Europe/Paris' })
  async scheduledRefresh() {
    await this.getFixtures({ force: true }).catch((err) =>
      this.logger.warn(`Periodic fixtures refresh failed: ${(err as Error).message}`),
    );
  }

  async getFixtures(opts: { force?: boolean } = {}): Promise<Match[]> {
    return withTimeConfirmed(await this.loadFixtures(opts));
  }

  /**
   * Le dernier calendrier connu, lu dans le cache quel que soit son âge et
   * SANS appel à football-data. Pour les services qui veulent seulement savoir
   * ce que football-data a dit d'un match (heure fixée ou non) sans déclencher
   * de rafraîchissement.
   */
  peekFixtures(): Match[] {
    return withTimeConfirmed(this.readCacheRaw() ?? []);
  }

  private async loadFixtures(opts: { force?: boolean }): Promise<StoredMatch[]> {
    if (!opts.force) {
      const cached = this.readCache();
      if (cached) return cached;
    }

    const apiKey = this.config.get<string>('footballApiKey');
    if (!apiKey) return [];

    const previous = this.readCacheRaw();
    try {
      // Two separate calls — football-data v4 only accepts one status at a time.
      // `null` = appel refusé ou en échec, à ne pas confondre avec « 0 match ».
      const [finished, scheduled] = await Promise.all([
        this.fetchMatches(apiKey, 'FINISHED', FINISHED_LIMIT),
        this.fetchMatches(apiKey, 'SCHEDULED', UPCOMING_LIMIT),
      ]);

      // Free tier doesn't return scheduled team matches — fallback via competition endpoint
      const upcoming =
        scheduled !== null && scheduled.length === 0
          ? await this.fetchUpcomingFromCompetition(apiKey)
          : scheduled;

      // Rien d'obtenu : le cache reste tel quel, horodatage compris.
      if (finished === null && upcoming === null) {
        this.logger.warn(
          'football-data : les deux appels ont échoué — cache existant conservé',
        );
        return previous ?? [];
      }

      // Partie en échec : la dernière bonne réponse du cache la remplace. Un
      // appel refusé (429) ne retire donc jamais les matchs à venir, ni l'heure
      // qu'ils donnent au calendrier. La réponse fraîche l'emporte sur un match
      // gardé (un match à venir du cache, joué depuis, n'apparaît qu'une fois).
      const fresh = [...(finished ?? []), ...(upcoming ?? [])];
      const freshIds = new Set(fresh.map((m) => m.id));
      const kept = (previous ?? []).filter(
        (m) =>
          (isFinished(m) ? finished === null : upcoming === null) &&
          !freshIds.has(m.id),
      );
      if (kept.length > 0) {
        this.logger.warn(
          `football-data : ${finished === null ? 'matchs joués' : 'matchs à venir'} en échec — ${kept.length} match(s) gardé(s) du cache`,
        );
      }

      const matches = [...fresh, ...kept].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
      );

      if (matches.length === 0 && previous && previous.length > 0) {
        this.logger.warn('football-data a rendu 0 match — cache existant conservé');
        return previous;
      }
      this.writeCache(matches);
      if (this.fixturesChanged(previous, matches)) {
        this.bus.emit('fixtures-changed', { count: matches.length });
      }
      return matches;
    } catch (err) {
      this.logger.error('Erreur fetch fixtures', err);
      return previous ?? [];
    }
  }

  /**
   * Le prochain match de l'OL cherché journée par journée. `null` quand rien
   * n'a été trouvé ET qu'un appel au moins a été refusé ou a échoué : l'absence
   * de match à venir n'est alors pas une réponse de football-data.
   */
  private async fetchUpcomingFromCompetition(apiKey: string): Promise<StoredMatch[] | null> {
    // Try the next 3 matchdays starting from an estimate
    const now = new Date();
    // Fetch current matchday from standings cache if available
    let startMatchday = 30;
    try {
      const standingsCachePath = path.resolve(process.cwd(), 'data', 'standings-cache.json');
      if (fs.existsSync(standingsCachePath)) {
        const { data } = JSON.parse(fs.readFileSync(standingsCachePath, 'utf-8'));
        // Le prochain match d'OL vit le plus souvent DANS le matchday courant
        // (démarrer à +1 le sautait). Review 2026-08-14.
        startMatchday = data?.currentMatchday ?? 30;
      }
    } catch (err: unknown) {
      this.logger.warn(`Failed to read standings cache for matchday hint: ${(err as Error)?.message ?? err}`);
    }

    const matchdays = [startMatchday, startMatchday + 1, startMatchday + 2];
    let failed = false;
    for (const md of matchdays) {
      try {
        const url = `https://api.football-data.org/v4/competitions/${LIGUE1_FOOTBALL_DATA_ID}/matches?matchday=${md}`;
        const res = await fetch(url, {
          headers: { 'X-Auth-Token': apiKey },
          signal: AbortSignal.timeout(10_000),
        });
        if (!res.ok) {
          this.logger.warn(`competition J${md} → HTTP ${res.status}`);
          failed = true;
          continue;
        }
        const data = parseExternal(
          FootballDataMatchesResponseSchema,
          await res.json(),
          `football-data competition J${md}`,
        );
        const olMatch = (data.matches ?? []).find(
          (m) => m.homeTeam.id === OL_TEAM_ID || m.awayTeam.id === OL_TEAM_ID,
        );
        if (olMatch && new Date(olMatch.utcDate) > now) {
          this.logger.log(`Prochain match OL trouvé via compétition J${md}: ${olMatch.homeTeam.shortName ?? ''} vs ${olMatch.awayTeam.shortName ?? ''}`);
          return [this.toMatch(olMatch, md)];
        }
      } catch (err) {
        this.logger.warn(`Competition matchday ${md} fetch failed: ${(err as Error).message}`);
        failed = true;
      }
    }
    return failed ? null : [];
  }

  /**
   * Les matchs d'un statut. `null` quand l'appel est refusé (429, 403…) ou
   * échoue (réseau, délai, charge illisible) — jamais `[]`, qui veut dire
   * « football-data n'a aucun match de ce statut ».
   */
  private async fetchMatches(apiKey: string, status: string, limit: number): Promise<StoredMatch[] | null> {
    const url = `https://api.football-data.org/v4/teams/${OL_TEAM_ID}/matches?status=${status}&limit=${limit}`;
    try {
      const res = await fetch(url, {
        headers: { 'X-Auth-Token': apiKey },
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) {
        this.logger.warn(`fixtures?status=${status} → HTTP ${res.status}`);
        return null;
      }
      const data = parseExternal(
        FootballDataMatchesResponseSchema,
        await res.json(),
        `football-data fixtures status=${status}`,
      );
      return (data.matches ?? []).map((m) => this.toMatch(m));
    } catch (err) {
      this.logger.warn(`fixtures?status=${status} failed: ${(err as Error)?.message ?? err}`);
      return null;
    }
  }

  /**
   * football-data → internal `Match` mapping. Centralized so both the
   * team endpoint AND the competition fallback (used to find the next
   * match when the team endpoint returns no SCHEDULED matches on the
   * free tier) emit the exact same shape.
   */
  private toMatch(m: FootballDataMatch, fallbackMatchday?: number): StoredMatch {
    const allowed: StoredMatch['status'][] = ['SCHEDULED', 'TIMED', 'IN_PLAY', 'FINISHED', 'POSTPONED'];
    const status = (allowed as string[]).includes(m.status)
      ? (m.status as StoredMatch['status'])
      : 'SCHEDULED';
    return {
      id: m.id,
      date: m.utcDate,
      homeTeam: m.homeTeam.name ?? m.homeTeam.shortName ?? '',
      homeTeamId: m.homeTeam.id,
      awayTeam: m.awayTeam.name ?? m.awayTeam.shortName ?? '',
      awayTeamId: m.awayTeam.id,
      homeScore: m.score?.fullTime?.home ?? null,
      awayScore: m.score?.fullTime?.away ?? null,
      competition: m.competition?.name ?? (fallbackMatchday !== undefined ? 'Ligue 1' : ''),
      status,
      matchday: m.matchday ?? fallbackMatchday ?? null,
    };
  }

  private readCache(): StoredMatch[] | null {
    if (!fs.existsSync(this.cacheFile)) return null;
    try {
      const { ts, data } = JSON.parse(fs.readFileSync(this.cacheFile, 'utf-8'));
      if (Date.now() - ts < CACHE_TTL_MS) return data;
    } catch (err: unknown) {
      this.logger.warn(`Failed to read fixtures cache ${this.cacheFile}: ${(err as Error)?.message ?? err}`);
    }
    return null;
  }

  private readCacheRaw(): StoredMatch[] | null {
    if (!fs.existsSync(this.cacheFile)) return null;
    try {
      const { data } = JSON.parse(fs.readFileSync(this.cacheFile, 'utf-8'));
      return data;
    } catch (err: unknown) {
      this.logger.warn(`Failed to read fixtures cache (raw) ${this.cacheFile}: ${(err as Error)?.message ?? err}`);
      return null;
    }
  }

  private writeCache(data: StoredMatch[]): void {
    fs.mkdirSync(path.dirname(this.cacheFile), { recursive: true });
    atomicWriteJsonSync(this.cacheFile, { ts: Date.now(), data });
  }

  private fixturesChanged(prev: StoredMatch[] | null, next: StoredMatch[]): boolean {
    if (!prev || prev.length !== next.length) return true;
    for (let i = 0; i < next.length; i++) {
      const p = prev[i], n = next[i];
      if (p.id !== n.id || p.status !== n.status || p.homeScore !== n.homeScore || p.awayScore !== n.awayScore || p.date !== n.date) {
        return true;
      }
    }
    return false;
  }
}
