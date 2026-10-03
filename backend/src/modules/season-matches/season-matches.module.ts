import { Module } from '@nestjs/common';
import { FixturesModule } from '../fixtures/fixtures.module';
import { SeasonMatchesService } from './season-matches.service';
import { SeasonMatchesController } from './season-matches.controller';

@Module({
  // FixturesService : ce que football-data dit de l'heure d'un match de Ligue 1.
  imports: [FixturesModule],
  controllers: [SeasonMatchesController],
  providers: [SeasonMatchesService],
  exports: [SeasonMatchesService],
})
export class SeasonMatchesModule {}
