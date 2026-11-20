import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { FixturesService, Match } from '../fixtures/fixtures.service';
import { footballDataTimeConfirmed } from '../fixtures/kickoff-time';
import { CalendarService } from './calendar.service';
import { readEvents } from '../../../test/ics-reader';

/** L264 — le service : football-data seul, révisions sur disque, rien sans match. */

const fixture = JSON.parse(
  fs.readFileSync(
    path.resolve(__dirname, '../../../test/fixtures/football_data_ol_matches_2026_10_03.json'),
    'utf-8',
  ),
) as { finished: { matches: RawMatch[] }; scheduled: { matches: RawMatch[] } };

interface RawMatch {
  id: number;
  utcDate: string;
  status: Match['status'];
  matchday: number;
  homeTeam: { id: number; name: string };
  awayTeam: { id: number; name: string };
  score?: { fullTime?: { home: number | null; away: number | null } };
  competition: { name: string };
}

/** Les 15 matchs du 03-10, tels que `FixturesService.getFixtures()` les rend. */
function realMatches(): Match[] {
  return [...fixture.finished.matches, ...fixture.scheduled.matches].map((m) => ({
    id: m.id,
    date: m.utcDate,
    homeTeam: m.homeTeam.name,
    homeTeamId: m.homeTeam.id,
    awayTeam: m.awayTeam.name,
    awayTeamId: m.awayTeam.id,
    homeScore: m.score?.fullTime?.home ?? null,
    awayScore: m.score?.fullTime?.away ?? null,
    competition: m.competition.name,
    status: m.status,
    matchday: m.matchday,
    timeConfirmed: footballDataTimeConfirmed(m.status, m.utcDate),
  }));
}

function withCwd<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'calendar-'));
  const original = process.cwd();
  process.chdir(tmp);
  return fn(tmp).finally(() => {
    process.chdir(original);
    fs.rmSync(tmp, { recursive: true, force: true });
  });
}

function build(matches: () => Match[]): CalendarService {
  const fixtures = { getFixtures: async () => matches() } as unknown as FixturesService;
  return new CalendarService(fixtures);
}

