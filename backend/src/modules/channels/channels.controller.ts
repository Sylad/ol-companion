import { Controller, Get } from '@nestjs/common';
import { ChannelsService } from './channels.service.js';

@Controller('youtube-channels')
export class ChannelsController {
  constructor(private readonly service: ChannelsService) {}

  @Get()
  getAll() {
    return this.service.getAll();
  }
}
