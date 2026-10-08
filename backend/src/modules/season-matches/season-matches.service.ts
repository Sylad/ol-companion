import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import * as fs from 'fs';
import * as path from 'path';
import { atomicWriteJsonSync } from '../../common/atomic-write';
import { EventBusService } from '../events/event-bus.service';
import { getCurrentSeason } from '../scheduler/season.util';
import {
  OL_365SCORES_ID,
  OL_TEAM_ID,
  LIGUE1_365SCORES_ID,
  COUPE_DE_FRANCE_365SCORES_ID,
  EUROPA_LEAGUE_365SCORES_ID,
  CHAMPIONS_LEAGUE_365SCORES_ID,
  CHAMPIONS_LEAGUE_QUALIFIERS_365SCORES_ID,
} from '../../config/constants';
import { scores365Headers, SCORES365_API_BASE, SCORES365_REFERER } from '../../config/scores365-http';
import { Scores365GamesResponseSchema, type Scores365Game, type Scores365GamesResponse } from '../../config/scores365-game.schema';
import { parseExternal } from '../../common/zod-validation.pipe';
import { FixturesService } from '../fixtures/fixtures.service';
import { isKickoffTimeConfirmed } from './kickoff-confirmation';

/**
 * Match in a season-wide bucket. The shape mirrors the existing `Match`
 * interface used by /api/fixtures (so the frontend mapping stays familiar)
 * and adds a stable `competitionCode` discriminator the UI can switch on
 * without parsing free-form competition names.
 */
/**
 * Code stable d'une compétition suivie. `UCL` couvre la Ligue des champions et
 * ses qualifications.
 */
export type CompetitionCode = 'L1' | 'CDF' | 'UEL' | 'UCL';

/** Un match tel qu'il est écrit dans le cache — sans champ dérivé. */
interface StoredSeasonMatch {
  id: number;
  date: string;
  homeTeam: string;
  homeTeamId: number;
  awayTeam: string;
  awayTeamId: number;
  homeScore: number | null;
  awayScore: number | null;
  competition: string;
  /** Stable code for the consumer (map markers L1, popup CdF section, …). */
  competitionCode: CompetitionCode;
  competitionId: number;
  status: 'SCHEDULED' | 'IN_PLAY' | 'FINISHED';
  /**
   * Journée : `roundNum` de 365scores (J1–J34 en Ligue 1, J1–J8 en phase de
   * ligue européenne). `null` quand la source n'en donne pas (tours à
   * élimination directe).
   */
  matchday: number | null;
  /**
   * Tour et manche d'un match SANS journée, quand 365scores les donne :
   * « 3e tour de qualification · aller », « Barrages · retour ». `null` pour un
   * match à journée, et pour un tour dont on n'a pas le nom français.
   */
  round: string | null;
}

export interface SeasonMatch extends StoredSeasonMatch {
  /**
   * `false` quand aucune source ne confirme l'heure du coup d'envoi — la date
   * porte alors une heure de remplissage de 365scores, à ne pas afficher. Voir
   * `isKickoffTimeConfirmed`. Dérivé à chaque lecture du dernier calendrier
   * football-data connu, jamais écrit dans le cache.
   */
  timeConfirmed: boolean;
}

/**
 * Les compétitions suivies — LA liste : ce qui n'y est pas n'entre ni dans le
 * calendrier, ni dans la carte, ni dans les statistiques d'équipe et de
 * joueurs, qui lisent tous `getMatches()`. Une compétition de la saison qui
 * n'y figure pas est journalisée à chaque rafraîchissement, jamais écartée en
 * silence (les 4 qualifications de Ligue des champions d'août 2026 l'ont été).
 *
 * Les qualifications de Ligue des champions sont chez 365scores une compétition
 * à part (332) : même code et même nom que la Ligue des champions (572), le
 * tour les distingue (`round`).
 */
const TRACKED_COMPETITIONS: Record<
  number,
  { code: CompetitionCode; name: string }
> = {
  [LIGUE1_365SCORES_ID]: { code: 'L1', name: 'Ligue 1' },
  [COUPE_DE_FRANCE_365SCORES_ID]: { code: 'CDF', name: 'Coupe de France' },
  [EUROPA_LEAGUE_365SCORES_ID]: { code: 'UEL', name: 'Ligue Europa' },
  [CHAMPIONS_LEAGUE_365SCORES_ID]: {
    code: 'UCL',
    name: 'Ligue des champions',
  },
  [CHAMPIONS_LEAGUE_QUALIFIERS_365SCORES_ID]: {
    code: 'UCL',
    name: 'Ligue des champions',
  },
};

