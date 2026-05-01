import { Module } from '@nestjs/common';
import { LineupController } from './lineup.controller.js';
import { LineupService } from './lineup.service.js';

@Module({
  controllers: [LineupController],
  providers: [LineupService],
})
export class LineupModule {}
