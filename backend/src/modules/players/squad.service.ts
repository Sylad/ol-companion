import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { z } from 'zod';
import { parseExternal } from '../../common/zod-validation.pipe';
import { OL_365SCORES_ID } from '../../config/constants';
import { POSITION_BY_ID } from '../../config/scores365-positions';
import { SquadsResponseSchema } from '../../config/scores365-squads';
import { scores365Headers, SCORES365_API_BASE, SCORES365_REFERER } from '../../config/scores365-http';

export interface SquadPlayer {
  athleteId: number;
  name: string;
  /** Poste anglais (« Goalkeeper »…), comme `LineupPlayer.position`. */
  position: string;
  /** `null` quand 365scores ne le donne pas (jamais 0). */
  jerseyNumber: number | null;
}

const SCORES365_HEADERS = scores365Headers(SCORES365_REFERER.team);
/** L'effectif change au mercato, pas d'un match à l'autre : une lecture par heure suffit. */
const CACHE_TTL_MS = 60 * 60 * 1000;

type Fetcher = typeof fetch;

/**
 * Effectif complet de l'OL lu sur 365scores (`/web/squads`, comme `FranceService` pour les Bleus, L210) : tout joueur
 * sous contrat y est, blessé ou absent compris, sans dépendre d'un match ni d'une feuille publiée. Sert à nommer la
 * fiche d'un joueur qui n'a pas encore de minute.
 */
@Injectable()
export class SquadService {
  private readonly logger = new Logger(SquadService.name);

  /** Test seam — remplacé par les specs. */
  fetcher: Fetcher = (input, init) => fetch(input, init);

  private cache: { at: number; data: SquadPlayer[] } | null = null;
  private inflight: Promise<SquadPlayer[]> | null = null;

  getSquad(): Promise<SquadPlayer[]> {
    if (this.cache && Date.now() - this.cache.at < CACHE_TTL_MS) return Promise.resolve(this.cache.data);
    this.inflight ??= this.load().finally(() => {
      this.inflight = null;
    });
    return this.inflight;
  }

  private async load(): Promise<SquadPlayer[]> {
    try {
      const res = await this.fetcher(
        `${SCORES365_API_BASE}/web/squads/?langId=15&timezoneName=Europe/Paris&competitors=${OL_365SCORES_ID}`,
        { headers: SCORES365_HEADERS, signal: AbortSignal.timeout(8_000) },
      );
      if (!res.ok) throw new Error(`365scores squads → HTTP ${res.status}`);
      const parsed = parseExternal(SquadsResponseSchema, await res.json(), '365scores OL squads');
      // Un 200 sans « squads » (rendu dégradé) n'est pas un effectif vide.
      if (!parsed.squads) throw new Error('365scores OL : effectif en 200 sans « squads »');
      const athletes = (parsed.squads.find((s) => s.competitorId === OL_365SCORES_ID) ?? parsed.squads[0])?.athletes ?? [];
      const data = athletes.flatMap((a) => {
        const position = POSITION_BY_ID[a.position?.id ?? -1];
        return position ? [{ athleteId: a.id, name: a.name, position, jerseyNumber: a.jerseyNum || null }] : [];
      });
      this.cache = { at: Date.now(), data };
      return data;
    } catch (err) {
      this.logger.warn(`Effectif OL : lecture 365scores en échec — ${(err as Error)?.message ?? err}`);
      // Un appel refusé ne vide pas la fiche : dernière copie connue, sinon 503 (jamais `[]`).
      if (this.cache) return this.cache.data;
      throw new ServiceUnavailableException('365scores indisponible');
    }
  }
}
