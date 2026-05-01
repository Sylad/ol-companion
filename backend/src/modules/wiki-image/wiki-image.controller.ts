import { Controller, Get, Query, BadRequestException } from '@nestjs/common';
import { WikiImageService } from './wiki-image.service.js';

@Controller('wiki-image')
export class WikiImageController {
  constructor(private readonly service: WikiImageService) {}

  @Get()
  async getImage(@Query('q') q: string) {
    if (!q?.trim()) throw new BadRequestException('q is required');
    return this.service.getImage(q.trim());
  }
}
