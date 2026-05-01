import { Module } from '@nestjs/common';
import { WikiImageController } from './wiki-image.controller.js';
import { WikiImageService } from './wiki-image.service.js';

@Module({
  controllers: [WikiImageController],
  providers: [WikiImageService],
})
export class WikiImageModule {}
