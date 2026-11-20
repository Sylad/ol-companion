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
import { outboundHeaders } from '../../config/outbound-http';

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

/**
 * Âge au-delà duquel une partie du cache (résultats, matchs à venir) gardée
 * faute de réponse de football-data n'est plus servie (L46). Compté depuis le
 * dernier appel réussi de CETTE partie : une écriture du cache pour l'autre
 * partie ne la rajeunit pas. Passé ce délai, l'heure d'un match donnée par
 * football-data n'est plus une information fiable (elle a pu être fixée ou
 * changée depuis) : le calendrier retombe sur la règle des 14 jours de
 * 365scores, qui est la règle prévue quand football-data se tait.
 */
const KEPT_MAX_AGE_MS = 24 * 3600_000;

/** Le cache sur disque : `finishedAt` / `upcomingAt` datent le dernier succès de chaque partie. */
interface CacheFile {
  ts: number;
  data: StoredMatch[];
  finishedAt?: number;
  upcomingAt?: number;
}

/**
 * Les matchs joués de toute la saison : le calendrier `.ics` (L264) publie la
 * saison entière, et un match sorti du flux disparaît des agendas abonnés.
 * Une saison compte 34 journées de Ligue 1 (20 suffisaient au seul tableau de
 * bord).
 */
const FINISHED_LIMIT = 40;
/**
 * Toute la fin de saison, pas les 10 prochains matchs : le calendrier a besoin
 * de savoir, journée par journée, si l'heure est fixée. `limit` va de 1 à 500
 * sur `/v4/teams/{id}/matches` et vaut 100 par défaut (documentation publique
 * de football-data, pages « Team » et « Lookup Tables », lues le 2026-10-03) ;
 * une saison compte au plus 34 journées de Ligue 1 plus les coupes couvertes.
 */
const UPCOMING_LIMIT = 100;

const isFinished = (m: StoredMatch): boolean => m.status === 'FINISHED';

/**
 * Statuts demandés à football-data, en liste séparée par des virgules (le
 * filtre `status` de v4 l'accepte : « Drill down on a (comma separated list
 * of) status », page « Lookup Tables » de la documentation v4, lue le
 * 2026-11-20). Toujours deux appels, aucun de plus.
 *
 * Revue r1 de L264 : avec `FINISHED` d'un côté et `SCHEDULED` de l'autre, un
 * match en cours (`IN_PLAY`, `PAUSED`), interrompu (`SUSPENDED`) ou reporté
 * (`POSTPONED`) n'était dans aucune des deux réponses : il sortait du cache
 * pendant le match, et un agenda abonné au `.ics` qui relisait à ce moment
 * effaçait l'événement. `CANCELLED` reste dehors : un match annulé n'a plus de
 * raison d'être dans un agenda.
 */
export const FINISHED_STATUSES = 'FINISHED,AWARDED';
export const UPCOMING_STATUSES = 'SCHEDULED,TIMED,IN_PLAY,PAUSED,SUSPENDED,POSTPONED';

/**
 * Statut football-data → statut retenu par l'app. `PAUSED` (mi-temps) est un
 * match en cours ; `AWARDED` (résultat sur tapis vert) un match terminé ;
 * `SUSPENDED` (interrompu, à rejouer ou reprendre à une date à venir) se lit
 * comme un report. Un statut inconnu se replie sur `SCHEDULED`.
 */
