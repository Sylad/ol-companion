import { Controller, Get } from '@nestjs/common';
import { FranceService } from './france.service';

@Controller('france')
export class FranceController {
  constructor(private readonly service: FranceService) {}

  @Get()
  getFrance() {
    return this.service.getFrance();
  }
}
