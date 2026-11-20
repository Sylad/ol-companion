import { BadRequestException, Controller, Get, NotFoundException, Query, ServiceUnavailableException } from '@nestjs/common';
import { OL_TEAM_ID } from '../../config/constants';
import { LeagueMatchesService } from './league-matches.service';
import { computeMatchImpact, type MatchImpact } from './match-impact';

export type MatchImpactResponse = MatchImpact & { updatedAt: string };

/**
 * L265 — `GET /api/match-impact?at=<instant ISO du coup d'envoi>` : ce que le
 * match de Ligue 1 de l'OL joué à cet instant change à son classement, d'après
 * football-data.org seul. 404 : football-data n'a pas de match de Ligue 1 de
 * l'OL à 12 h près ; 503 : aucune donnée de football-data.
 */
@Controller('match-impact')
export class MatchImpactController {
  constructor(private readonly league: LeagueMatchesService) {}

  @Get()
  async get(@Query('at') at?: string): Promise<MatchImpactResponse> {
    const instant = at ? new Date(at) : null;
    if (!instant || Number.isNaN(instant.getTime())) {
      throw new BadRequestException('Paramètre « at » attendu : instant ISO 8601 du coup d’envoi.');
    }
    const data = await this.league.getMatches();
    if (!data) throw new ServiceUnavailableException('Classement indisponible : football-data.org n’a pas répondu.');
    const impact = computeMatchImpact(data.matches, OL_TEAM_ID, instant);
    if (!impact) throw new NotFoundException('Aucun match de Ligue 1 de l’OL à cet instant chez football-data.org.');
    return { ...impact, updatedAt: new Date(data.fetchedAt).toISOString() };
  }
}
