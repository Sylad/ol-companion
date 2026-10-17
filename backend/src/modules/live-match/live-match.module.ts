import { Module } from '@nestjs/common';
import { LiveMatchService } from './live-match.service';
import { FixturesModule } from '../fixtures/fixtures.module';
import { LiveMatchController } from './live-match.controller';

@Module({
  imports: [FixturesModule],
  providers: [LiveMatchService],
  controllers: [LiveMatchController],
  exports: [LiveMatchService],
})
export class LiveMatchModule {}
