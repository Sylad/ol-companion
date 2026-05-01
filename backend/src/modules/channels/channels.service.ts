import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

export interface YoutubeChannel {
  id: string;
  name: string;
  handle: string;
  url: string;
  description: string;
  type: 'official' | 'media' | 'creator';
  priority: boolean;
}

const CHANNELS_FILE = path.resolve(process.cwd(), 'data', 'youtube-channels.json');

@Injectable()
export class ChannelsService {
  private readonly logger = new Logger(ChannelsService.name);

  getAll(): YoutubeChannel[] {
    if (!fs.existsSync(CHANNELS_FILE)) {
      this.logger.warn(`youtube-channels.json missing at ${CHANNELS_FILE}`);
      return [];
    }
    try {
      return JSON.parse(fs.readFileSync(CHANNELS_FILE, 'utf-8')) as YoutubeChannel[];
    } catch (err) {
      this.logger.error(`Failed to parse youtube-channels.json: ${(err as Error).message}`);
      return [];
    }
  }
}
