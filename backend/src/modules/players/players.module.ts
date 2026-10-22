import { Module } from '@nestjs/common';
import { SeasonMatchesModule } from '../season-matches/season-matches.module';
import { SchedulerModule } from '../scheduler/scheduler.module';
import { PlayerStatsService } from './player-stats.service';
import { SquadService } from './squad.service';
import { PlayersController } from './players.controller';

@Module({
  imports: [SeasonMatchesModule, SchedulerModule],
  controllers: [PlayersController],
  providers: [PlayerStatsService, SquadService],
  exports: [PlayerStatsService],
})
export class PlayersModule {}