describe('CalendarService', () => {
  it('les 15 matchs réels de football-data : 15 événements, J13 et J15 sans heure', async () => {
    await withCwd(async () => {
      const text = await build(realMatches).calendar(new Date('2026-10-03T12:00:00Z'));
      const events = readEvents(text!);
      expect(events).toHaveLength(15);
      expect(new Set(events.map((e) => e.UID)).size).toBe(15);
      const j13 = events.find((e) => e.UID === 'fd-559603@ol.sladoire.dev')!;
      expect(j13['DTSTART;VALUE=DATE']).toBe('20261204');
      const j15 = events.find((e) => e.UID === 'fd-559586@ol.sladoire.dev')!;
      expect(j15['DTSTART;VALUE=DATE']).toBe('20270101');
      expect(text).not.toMatch(/T000000Z/);
    });
  });

  it('ne publie que la Ligue 1 (les coupes ne viennent pas de football-data)', async () => {
    await withCwd(async () => {
      const other = { ...realMatches()[0], id: 1, competition: 'UEFA Europa League' };
      const text = await build(() => [...realMatches(), other]).calendar();
      expect(readEvents(text!).map((e) => e.UID)).not.toContain('fd-1@ol.sladoire.dev');
    });
  });

  it('heure fixée entre deux lectures : SEQUENCE gardée sur disque et augmentée, pas de doublon', async () => {
    await withCwd(async (dir) => {
      let matches = realMatches();
      const svc = build(() => matches);
      await svc.calendar(new Date('2026-10-03T12:00:00Z'));
      expect(fs.existsSync(path.join(dir, 'data', 'calendar-revisions.json'))).toBe(true);

      matches = matches.map((m) =>
        m.id === 559603 ? { ...m, status: 'TIMED', date: '2026-12-05T20:05:00Z', timeConfirmed: true } : m,
      );
      // Nouvelle instance : les révisions viennent du disque, pas de la mémoire.
      const text = await build(() => matches).calendar(new Date('2026-10-20T08:00:00Z'));
      const events = readEvents(text!);
      expect(events).toHaveLength(15);
      const j13 = events.filter((e) => e.UID === 'fd-559603@ol.sladoire.dev');
      expect(j13).toHaveLength(1);
      expect(j13[0].SEQUENCE).toBe('1');
      expect(j13[0].DTSTART).toBe('20261205T200500Z');
      expect(j13[0]['LAST-MODIFIED']).toBe('20261020T080000Z');
      const j6 = events.find((e) => e.UID === 'fd-559669@ol.sladoire.dev')!;
      expect(j6.SEQUENCE).toBe('0');
      expect(j6.DTSTAMP).toBe('20261003T120000Z');
    });
  });

  it('L268 — match reporté dont la date est à minuit UTC : le jour seul, jamais « 01:00 »', async () => {
    await withCwd(async () => {
      const postponed = (): Match[] =>
        realMatches().map((m) => {
          if (m.id !== 559603) return m;
          const raw = { ...m, status: 'POSTPONED' as const, date: '2026-12-05T00:00:00Z' };
          return { ...raw, timeConfirmed: footballDataTimeConfirmed(raw.status, raw.date) };
        });
      const text = await build(postponed).calendar(new Date('2026-10-03T12:00:00Z'));
      const j13 = readEvents(text!).find((e) => e.UID === 'fd-559603@ol.sladoire.dev')!;
      expect(j13['DTSTART;VALUE=DATE']).toBe('20261205');
      expect(j13.DTSTART).toBeUndefined();
      expect(j13.STATUS).toBe('TENTATIVE');
      expect(text).not.toMatch(/T000000Z/);
    });
  });

  it('aucun match (pas de clé, pas de cache) : null, jamais un calendrier vide', async () => {
    await withCwd(async () => {
      expect(await build(() => []).calendar()).toBeNull();
    });
  });

  it.each([
    ['null', 'null'],
    ['un tableau', '[]'],
    ['un nombre', '42'],
  ])('L268 — révisions en JSON valide mais de mauvaise forme (%s) : ignorées, repart de zéro', async (_, json) => {
    await withCwd(async (dir) => {
      fs.mkdirSync(path.join(dir, 'data'));
      const file = path.join(dir, 'data', 'calendar-revisions.json');
      fs.writeFileSync(file, json);
      const text = await build(realMatches).calendar(new Date('2026-10-03T12:00:00Z'));
      const events = readEvents(text!);
      expect(events).toHaveLength(15);
      expect(events.every((e) => e.SEQUENCE === '0')).toBe(true);
      const written = JSON.parse(fs.readFileSync(file, 'utf-8')) as Record<string, unknown>;
      expect(Object.keys(written)).toHaveLength(15);
    });
  });

  it('L268 — une entrée de révision invalide (null, champs manquants) est ignorée, les autres gardées', async () => {
    await withCwd(async (dir) => {
      await build(realMatches).calendar(new Date('2026-10-03T12:00:00Z'));
      const file = path.join(dir, 'data', 'calendar-revisions.json');
      const revs = JSON.parse(fs.readFileSync(file, 'utf-8')) as Record<string, unknown>;
      // J13 publiée en SEQUENCE 3 : une bonne entrée, qui doit être gardée.
      revs['fd-559603@ol.sladoire.dev'] = { ...(revs['fd-559603@ol.sladoire.dev'] as object), sequence: 3 };
      revs['fd-559669@ol.sladoire.dev'] = null;
      revs['fd-559586@ol.sladoire.dev'] = { schedule: 'x' };
      fs.writeFileSync(file, JSON.stringify(revs));

      const text = await build(realMatches).calendar(new Date('2026-10-20T08:00:00Z'));
      const events = readEvents(text!);
      expect(events).toHaveLength(15);
      expect(events.find((e) => e.UID === 'fd-559603@ol.sladoire.dev')!.SEQUENCE).toBe('3');
      const j6 = events.find((e) => e.UID === 'fd-559669@ol.sladoire.dev')!;
      expect(j6.SEQUENCE).toBe('0');
      expect(j6.DTSTAMP).toBe('20261020T080000Z');
      // Les entrées invalides sont remplacées sur disque : plus de null.
      const rewritten = JSON.parse(fs.readFileSync(file, 'utf-8')) as Record<string, unknown>;
      expect(Object.values(rewritten).every((r) => r !== null && typeof r === 'object')).toBe(true);
      expect((rewritten['fd-559586@ol.sladoire.dev'] as { sequence: number }).sequence).toBe(0);
    });
  });

  it('révisions illisibles : repart de zéro sans échouer', async () => {
    await withCwd(async (dir) => {
      fs.mkdirSync(path.join(dir, 'data'));
      fs.writeFileSync(path.join(dir, 'data', 'calendar-revisions.json'), '{pas du json');
      const text = await build(realMatches).calendar();
      expect(readEvents(text!)).toHaveLength(15);
    });
  });
});
