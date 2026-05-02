import { Module } from '@nestjs/common';
import { SeasonResetService } from './season-reset.service';
import { AdminController } from './admin.controller';

@Module({
  providers: [SeasonResetService],
  controllers: [AdminController],
  exports: [SeasonResetService],
})
export class SchedulerModule {}
