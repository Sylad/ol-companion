import {
  Controller,
  Get,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { LeagueMatchesService } from '../match-impact/league-matches.service';
import { computeNextOpponents, type NextOpponents } from './next-opponents';

export type NextOpponentsResponse = NextOpponents & { updatedAt: string };

/**
 * L273 — `GET /api/next-opponents` : le prochain adversaire en Ligue 1 de chaque club, pour la
 * colonne du classement. football-data.org seul, depuis la copie de `LeagueMatchesService`
 * (15 min, partagée avec « Ce que ça change ») : un seul appel pour les 18 clubs, jamais un par club.
 * 503 : aucune donnée de football-data (ni réponse, ni copie).
 */
@Controller('next-opponents')
export class NextOpponentsController {
  private readonly logger = new Logger(NextOpponentsController.name);
  private lastUnlinked = '';

  constructor(private readonly league: LeagueMatchesService) {}

  @Get()
  async get(): Promise<NextOpponentsResponse> {
    const data = await this.league.getMatches();
    if (!data)
      throw new ServiceUnavailableException(
        'Prochains adversaires indisponibles : football-data.org n’a pas répondu.',
      );
    const result = computeNextOpponents(data.matches, new Date());
    const unlinked = result.unlinked.join(', ');
    if (unlinked && unlinked !== this.lastUnlinked) {
      this.logger.error(
        `Clubs de Ligue 1 non reliés à 365scores (config/club-ids.ts) : ${unlinked}`,
      );
    }
    this.lastUnlinked = unlinked;
    return { ...result, updatedAt: new Date(data.fetchedAt).toISOString() };
  }
}
