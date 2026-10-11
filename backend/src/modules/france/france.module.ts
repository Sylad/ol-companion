import { Module } from '@nestjs/common';
import { FranceController } from './france.controller';
import { FranceService } from './france.service';

@Module({
  controllers: [FranceController],
  providers: [FranceService],
})
export class FranceModule {}