/**
 * Nom français des tours que 365scores nomme en anglais (`stageName`, langId=1).
 * Mesuré sur la saison du 2026-10-03 : « 3rd Round » et « Playoffs » pour les
 * qualifications de Ligue des champions. Un tour absent d'ici n'est pas
 * affiché — jamais de libellé anglais à l'écran.
 */
function stageLabel(competitionId: number, stageName?: string): string | null {
  if (!stageName) return null;
  if (competitionId === CHAMPIONS_LEAGUE_QUALIFIERS_365SCORES_ID) {
    const nth = /^(\d)(?:st|nd|rd|th) Round$/.exec(stageName);
    if (nth) return `${nth[1]}${nth[1] === '1' ? 'er' : 'e'} tour de qualification`;
    if (stageName === 'Playoffs') return 'Barrages';
  }
  return null;
}

/** Manche d'une confrontation aller-retour (`legNum` 1 ou 2). */
function legLabel(legNum?: number): string | null {
  return legNum === 1 ? 'aller' : legNum === 2 ? 'retour' : null;
}

// Durée maximale pendant laquelle la garde tient une saison plus courte ou
// incomplète : au-delà, la panne est tenue pour déterministe (404, schéma
// refusé) et la saison lue est écrite — jamais une saison vide.
const GUARD_MAX_MS = 6 * 3_600_000;
const CACHE_TTL_MS = 1800_000; // 30 min — FINISHED never changes, SCHEDULED rarely shifts
/**
 * Pagination depth — page 1 returns ~50 events but `paging.previousPage`
 * URLs carry `games=1` from 365scores, so each subsequent call only yields
 * ~5 events. 8 pages covers a full Ligue 1 season + cups + Europa group
 * stage starting in early August.
 */
const PAGES = 8;
const PAGE_LIMIT = 50;
/**
 * Marche avant : chaque page « suivante » ne rend que 3 à 5 matchs. Mesuré le
 * 2026-10-03 : avec 8 pages depuis le dernier résultat, la saison s'arrêtait à
 * J28 (17-04-2027) et J29–J34 manquaient. La page `/web/games/fixtures/` rend
 * d'abord ~27 matchs à venir d'un coup ; il reste 3 pages + 1 vide ce jour-là.
 * 12 couvre une saison entière même si cette page échoue ; le plafond atteint
 * avec une page suivante encore annoncée est journalisé, jamais silencieux.
 */
const FORWARD_PAGES = 12;

const SCORES365_HEADERS = scores365Headers(SCORES365_REFERER.team);

/**
 * Fetcher type aliased so tests can swap `fetch` without DI churn.
 * (Mirrors what bracket.service.ts does with global fetch.)
 */
type Fetcher = typeof fetch;

@Injectable()
export class SeasonMatchesService implements OnModuleInit {
  private readonly logger = new Logger(SeasonMatchesService.name);
  private readonly cacheFile = path.resolve(process.cwd(), 'data', 'season-matches-cache.json');

  /** Test seam — overriden via spec, defaults to global fetch. */
  fetcher: Fetcher = (input, init) => fetch(input, init);

  /** Attente avant le nouvel essai d'une page en échec — remise à 0 par les specs. */
  retryDelayMs = 1_000;

  /**
   * Instant où la garde « parcours incomplet ou vide » a gardé l'ancienne saison.
   * Le cache n'est alors pas réécrit (son `ts` reste ancien) : sans ce repère,
   * chaque lecture non forcée relancerait un parcours complet de 365scores
   * (≥ 21 s de timeouts) pendant toute la panne. Seuls le cron et le forçage
   * retentent ; une lecture ordinaire sert l'ancienne saison pendant un TTL.
   */
  private degradedAt: number | null = null;
  /** Début de la série de gardes en cours (remis à zéro par une écriture). */
  private degradedSince: number | null = null;

  constructor(
    private readonly bus: EventBusService,
    private readonly fixtures: FixturesService,
  ) {}

  onModuleInit() {
    this.getMatches({ force: true }).catch((err) =>
      this.logger.warn(`Initial season-matches refresh failed: ${(err as Error).message}`),
    );
  }

