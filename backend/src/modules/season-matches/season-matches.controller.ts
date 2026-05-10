import { Controller, Get } from '@nestjs/common';
import { SeasonMatchesService } from './season-matches.service';
import { computeTeamSeasonStats } from './team-stats';

@Controller('season-matches')
export class SeasonMatchesController {
  constructor(private readonly service: SeasonMatchesService) {}

  @Get()
  getAll() {
    return this.service.getMatches();
  }

  /**
   * OL team-level cumulative season stats (matches played, W/D/L, goals,
   * clean sheets, per-competition breakdown, evolution chart). Derived from
   * `season-matches-cache` so no extra 365scores fetch is needed.
   */
  @Get('team-stats')
  async getTeamStats() {
    const matches = await this.service.getMatches();
    return computeTeamSeasonStats(matches);
  }
}
