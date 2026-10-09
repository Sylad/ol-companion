import { Controller, Get, Query, BadRequestException } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { WIKI_IMAGE_THROTTLE } from '../../config/throttlers';
import { WikiImageService } from './wiki-image.service.js';

// L32 : limite propre aux logos (cache serveur), cf. config/throttlers.ts
@Throttle(WIKI_IMAGE_THROTTLE)
@Controller('wiki-image')
export class WikiImageController {
  constructor(private readonly service: WikiImageService) {}

  @Get()
  async getImage(@Query('q') q: string) {
    if (!q?.trim()) throw new BadRequestException('q is required');
    return this.service.getImage(q.trim());
  }
}