  @Cron('0 */30 * * * *', { name: 'season-matches-refresh', timeZone: 'Europe/Paris' })
  async scheduledRefresh() {
    await this.getMatches({ force: true }).catch((err) =>
      this.logger.warn(`Periodic season-matches refresh failed: ${(err as Error).message}`),
    );
  }

  async getMatches(opts: { force?: boolean } = {}): Promise<SeasonMatch[]> {
    const footballData = this.fixtures.peekFixtures();
    return (await this.loadMatches(opts)).map((m) => ({
      ...m,
      timeConfirmed: isKickoffTimeConfirmed(m, footballData),
    }));
  }

  private async loadMatches(opts: { force?: boolean }): Promise<StoredSeasonMatch[]> {
    if (!opts.force) {
      const cached = this.readCache();
      if (cached) return cached;
      if (this.degradedAt !== null && Date.now() - this.degradedAt < CACHE_TTL_MS) {
        const previous = this.readCacheRaw();
        if (previous) return previous;
      }
    }

    try {
      const { matches, complete } = await this.fetchFrom365Scores();
      const previous = this.readCacheRaw();
      // Garde : une saison incomplète (une page de résultats, des matchs à
      // venir ou de la marche avant en échec après son nouvel essai — timeout
      // du 2026-10-06 : 38 matchs au lieu de 46, J27–J34 perdues) ou vide
      // (panne totale ; fetchFrom365Scores avale ses erreurs, review
      // 2026-08-14) ne remplace jamais une saison déjà connue : on garde
      // l'ancienne sans la réécrire, et le cron ou le forçage retentent.
      // Une enveloppe sans `games` en HTTP 200 ou le plafond FORWARD_PAGES
      // laissent `complete` vrai : une saison plus courte en matchs que celle
      // du cache (un match ne disparaît pas en cours de saison) est refusée
      // de même. Borne d'âge : après GUARD_MAX_MS de garde, on écrit.
      const shorter = !!previous && matches.length < previous.length;
      const expired =
        this.degradedSince !== null && Date.now() - this.degradedSince > GUARD_MAX_MS && matches.length > 0;
      if ((!complete || shorter || matches.length === 0) && previous && previous.length > 0 && !expired) {
        this.logger.warn(
          `365scores : parcours incomplet (${matches.length} matchs contre ${previous.length} en cache) — cache existant conservé`,
        );
        this.degradedSince ??= Date.now();
        this.degradedAt = Date.now();
        return previous;
      }
      if (expired) {
        this.logger.warn(
          `365scores : parcours à ${matches.length} matchs contre ${previous?.length ?? 0} en cache, garde tenue plus de 6 h — saison lue écrite`,
        );
      }
      this.degradedSince = null;
      this.degradedAt = null;
      this.writeCache(matches);
      if (this.matchesChanged(previous, matches)) {
        this.bus.emit('season-matches-changed', { count: matches.length });
      }
      return matches;
    } catch (err) {
      this.logger.error('getMatches (365scores) failed', err);
      return [];
    }
  }

