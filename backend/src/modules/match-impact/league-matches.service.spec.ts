import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { BadRequestException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { LEAGUE_MATCHES_FAILURE_WAIT_MS, LEAGUE_MATCHES_TTL_MS, LeagueMatchesService } from './league-matches.service';
import { MatchImpactController } from './match-impact.controller';

const fdMatch = (id: number, home: number, away: number, score: [number, number] | null, matchday = 1) => ({
  id,
  utcDate: '2026-08-22T18:45:00Z',
  status: score ? 'FINISHED' : 'TIMED',
  matchday,
  homeTeam: { id: home, name: `Club ${home} FC`, shortName: `Club ${home}` },
  awayTeam: { id: away, name: `Club ${away} FC`, shortName: `Club ${away}` },
  score: { fullTime: { home: score?.[0] ?? null, away: score?.[1] ?? null } },
});

describe('LeagueMatchesService (L265) — un appel football-data, copie de 15 min', () => {
  const realFetch = globalThis.fetch;
  const realCwd = process.cwd();
  let dir: string;
  let calls: string[];
  let reply: () => Promise<Response>;
  const config = (key: string) => ({ get: () => key }) as unknown as ConfigService;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'l265-'));
    process.chdir(dir);
    calls = [];
    globalThis.fetch = ((input: unknown, init?: RequestInit) => {
      calls.push(`${String(input)} ${JSON.stringify(init?.headers)}`);
      return reply();
    }) as typeof fetch;
  });
  afterEach(() => {
    globalThis.fetch = realFetch;
    process.chdir(realCwd);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  const ok = (matches: unknown[]) => () => Promise.resolve(new Response(JSON.stringify({ matches }), { status: 200 }));

  it('demande /v4/competitions/2015/matches avec la clé, garde les noms courts, met en copie', async () => {
    reply = ok([fdMatch(1, 523, 511, [2, 0])]);
    const service = new LeagueMatchesService(config('cle'));
    const first = await service.getMatches();
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain('https://api.football-data.org/v4/competitions/2015/matches');
    expect(calls[0]).toContain('"X-Auth-Token":"cle"');
    expect(first!.matches[0]).toEqual({
      id: 1, utcDate: '2026-08-22T18:45:00Z', status: 'FINISHED', matchday: 1,
      homeTeam: { id: 523, name: 'Club 523' }, awayTeam: { id: 511, name: 'Club 511' }, score: { home: 2, away: 0 },
    });
    await service.getMatches();
    expect(calls).toHaveLength(1); // copie fraîche : pas de second appel
  });

  it('copie périmée + appel refusé (429) : la copie est servie avec sa date', async () => {
    const ts = Date.now() - LEAGUE_MATCHES_TTL_MS - 1;
    fs.mkdirSync('data');
    fs.writeFileSync('data/ligue1-matches-fd.json', JSON.stringify({ ts, matches: [{ id: 7 }] }));
    reply = () => Promise.resolve(new Response('{}', { status: 429 }));
    const got = await new LeagueMatchesService(config('cle')).getMatches();
    expect(calls).toHaveLength(1);
    expect(got).toEqual({ matches: [{ id: 7 }], fetchedAt: ts });
  });

  it('sans copie, appel en échec : null', async () => {
    reply = () => Promise.reject(new Error('réseau'));
    expect(await new LeagueMatchesService(config('cle')).getMatches()).toBeNull();
  });

  it('réponse sans match : la copie ne change pas', async () => {
    reply = ok([]);
    expect(await new LeagueMatchesService(config('cle')).getMatches()).toBeNull();
    expect(fs.existsSync('data/ligue1-matches-fd.json')).toBe(false);
  });

  it('sans clé : aucun appel', async () => {
    reply = ok([]);
    expect(await new LeagueMatchesService(config('')).getMatches()).toBeNull();
    expect(calls).toHaveLength(0);
  });

  it('après un 429 : les lectures suivantes servent la copie sans rappeler football-data, jusqu’au délai', async () => {
    const ts = Date.now() - LEAGUE_MATCHES_TTL_MS - 1;
    fs.mkdirSync('data');
    fs.writeFileSync('data/ligue1-matches-fd.json', JSON.stringify({ ts, matches: [{ id: 7 }] }));
    reply = () => Promise.resolve(new Response('{}', { status: 429 }));
    const service = new LeagueMatchesService(config('cle'));
    const debut = Date.now();
    const now = jest.spyOn(Date, 'now');
    try {
      now.mockReturnValue(debut);
      await service.getMatches();
      expect(calls).toHaveLength(1);
      now.mockReturnValue(debut + 60_000);
      expect(await service.getMatches()).toEqual({ matches: [{ id: 7 }], fetchedAt: ts });
      now.mockReturnValue(debut + LEAGUE_MATCHES_FAILURE_WAIT_MS - 1);
      await service.getMatches();
      expect(calls).toHaveLength(1); // échec puis deux lectures : toujours un seul appel
      // Délai écoulé : un nouvel essai, qui réussit et remet la copie à jour.
      reply = ok([fdMatch(1, 523, 511, [2, 0])]);
      now.mockReturnValue(debut + LEAGUE_MATCHES_FAILURE_WAIT_MS);
      const frais = await service.getMatches();
      expect(calls).toHaveLength(2);
      expect(frais!.matches[0].id).toBe(1);
    } finally {
      now.mockRestore();
    }
  });

  it.each([
    ['erreur réseau', () => Promise.reject(new Error('réseau'))],
    ['réponse sans match', () => Promise.resolve(new Response(JSON.stringify({ matches: [] }), { status: 200 }))],
  ])('sans copie, %s : null, et la lecture suivante ne rappelle pas', async (_nom, r) => {
    reply = r as () => Promise<Response>;
    const service = new LeagueMatchesService(config('cle'));
    expect(await service.getMatches()).toBeNull();
    expect(await service.getMatches()).toBeNull();
    expect(calls).toHaveLength(1);
  });

  it('un succès efface l’échec : copie périmée plus tard → nouvel appel aussitôt', async () => {
    reply = ok([fdMatch(1, 523, 511, [2, 0])]);
    const service = new LeagueMatchesService(config('cle'));
    const debut = Date.now();
    const now = jest.spyOn(Date, 'now');
    try {
      now.mockReturnValue(debut);
      await service.getMatches();
      now.mockReturnValue(debut + LEAGUE_MATCHES_TTL_MS);
      await service.getMatches();
      expect(calls).toHaveLength(2);
    } finally {
      now.mockRestore();
    }
  });

  it('deux lectures simultanées : un seul appel', async () => {
    reply = ok([fdMatch(1, 523, 511, [2, 0])]);
    const service = new LeagueMatchesService(config('cle'));
    await Promise.all([service.getMatches(), service.getMatches()]);
    expect(calls).toHaveLength(1);
  });
});

