import { Module } from '@nestjs/common';
import { SeasonMatchesModule } from '../season-matches/season-matches.module';
import { PlayerStatsService } from './player-stats.service';
import { PlayersController } from './players.controller';

@Module({
  imports: [SeasonMatchesModule],
  controllers: [PlayersController],
  providers: [PlayerStatsService],
  exports: [PlayerStatsService],
})
export class PlayersModule {}
