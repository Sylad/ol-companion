import { LineupService } from './lineup.service';

// L214 — 365scores envoie jerseyNum -1 (ou 0) pour un numéro inconnu : la feuille ne garde qu'un numéro > 0.
const member = (id: number, jerseyNumber: number | undefined) => ({ id, name: `Joueur ${id}`, shortName: `J. ${id}`, jerseyNumber });
const GAME = {
  game: {
    id: 9, startTime: '2026-10-10T19:00:00Z', competitionDisplayName: 'Ligue 1', roundNum: 8,
    homeCompetitor: {
      id: 465, name: 'Lyon', score: 2,
      lineups: {
        formation: '4-3-3',
        members: [1, 2, 3, 4, 5].map((id) => ({ id, status: 1, position: { name: 'Midfielder' }, yardFormation: { line: 3, fieldSide: 10 * id } })),
      },
    },
    awayCompetitor: { id: 7, name: 'Lens', score: 1 },
    members: [member(1, 10), member(2, -1), member(3, 0), member(4, undefined), member(5, 1.5)],
  },
};
const ok = (body: unknown) => Promise.resolve({ ok: true, status: 200, json: async () => body } as Response);

describe('LineupService — numéros de la feuille (L214)', () => {
  afterEach(() => jest.restoreAllMocks());

  it('R7 — seul un numéro > 0 est gardé : -1, 0 et absent donnent null', async () => {
    const service = new LineupService();
    jest.spyOn(service as unknown as { writeCache: (lineup: unknown) => void }, 'writeCache').mockImplementation(() => undefined);
    jest.spyOn(global, 'fetch').mockImplementation((url) =>
      String(url).includes('/web/games/results/') ? ok({ games: [{ id: 9, startTime: '2026-10-10T19:00:00Z', statusGroup: 4, hasLineups: true }] }) : ok(GAME));
    const lineup = await service.getLatestLineup({ force: true });
    const numeros = Object.fromEntries([...lineup!.starters, ...lineup!.bench].map((p) => [p.id, p.jerseyNumber]));
    expect(numeros).toEqual({ 1: 10, 2: null, 3: null, 4: null, 5: 1.5 });
  });
});
