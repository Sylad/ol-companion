import { Module } from '@nestjs/common';
import { CupsService } from './cups.service';
import { CupsController } from './cups.controller';
import { BracketService } from './bracket.service';
import { SchedulerModule } from '../scheduler/scheduler.module';

@Module({
  imports: [SchedulerModule],
  providers: [CupsService, BracketService],
  controllers: [CupsController],
})
export class CupsModule {}
