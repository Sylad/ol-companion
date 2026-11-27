import { Module } from '@nestjs/common';
import { MatchImpactModule } from '../match-impact/match-impact.module';
import { NextOpponentsController } from './next-opponents.controller';

@Module({
  imports: [MatchImpactModule],
  controllers: [NextOpponentsController],
})
export class NextOpponentsModule {}
