import { Controller, Get } from '@nestjs/common';
import { CupsService } from './cups.service';

@Controller('cups')
export class CupsController {
  constructor(private readonly service: CupsService) {}

  @Get()
  getCups() { return this.service.getCups(); }
}
