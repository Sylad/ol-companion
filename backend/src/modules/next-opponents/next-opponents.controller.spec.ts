import { Logger, ServiceUnavailableException } from '@nestjs/common';
import type { LeagueMatchesService } from '../match-impact/league-matches.service';
import type { FdLeagueMatch } from '../match-impact/match-impact';
import { NextOpponentsController } from './next-opponents.controller';

/** L273 — `GET /api/next-opponents` : 503 sans donnée, date de la copie, journal des clubs non reliés. */
type Copy = { matches: FdLeagueMatch[]; fetchedAt: number } | null;

const match = (
  over: Partial<FdLeagueMatch> & Pick<FdLeagueMatch, 'homeTeam' | 'awayTeam'>,
): FdLeagueMatch => ({
  id: 1,
  utcDate: new Date(Date.now() + 24 * 3600_000).toISOString(),
  status: 'TIMED',
  matchday: 13,
  score: { home: null, away: null },
  ...over,
});
const lyonMonaco = match({
  homeTeam: { id: 523, name: 'Lyon' },
  awayTeam: { id: 548, name: 'Monaco' },
});
const promu = match({
  id: 2,
  homeTeam: { id: 99999, name: 'Promu FC' },
  awayTeam: { id: 524, name: 'PSG' },
});

function controllerWith(...answers: Copy[]): NextOpponentsController {
  const getMatches = jest.fn<Promise<Copy>, []>();
  for (const a of answers) getMatches.mockResolvedValueOnce(a);
  return new NextOpponentsController({
    getMatches,
  } as unknown as LeagueMatchesService);
}

describe('NextOpponentsController (L273)', () => {
  let logError: jest.SpyInstance;
  beforeEach(() => {
    logError = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
  });
  afterEach(() => logError.mockRestore());

  it('aucune donnée de football-data (ni réponse, ni copie) → 503', async () => {
    const err: unknown = await controllerWith(null)
      .get()
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ServiceUnavailableException);
    expect((err as ServiceUnavailableException).getStatus()).toBe(503);
  });

  it('une copie sans aucun match n’est pas un échec : 200, saison terminée', async () => {
    const r = await controllerWith({ matches: [], fetchedAt: 0 }).get();
    expect(r).toMatchObject({ seasonOver: true, next: [] });
  });

  it('updatedAt = date de la copie de football-data, pas l’heure de la requête', async () => {
    const fetchedAt = Date.parse('2026-11-27T15:00:00Z');
    const r = await controllerWith({ matches: [lyonMonaco], fetchedAt }).get();
    expect(r.updatedAt).toBe('2026-11-27T15:00:00.000Z');
    expect(r.next.find((n) => n.teamId === 523)).toMatchObject({
      opponentId: 471,
      venue: 'home',
    });
  });

  it('clubs non reliés : journalisés une fois, puis de nouveau seulement si la liste change', async () => {
    const withPromu = { matches: [lyonMonaco, promu], fetchedAt: Date.now() };
    const without = { matches: [lyonMonaco], fetchedAt: Date.now() };
    const c = controllerWith(withPromu, withPromu, without, withPromu);
    expect((await c.get()).unlinked).toEqual(['Promu FC']);
    await c.get();
    expect(logError).toHaveBeenCalledTimes(1);
    expect(String(logError.mock.calls[0][0])).toContain('Promu FC');
    await c.get(); // plus de club non relié : rien de journalisé
    expect(logError).toHaveBeenCalledTimes(1);
    await c.get(); // il revient : journalisé de nouveau
    expect(logError).toHaveBeenCalledTimes(2);
  });
});
