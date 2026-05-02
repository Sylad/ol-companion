import { Module } from '@nestjs/common';
import { CupsService } from './cups.service';
import { CupsController } from './cups.controller';
import { BracketService } from './bracket.service';

@Module({
  providers: [CupsService, BracketService],
  controllers: [CupsController],
})
export class CupsModule {}
