import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { z } from 'zod';
import { parseExternal } from '../../common/zod-validation.pipe';
import { FRANCE_365SCORES_ID } from '../../config/constants';
import { scores365Headers, SCORES365_API_BASE, SCORES365_REFERER } from '../../config/scores365-http';
import { Scores365GamesResponseSchema, type Scores365Game } from '../../config/scores365-game.schema';

export interface FranceTeam {
  id: number;
  name: string;
}

export interface FranceResult {
  id: number;
  date: string;
  home: FranceTeam;
  away: FranceTeam;
  homeScore: number;
  awayScore: number;
  franceIsHome: boolean;
  competition: string;
}

export interface FranceNextMatch {
  id: number;
  date: string;
  /** Faux quand l'heure n'est pas fixée : voir `TIME_CONFIRMED_HORIZON_MS`. */
  timeConfirmed: boolean;
  home: FranceTeam;
  away: FranceTeam;
  competition: string;
}

export interface FrancePlayer {
  id: number;
  name: string;
  position: string;
  /** `null` quand 365scores ne le donne pas (jamais 0). */
  age: number | null;
}

export interface FranceOverview {
  nextMatch: FranceNextMatch | null;
  results: FranceResult[];
  squad: FrancePlayer[];
}

const SquadsResponseSchema = z.object({
  squads: z
    .array(
      z.object({
        competitorId: z.number().optional(),
        athletes: z
          .array(
            z
              .object({
                id: z.number(),
                name: z.string(),
                age: z.number().optional(),
                position: z.object({ id: z.number().optional(), name: z.string().optional() }).optional(),
              })
              .passthrough(),
          )
          .optional(),
      }),
    )
    .optional(),
});

const SCORES365_HEADERS = scores365Headers(SCORES365_REFERER.team);
const QUERY = `appTypeId=5&langId=15&timezoneName=Europe/Paris&userCountryId=75&competitors=${FRANCE_365SCORES_ID}`;
const RESULTS_COUNT = 5;
/**
 * Les quatre postes de la fiche (R8), par identifiant 365scores (stable d'une langue à l'autre,
 * contrairement aux noms). Le staff (Entraîneur, Assistant Coach) a `position.id` 0 : écarté.
 */
const POSITION_BY_ID: Record<number, string> = { 1: 'Goalkeeper', 2: 'Defender', 3: 'Midfielder', 4: 'Attacker' };
/** Durée de la copie en mémoire : la page se lit à la demande, pas par cron. */
const CACHE_TTL_MS = 10 * 60 * 1000;
/**
 * 365scores ne signale pas une heure non fixée (il met une heure de remplissage) et
 * football-data ne suit pas les Bleus : au-delà de 14 jours (seuil de CLAUDE.md « L39 »),
 * l'heure est tenue pour non fixée.
 */
/** Nouvel essai après une réponse inutilisable (365scores en panne, 200 sans « games ») : 1 min, pas 10. */
const RETRY_AFTER_FAILURE_MS = 60 * 1000;
const TIME_CONFIRMED_HORIZON_MS = 14 * 24 * 60 * 60 * 1000;

type Fetcher = typeof fetch;

/**
 * Équipe de France A lue sur 365scores (competitorId 5061) : prochain match, 5 derniers
 * résultats, effectif. Un seul objet pour un seul appel du frontend (L113).
 */
@Injectable()
export class FranceService {
  private readonly logger = new Logger(FranceService.name);

  /** Test seam — remplacé par les specs. */
  fetcher: Fetcher = (input, init) => fetch(input, init);
  /** Attente avant le nouvel essai d'un appel en échec — remise à 0 par les specs. */
  retryDelayMs = 1_000;

  private cache: { at: number; data: FranceOverview } | null = null;

