import { Controller, Get } from '@nestjs/common';
import { StandingsService } from './standings.service';

@Controller('standings')
export class StandingsController {
  constructor(private readonly service: StandingsService) {}

  @Get()
  async getCurrent() { return this.service.getCurrentStandings(); }

  @Get('history')
  getHistory() { return this.service.getHistory(); }

  @Get('season-rankings')
  getSeasonRankings() { return this.service.getSeasonRankings(); }
}
