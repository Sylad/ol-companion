import { Controller, Get, NotFoundException, Param, ParseIntPipe, Query } from '@nestjs/common';
import { LiveMatchService } from './live-match.service';

@Controller('live-match')
export class LiveMatchController {
  constructor(private readonly service: LiveMatchService) {}

  @Get('current')
  async current() {
    return (await this.service.getCurrent()) ?? null;
  }

  @Get(':gameId/stats')
  async stats(@Param('gameId', ParseIntPipe) gameId: number, @Query('matchupId') matchupId?: string) {
    if (!matchupId) {
      throw new NotFoundException('matchupId query param is required (format: homeId-awayId-gameId)');
    }
    const payload = await this.service.getStats(gameId, matchupId);
    if (!payload) throw new NotFoundException(`No data for game ${gameId}`);
    return payload;
  }
}