  /**
   * Une page 365scores, réessayée une fois sur un timeout, une erreur réseau ou
   * un HTTP 5xx/429. `null` : la page a échoué (journalisé) ; une page lue mais
   * vide n'est PAS un échec.
   */
  private async fetchPage(url: string, what: string): Promise<Scores365GamesResponse | null> {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const res = await this.fetcher(url, { headers: SCORES365_HEADERS, signal: AbortSignal.timeout(8_000) });
        if (res.ok) return parseExternal(Scores365GamesResponseSchema, await res.json(), `365scores season ${what}`);
        this.logger.warn(`365scores ${what} → HTTP ${res.status} (essai ${attempt}/2)`);
        if (res.status < 500 && res.status !== 429) return null;
      } catch (err) {
        this.logger.warn(`365scores ${what} en échec (essai ${attempt}/2) : ${(err as Error)?.message ?? err}`);
      }
      if (attempt < 2 && this.retryDelayMs > 0) await new Promise((r) => setTimeout(r, this.retryDelayMs));
    }
    return null;
  }

  private async fetchFrom365Scores(): Promise<{ matches: StoredSeasonMatch[]; complete: boolean }> {
    const seasonStart = getCurrentSeason().startDate.getTime();
    const games = new Map<number, Scores365Game>();

    // 1. Past results + collect future-direction cursor.
    // Page 1 returns ~50 events with both `paging.previousPage` (older) and
    // `paging.nextPage` (newer) — the latter is only the fallback cursor of
    // step 3, used when the fixtures page of step 2 fails.
    const baseUrl = `${SCORES365_API_BASE}/web/games`;
    let url: string | null = `${baseUrl}/results/?appTypeId=5&langId=1&timezoneName=Europe/Paris&userCountryId=75&competitors=${OL_365SCORES_ID}&limit=${PAGE_LIMIT}`;
    let nextPageHref: string | null = null;
    // Faux dès qu'une page échoue (après son nouvel essai) : la saison peut manquer de matchs.
    let complete = true;

    for (let page = 0; page < PAGES && url; page++) {
      const d = await this.fetchPage(url, `results page ${page}`);
      if (!d) {
        complete = false;
        break;
      }
      const list = d.games ?? [];
      for (const g of list) games.set(g.id, g);

      // Capture forward cursor on the very first page only (subsequent
      // pages' nextPage points back into already-known events).
      if (page === 0 && d.paging?.nextPage) {
        nextPageHref = d.paging.nextPage;
      }

      // Stop paginating once we crossed the season boundary
      const oldest = list[list.length - 1];
      if (!oldest || new Date(oldest.startTime).getTime() < seasonStart) break;

      const prev: string | undefined = d.paging?.previousPage;
      url = prev ? `${SCORES365_API_BASE}${prev}` : null;
    }

    // 2. Upcoming — the fixtures page returns the next ~27 matches in one call
    // (`/web/games/?…competitors=465`, used here before, returns 0 game), and
    // its `paging.nextPage` continues after the last of them.
    const up = await this.fetchPage(
      `${baseUrl}/fixtures/?appTypeId=5&langId=1&timezoneName=Europe/Paris&userCountryId=75&competitors=${OL_365SCORES_ID}&limit=${PAGE_LIMIT}`,
      'upcoming',
    );
    if (up) {
      const list = up.games ?? [];
      for (const g of list) games.set(g.id, g);
      // Continue from the end of this page rather than from the last result.
      if (list.length > 0) nextPageHref = up.paging?.nextPage ?? null;
    } else {
      complete = false;
    }

    // 3. Walk the forward cursor down to the empty page that ends the season.
    let forwardUrl: string | null = nextPageHref ? `${SCORES365_API_BASE}${nextPageHref}` : null;
    for (let page = 0; forwardUrl; page++) {
      if (page >= FORWARD_PAGES) {
        this.logger.warn(
          `365scores forward : ${FORWARD_PAGES} pages lues et une page suivante encore annoncée — la fin de saison peut manquer`,
        );
        break;
      }
      const d = await this.fetchPage(forwardUrl, `forward page ${page}`);
      if (!d) {
        complete = false;
        break;
      }
      const list = d.games ?? [];
      if (list.length === 0) break;
      for (const g of list) games.set(g.id, g);
      const next = d.paging?.nextPage;
      forwardUrl = next ? `${SCORES365_API_BASE}${next}` : null;
    }

    const all = Array.from(games.values());
    this.logger.log(`365scores: ${all.length} événements OL (toutes compétitions, brut)`);

    const inSeason = all.filter(
      (g) => new Date(g.startTime).getTime() >= seasonStart,
    );
    const filtered = inSeason.filter(
      (g) =>
        g.competitionId !== undefined &&
        g.competitionId in TRACKED_COMPETITIONS,
    );
    this.warnUntracked(inSeason);

    const matches = filtered
      .map((g) => this.toSeasonMatch(g))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const counts = matches.reduce<Record<string, number>>((acc, m) => {
      acc[m.competitionCode] = (acc[m.competitionCode] ?? 0) + 1;
      return acc;
    }, {});
    this.logger.log(
      `season-matches: ${matches.length} retenus — ${Object.entries(counts).map(([k, v]) => `${k}=${v}`).join(', ')}`,
    );

    return { matches, complete };
  }

  private toSeasonMatch(g: Scores365Game): StoredSeasonMatch {
    // 365scores statusGroups: 1=scheduled-soon, 2=scheduled-future, 3=live, 4=ended
    // (cf. live-match.types.ts). Treating 2 as IN_PLAY would tag a "next L1 match
    // in 4 days" as in-play, so map both 1 and 2 to SCHEDULED.
    const sg = g.statusGroup;
    const status: SeasonMatch['status'] =
      sg === 4 ? 'FINISHED' : sg === 3 ? 'IN_PLAY' : 'SCHEDULED';
    const compId = g.competitionId!;
    const { name: competition, code: competitionCode } =
      TRACKED_COMPETITIONS[compId];
    const matchday = g.roundNum ?? null;
    // Le score de 365scores est celui du match (pas le cumul aller-retour) ;
    // aucune prolongation ni tir au but dans la saison mesurée le 2026-10-03.
    const round =
      matchday === null
        ? [stageLabel(compId, g.stageName), legLabel(g.legNum)]
            .filter((part): part is string => part !== null)
            .join(' · ') || null
        : null;

    const home = g.homeCompetitor;
    const away = g.awayCompetitor;
    const hasScore = status !== 'SCHEDULED';

    // Frontend keeps the football-data id as canonical for OL specifically
    // (see frontend/src/types/api.ts OL_TEAM_ID = 523). Remap on the way out
    // so existing consumers (map markers, lookups) keep working.
    const remapId = (id: number | undefined): number => {
      if (id === undefined) return 0;
      if (id === OL_365SCORES_ID) return OL_TEAM_ID;
      return id;
    };

    return {
      id: g.id,
      date: new Date(g.startTime).toISOString(),
      homeTeam: home?.name ?? '',
      homeTeamId: remapId(home?.id),
      awayTeam: away?.name ?? '',
      awayTeamId: remapId(away?.id),
      homeScore: hasScore ? home?.score ?? null : null,
      awayScore: hasScore ? away?.score ?? null : null,
      competition,
      competitionCode,
      competitionId: compId,
      status,
      matchday,
      round,
    };
  }

  /** Les compétitions de la saison absentes de `TRACKED_COMPETITIONS`, nommées. */
  private warnUntracked(inSeason: Scores365Game[]): void {
    const untracked = new Map<string, number>();
    for (const g of inSeason) {
      if (
        g.competitionId !== undefined &&
        g.competitionId in TRACKED_COMPETITIONS
      )
        continue;
      const key = `#${g.competitionId ?? '?'} ${g.competitionDisplayName ?? ''}`.trim();
      untracked.set(key, (untracked.get(key) ?? 0) + 1);
    }
    if (untracked.size === 0) return;
    this.logger.warn(
      `365scores : compétition non suivie, absente du calendrier et des statistiques — ${[
        ...untracked,
      ]
        .map(([key, n]) => `${key} (${n} match${n > 1 ? 's' : ''})`)
        .join(', ')}`,
    );
  }

  private readCache(): StoredSeasonMatch[] | null {
    if (!fs.existsSync(this.cacheFile)) return null;
    try {
      const { ts, data } = JSON.parse(fs.readFileSync(this.cacheFile, 'utf-8'));
      if (Date.now() - ts < CACHE_TTL_MS) return data;
    } catch (err) {
      this.logger.warn(`Failed to read season-matches cache ${this.cacheFile}: ${(err as Error)?.message ?? err}`);
    }
    return null;
  }

  private readCacheRaw(): StoredSeasonMatch[] | null {
    if (!fs.existsSync(this.cacheFile)) return null;
    try {
      const { data } = JSON.parse(fs.readFileSync(this.cacheFile, 'utf-8'));
      return data;
    } catch (err) {
      this.logger.warn(`Failed to read season-matches cache (raw): ${(err as Error)?.message ?? err}`);
      return null;
    }
  }

  private writeCache(data: StoredSeasonMatch[]): void {
    fs.mkdirSync(path.dirname(this.cacheFile), { recursive: true });
    atomicWriteJsonSync(this.cacheFile, { ts: Date.now(), data });
  }

  private matchesChanged(prev: StoredSeasonMatch[] | null, next: StoredSeasonMatch[]): boolean {
    if (!prev || prev.length !== next.length) return true;
    for (let i = 0; i < next.length; i++) {
      const p = prev[i];
      const n = next[i];
      if (
        p.id !== n.id ||
        p.status !== n.status ||
        p.homeScore !== n.homeScore ||
        p.awayScore !== n.awayScore ||
        p.date !== n.date
      ) {
        return true;
      }
    }
    return false;
  }
}
