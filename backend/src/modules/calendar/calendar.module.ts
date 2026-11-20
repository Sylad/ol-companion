import { Module } from '@nestjs/common';
import { FixturesModule } from '../fixtures/fixtures.module';
import { CalendarController } from './calendar.controller';
import { CalendarService } from './calendar.service';

@Module({
  imports: [FixturesModule],
  controllers: [CalendarController],
  providers: [CalendarService],
})
export class CalendarModule {}
