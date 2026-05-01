import { Module } from '@nestjs/common';
import { CupsService } from './cups.service';
import { CupsController } from './cups.controller';

@Module({
  providers: [CupsService],
  controllers: [CupsController],
})
export class CupsModule {}
