import { Controller, Get } from '@nestjs/common';
import { FixturesService } from './fixtures.service';

@Controller('fixtures')
export class FixturesController {
  constructor(private readonly service: FixturesService) {}

  @Get()
  getAll() { return this.service.getFixtures(); }
}
