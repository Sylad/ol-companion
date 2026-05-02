import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import * as fs from 'fs';
import * as path from 'path';
import { getPreviousSeason } from './season.util';

export const SEASON_RESET_DATA_DIR = 'SEASON_RESET_DATA_DIR';

const CACHES_TO_ARCHIVE = [
  'cups-cache.json',
  'fixtures-cache.json',
  'standings-cache.json',
  'news-cache.json',
  'lineup-cache.json',
  'standings-history.json',
  'season-rankings.json',
];

@Injectable()
export class SeasonResetService {
  private readonly logger = new Logger(SeasonResetService.name);
  private readonly dataDir: string;

  constructor(@Optional() @Inject(SEASON_RESET_DATA_DIR) dataDir?: string) {
    this.dataDir = dataDir ?? path.resolve(process.cwd(), 'data');
  }

  // 1 août, 03:00 Europe/Paris (cron 6 fields: sec min hour day month dow)
  @Cron('0 0 3 1 8 *', { name: 'season-reset', timeZone: 'Europe/Paris' })
  async scheduledReset(): Promise<{ archivedSeason: string }> {
    return this.resetSeason();
  }

  async resetSeason(now: Date = new Date()): Promise<{ archivedSeason: string }> {
    const season = getPreviousSeason(now);
    const archiveDir = path.join(this.dataDir, 'archive', season.id);
    fs.mkdirSync(archiveDir, { recursive: true });

    for (const filename of CACHES_TO_ARCHIVE) {
      const src = path.join(this.dataDir, filename);
      if (!fs.existsSync(src)) continue;
      const dst = path.join(archiveDir, filename);
      fs.renameSync(src, dst);
      this.logger.log(`Archived ${filename} → archive/${season.id}/`);
    }

    this.logger.log(`Season reset complete: archived ${season.id}`);
    return { archivedSeason: season.id };
  }
}
