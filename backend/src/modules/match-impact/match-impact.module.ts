import { Module } from '@nestjs/common';
import { LeagueMatchesService } from './league-matches.service';
import { MatchImpactController } from './match-impact.controller';

@Module({ controllers: [MatchImpactController], providers: [LeagueMatchesService] })
export class MatchImpactModule {}
