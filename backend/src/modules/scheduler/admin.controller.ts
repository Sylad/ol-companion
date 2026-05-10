import { Controller, Post, UseGuards } from '@nestjs/common';
import { PinGuard } from '../../guards/pin.guard';
import { DemoWriteGuard } from '../../guards/demo-write.guard';
import { SeasonResetService } from './season-reset.service';

@Controller('admin')
export class AdminController {
  constructor(private readonly seasonReset: SeasonResetService) {}

  @Post('reset-season')
  @UseGuards(DemoWriteGuard, PinGuard)
  async manualReset() {
    return this.seasonReset.resetSeason();
  }
}
