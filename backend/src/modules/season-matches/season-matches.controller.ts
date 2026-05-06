import { Controller, Get } from '@nestjs/common';
import { SeasonMatchesService } from './season-matches.service';

@Controller('season-matches')
export class SeasonMatchesController {
  constructor(private readonly service: SeasonMatchesService) {}

  @Get()
  getAll() {
    return this.service.getMatches();
  }
}