describe('MatchImpactController (L265)', () => {
  const league = (data: unknown) => ({ getMatches: () => Promise.resolve(data) }) as unknown as LeagueMatchesService;
  const matches = [
    { id: 1, utcDate: '2026-08-22T18:45:00Z', status: 'FINISHED', matchday: 1, homeTeam: { id: 511, name: 'Toulouse' }, awayTeam: { id: 523, name: 'Lyon' }, score: { home: 0, away: 2 } },
  ];

  it('rend le calcul et la date de la copie de football-data', async () => {
    const res = await new MatchImpactController(league({ matches, fetchedAt: Date.UTC(2026, 7, 23) })).get('2026-08-22T18:45:00Z');
    expect(res.after).toEqual({ position: 1, points: 3 });
    expect(res.before).toBeNull();
    expect(res.updatedAt).toBe('2026-08-23T00:00:00.000Z');
  });
  it('400 sans instant lisible', async () => {
    await expect(new MatchImpactController(league(null)).get('demain')).rejects.toBeInstanceOf(BadRequestException);
    await expect(new MatchImpactController(league(null)).get(undefined)).rejects.toBeInstanceOf(BadRequestException);
  });
  it('503 sans données de football-data', async () => {
    await expect(new MatchImpactController(league(null)).get('2026-08-22T18:45:00Z')).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
  it('404 sans match de l’OL à cet instant', async () => {
    await expect(
      new MatchImpactController(league({ matches, fetchedAt: 0 })).get('2026-09-22T18:45:00Z'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
