import { Module } from '@nestjs/common';
import { LeagueMatchesService } from './league-matches.service';
import { MatchImpactController } from './match-impact.controller';

/** `LeagueMatchesService` exporté : une seule copie de la Ligue 1 de football-data, partagée avec `/api/next-opponents` (L273). */
@Module({ controllers: [MatchImpactController], providers: [LeagueMatchesService], exports: [LeagueMatchesService] })
export class MatchImpactModule {}
