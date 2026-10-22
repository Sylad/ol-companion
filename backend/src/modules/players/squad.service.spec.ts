import { ServiceUnavailableException } from '@nestjs/common';
import { SquadService } from './squad.service';

// L210 — forme réelle de /web/squads?competitors=465 (mesurée le 22-10 : 32 entrées dont 3 du staff, position.id 0).
const athlete = (id: number, name: string, positionId: number, jerseyNum?: number) => ({
  id, name, shortName: name, jerseyNum, age: 21, position: { id: positionId, name: 'x' }, clubId: 465, imageVersion: 16,
});
const SQUAD = {
  squads: [{
    competitorId: 465,
    athletes: [
      athlete(133157, 'Justin Bengui', 1, 25),
      athlete(4569, 'Clinton Mata', 2, 22),
      athlete(77, 'Sans Numéro', 4),
      athlete(51163, 'Paul Akouokou', 3, -1),
      athlete(88, 'Numéro Zéro', 3, 0),
      athlete(1, 'Paulo Fonseca', 0),
    ],
  }],
};
const ok = (body: unknown) => Promise.resolve({ ok: true, status: 200, json: async () => body } as Response);

describe('SquadService — effectif de l\'OL (L210)', () => {
  let service: SquadService;
  let fetcher: jest.Mock;
  beforeEach(() => {
    service = new SquadService();
    fetcher = jest.fn(() => ok(SQUAD));
    service.fetcher = fetcher as never;
  });

  it('R1 — lit /web/squads du club 465 (OL) et rend nom, poste anglais et numéro de chaque joueur, staff écarté', async () => {
    const squad = await service.getSquad();
    expect(String(fetcher.mock.calls[0][0])).toContain('/web/squads/');
    expect(String(fetcher.mock.calls[0][0])).toContain('competitors=465');
    expect(squad).toEqual([
      { athleteId: 133157, name: 'Justin Bengui', position: 'Goalkeeper', jerseyNumber: 25 },
      { athleteId: 4569, name: 'Clinton Mata', position: 'Defender', jerseyNumber: 22 },
      { athleteId: 77, name: 'Sans Numéro', position: 'Attacker', jerseyNumber: null },
      // L213 — 365scores envoie -1 (ou 0) pour un numéro inconnu : jamais un faux numéro
      { athleteId: 51163, name: 'Paul Akouokou', position: 'Midfielder', jerseyNumber: null },
      { athleteId: 88, name: 'Numéro Zéro', position: 'Midfielder', jerseyNumber: null },
    ]);
  });

  it('R2 — une seule lecture 365scores pour des appels répétés (copie 1 h)', async () => {
    await service.getSquad();
    await service.getSquad();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('R3 — un 200 sans « squads » (rendu dégradé) n\'est pas un effectif vide : 503 sans copie', async () => {
    fetcher.mockImplementation(() => ok({}));
    await expect(service.getSquad()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it.each([
    ['squads: []', { squads: [] }],
    ['sans l\'entrée 465 (un autre club)', { squads: [{ competitorId: 999, athletes: [athlete(5, 'Autre Club', 1, 1)] }] }],
    ['l\'entrée 465 sans joueur', { squads: [{ competitorId: 465, athletes: [] }] }],
  ])('R4 — un 200 avec %s est un rendu dégradé : 503 sans copie, journalisé, jamais un effectif vide', async (_nom, body) => {
    const warn = jest.spyOn(service['logger'], 'warn').mockImplementation();
    fetcher.mockImplementation(() => ok(body));
    await expect(service.getSquad()).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('R4 — un rendu dégradé après une bonne lecture garde la dernière bonne copie et journalise', async () => {
    const warn = jest.spyOn(service['logger'], 'warn').mockImplementation();
    const t = jest.spyOn(Date, 'now');
    t.mockReturnValue(1_000_000);
    await service.getSquad();
    t.mockReturnValue(1_000_000 + 2 * 60 * 60 * 1000);
    fetcher.mockImplementation(() => ok({ squads: [] }));
    expect(await service.getSquad()).toHaveLength(5);
    expect(warn).toHaveBeenCalledTimes(1);
    t.mockRestore();
  });

  it('R3 — un échec après une lecture réussie rend la dernière copie connue', async () => {
    const t = jest.spyOn(Date, 'now');
    t.mockReturnValue(1_000_000);
    await service.getSquad();
    t.mockReturnValue(1_000_000 + 2 * 60 * 60 * 1000);
    fetcher.mockImplementation(() => Promise.reject(new TypeError('Failed to fetch')));
    expect(await service.getSquad()).toHaveLength(5);
    t.mockRestore();
  });
});
