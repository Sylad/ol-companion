import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { SeasonResetService } from './season-reset.service';

describe('SeasonResetService', () => {
  let dataDir: string;
  let service: SeasonResetService;

  beforeEach(() => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ol-reset-'));
    service = new SeasonResetService(dataDir);
  });

  afterEach(() => {
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it('archives existing caches into data/archive/<season>/ and clears them', async () => {
    fs.writeFileSync(path.join(dataDir, 'cups-cache.json'), '{"data":1}');
    fs.writeFileSync(path.join(dataDir, 'fixtures-cache.json'), '{"data":2}');
    fs.writeFileSync(path.join(dataDir, 'standings-history.json'), '[]');

    await service.resetSeason(new Date('2026-08-01T03:00:00'));

    const archive = path.join(dataDir, 'archive', '2025-2026');
    expect(fs.existsSync(path.join(archive, 'cups-cache.json'))).toBe(true);
    expect(fs.existsSync(path.join(archive, 'fixtures-cache.json'))).toBe(true);
    expect(fs.existsSync(path.join(archive, 'standings-history.json'))).toBe(true);

    expect(fs.existsSync(path.join(dataDir, 'cups-cache.json'))).toBe(false);
    expect(fs.existsSync(path.join(dataDir, 'fixtures-cache.json'))).toBe(false);
    expect(fs.existsSync(path.join(dataDir, 'standings-history.json'))).toBe(false);
  });

  it('ignores files that do not exist', async () => {
    await expect(service.resetSeason(new Date('2026-08-01T03:00:00'))).resolves.not.toThrow();
    expect(fs.existsSync(path.join(dataDir, 'archive', '2025-2026'))).toBe(true);
  });

  it('returns the archived season id', async () => {
    const result = await service.resetSeason(new Date('2026-08-01T03:00:00'));
    expect(result).toEqual({ archivedSeason: '2025-2026' });
  });
});
