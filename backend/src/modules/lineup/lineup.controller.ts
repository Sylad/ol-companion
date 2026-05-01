import { Controller, Get } from '@nestjs/common';
import { LineupService } from './lineup.service.js';

@Controller('lineup')
export class LineupController {
  constructor(private readonly service: LineupService) {}

  @Get()
  getLatest() {
    return this.service.getLatestLineup();
  }
}
