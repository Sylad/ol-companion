import { Module } from '@nestjs/common';
import { SeasonMatchesService } from './season-matches.service';
import { SeasonMatchesController } from './season-matches.controller';

@Module({
  controllers: [SeasonMatchesController],
  providers: [SeasonMatchesService],
  exports: [SeasonMatchesService],
})
export class SeasonMatchesModule {}