export function storedStatus(status: string): StoredMatch['status'] {
  switch (status) {
    case 'SCHEDULED':
    case 'TIMED':
    case 'IN_PLAY':
    case 'FINISHED':
    case 'POSTPONED':
      return status;
    case 'PAUSED':
    case 'LIVE':
      return 'IN_PLAY';
    case 'AWARDED':
      return 'FINISHED';
    case 'SUSPENDED':
      return 'POSTPONED';
    default:
      return 'SCHEDULED';
  }
}

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

    const previousFile = this.readCacheFile();
    const previous = previousFile?.data ?? null;
    const now = Date.now();
    // Dernier succès de chaque partie ; un cache écrit avant ces champs se date
    // par son horodatage global.
    const finishedAt = previousFile ? previousFile.finishedAt ?? previousFile.ts : now;
    const upcomingAt = previousFile ? previousFile.upcomingAt ?? previousFile.ts : now;
    try {
      // Deux appels : les matchs joués (limite à 40) et tout le reste de la
      // saison, matchs en cours compris (cf. UPCOMING_STATUSES).
      // `null` = appel refusé ou en échec, à ne pas confondre avec « 0 match ».
      const [finished, scheduled] = await Promise.all([
        this.fetchMatches(apiKey, FINISHED_STATUSES, FINISHED_LIMIT),
        this.fetchMatches(apiKey, UPCOMING_STATUSES, UPCOMING_LIMIT),
      ]);

      // Free tier doesn't return scheduled team matches — fallback via competition endpoint
      const upcoming =
        scheduled !== null && scheduled.length === 0
          ? await this.fetchUpcomingFromCompetition(apiKey)
          : scheduled;

      // Rien d'obtenu : le cache reste tel quel, horodatage compris.
      if (finished === null && upcoming === null) {
        // Le dernier succès, toutes parties : « plus de 24 h » vaut pour les deux.
        const latestSuccess = Math.max(finishedAt, upcomingAt);
        if (now - latestSuccess > KEPT_MAX_AGE_MS) {
          this.logger.error(
            `football-data : aucune réponse exploitable depuis plus de 24 h — le cache (${previous?.length ?? 0} match(s)) est servi tel quel`,
          );
        } else {
          this.logger.warn(
            'football-data : les deux appels ont échoué — cache existant conservé',
          );
        }
        return previous ?? [];
      }

      // Partie en échec : la dernière bonne réponse du cache la remplace. Un
      // appel refusé (429) ne retire donc jamais les matchs à venir, ni l'heure
      // qu'ils donnent au calendrier. La réponse fraîche l'emporte sur un match
      // gardé (un match à venir du cache, joué depuis, n'apparaît qu'une fois).
      // Une partie gardée depuis plus de 24 h est abandonnée (L46).
      // Un match qui change de statut entre les deux appels parallèles peut
      // être dans les deux réponses : la réponse « joué » l'emporte.
      const finishedIds = new Set((finished ?? []).map((m) => m.id));
      const fresh = [
        ...(finished ?? []),
        ...(upcoming ?? []).filter((m) => !finishedIds.has(m.id)),
      ];
      const freshIds = new Set(fresh.map((m) => m.id));
      const expired = (part: 'finished' | 'upcoming'): boolean =>
        now - (part === 'finished' ? finishedAt : upcomingAt) > KEPT_MAX_AGE_MS;
      const failedPart = finished === null ? 'finished' : upcoming === null ? 'upcoming' : null;
      const partLabel = failedPart === 'finished' ? 'matchs joués' : 'matchs à venir';
      const abandoned = failedPart !== null && expired(failedPart);
      const kept = abandoned
        ? []
        : (previous ?? []).filter(
            (m) =>
              (isFinished(m) ? finished === null : upcoming === null) &&
              !freshIds.has(m.id),
          );
      if (abandoned) {
        this.logger.error(
          `football-data : ${partLabel} en échec depuis plus de 24 h — la copie du cache est abandonnée`,
        );
      } else if (kept.length > 0) {
        this.logger.warn(
          `football-data : ${partLabel} en échec — ${kept.length} match(s) gardé(s) du cache`,
        );
      }

      const matches = [...fresh, ...kept].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
      );

      if (!abandoned && matches.length === 0 && previous && previous.length > 0) {
        this.logger.warn('football-data a rendu 0 match — cache existant conservé');
        return previous;
      }
      this.writeCache(matches, {
        finishedAt: finished !== null ? now : finishedAt,
        upcomingAt: upcoming !== null ? now : upcomingAt,
      });
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
          headers: outboundHeaders({ 'X-Auth-Token': apiKey }),
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
        headers: outboundHeaders({ 'X-Auth-Token': apiKey }),
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
    const status = storedStatus(m.status);
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
    return this.readCacheFile()?.data ?? null;
  }

  private readCacheFile(): CacheFile | null {
    if (!fs.existsSync(this.cacheFile)) return null;
    try {
      return JSON.parse(fs.readFileSync(this.cacheFile, 'utf-8')) as CacheFile;
    } catch (err: unknown) {
      this.logger.warn(`Failed to read fixtures cache (raw) ${this.cacheFile}: ${(err as Error)?.message ?? err}`);
      return null;
    }
  }

  private writeCache(
    data: StoredMatch[],
    parts: { finishedAt: number; upcomingAt: number },
  ): void {
    fs.mkdirSync(path.dirname(this.cacheFile), { recursive: true });
    atomicWriteJsonSync(this.cacheFile, { ts: Date.now(), data, ...parts });
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
