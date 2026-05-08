import {
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
} from '@nestjs/common';
import { PlayerStatsService } from './player-stats.service';

@Controller('players')
export class PlayersController {
  constructor(private readonly stats: PlayerStatsService) {}

  /**
   * Cumulative season stats for every OL player who logged minutes,
   * sorted by `goalContributions` desc.
   */
  @Get('season-stats')
  list() {
    return this.stats.getAll();
  }

  /**
   * Cumulative season stats for one OL player — `athleteId` is the
   * 365scores stable identifier (used to build photo URLs too).
   */
  @Get(':athleteId/season-stats')
  async one(@Param('athleteId', ParseIntPipe) athleteId: number) {
    const player = await this.stats.getOne(athleteId);
    if (!player)
      throw new NotFoundException(`No season stats for athlete ${athleteId}`);
    return player;
  }
}
