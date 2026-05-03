import { Module } from '@nestjs/common';
import { LiveMatchService } from './live-match.service';
import { LiveMatchController } from './live-match.controller';

@Module({
  providers: [LiveMatchService],
  controllers: [LiveMatchController],
  exports: [LiveMatchService],
})
export class LiveMatchModule {}