  async getFrance(): Promise<FranceOverview> {
    const now = Date.now();
    if (this.cache && now - this.cache.at < CACHE_TTL_MS) return this.cache.data;
    try {
      const [results, fixtures, squads] = await Promise.all([
        this.fetchJson(`${SCORES365_API_BASE}/web/games/results/?${QUERY}&limit=${RESULTS_COUNT + 5}`, 'results'),
        this.fetchJson(`${SCORES365_API_BASE}/web/games/fixtures/?${QUERY}&limit=5`, 'fixtures'),
        this.fetchJson(`${SCORES365_API_BASE}/web/squads/?langId=15&timezoneName=Europe/Paris&competitors=${FRANCE_365SCORES_ID}`, 'squads'),
      ]);
      const fixturesRes = parseExternal(Scores365GamesResponseSchema, fixtures, '365scores France fixtures');
      const resultsRes = parseExternal(Scores365GamesResponseSchema, results, '365scores France results');
      const data: FranceOverview = {
        nextMatch: this.toNextMatch(fixturesRes.games ?? [], now),
        results: this.toResults(resultsRes.games ?? []),
        squad: this.toSquad(parseExternal(SquadsResponseSchema, squads, '365scores France squads')),
      };
      // Un 200 sans « games » (rendu dégradé) n'est pas une liste vide : on ne le garde pas 10 min.
      if (!resultsRes.games) throw new Error('365scores France : résultats en 200 sans « games »');
      // Matchs à venir sans « games » : peut être réel (fin de calendrier) ou dégradé → servi, revu dans 1 min.
      this.cache = { at: fixturesRes.games ? now : now - CACHE_TTL_MS + RETRY_AFTER_FAILURE_MS, data };
      return data;
    } catch (err) {
      this.logger.warn(`France : lecture 365scores en échec — ${(err as Error)?.message ?? err}`);
      // Un appel refusé ne vide pas la page : la dernière réponse connue, sinon une erreur
      // (jamais `{ results: [] … }`, qui voudrait dire « aucune donnée »). La copie est
      // réhorodatée pour ne pas relancer 3 lectures × 2 essais à chaque requête.
      if (this.cache) {
        this.cache.at = now - CACHE_TTL_MS + RETRY_AFTER_FAILURE_MS;
        return this.cache.data;
      }
      throw new ServiceUnavailableException('365scores indisponible');
    }
  }

  private async fetchJson(url: string, what: string): Promise<unknown> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const res = await this.fetcher(url, { headers: SCORES365_HEADERS, signal: AbortSignal.timeout(8_000) });
        if (res.ok) return await res.json();
        lastError = new Error(`365scores ${what} → HTTP ${res.status}`);
        if (res.status < 500 && res.status !== 429) break;
      } catch (err) {
        lastError = err;
      }
      if (attempt < 2 && this.retryDelayMs > 0) await new Promise((r) => setTimeout(r, this.retryDelayMs));
    }
    throw lastError;
  }

  private toTeam(c: { id: number; name?: string }): FranceTeam {
    return { id: c.id, name: c.name ?? '' };
  }

  private toResults(games: Scores365Game[]): FranceResult[] {
    return games
      .filter((g) => g.homeCompetitor && g.awayCompetitor && (g.homeCompetitor.score ?? -1) >= 0 && (g.awayCompetitor.score ?? -1) >= 0)
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
      .slice(0, RESULTS_COUNT)
      .map((g) => ({
        id: g.id,
        date: g.startTime,
        home: this.toTeam(g.homeCompetitor!),
        away: this.toTeam(g.awayCompetitor!),
        homeScore: g.homeCompetitor!.score!,
        awayScore: g.awayCompetitor!.score!,
        franceIsHome: g.homeCompetitor!.id === FRANCE_365SCORES_ID,
        competition: g.competitionDisplayName ?? '',
      }));
  }

  private toNextMatch(games: Scores365Game[], now: number): FranceNextMatch | null {
    const next = games
      .filter((g) => g.homeCompetitor && g.awayCompetitor && new Date(g.startTime).getTime() >= now - 3 * 60 * 60 * 1000)
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())[0];
    if (!next) return null;
    return {
      id: next.id,
      date: next.startTime,
      timeConfirmed: new Date(next.startTime).getTime() - now <= TIME_CONFIRMED_HORIZON_MS,
      home: this.toTeam(next.homeCompetitor!),
      away: this.toTeam(next.awayCompetitor!),
      competition: next.competitionDisplayName ?? '',
    };
  }

  private toSquad(res: z.infer<typeof SquadsResponseSchema>): FrancePlayer[] {
    const athletes = res.squads?.find((s) => s.competitorId === FRANCE_365SCORES_ID)?.athletes ?? res.squads?.[0]?.athletes ?? [];
    return athletes.flatMap((a) => {
      const position = POSITION_BY_ID[a.position?.id ?? -1];
      return position ? [{ id: a.id, name: a.name, position, age: a.age ?? null }] : [];
    });
  }
}
