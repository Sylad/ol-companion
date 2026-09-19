import * as fs from 'fs';
import * as path from 'path';
import { extractStandingsAround } from './live-match.standings';
import { Scores365StandingsResponseSchema } from '../../modules/standings/standings.schema';
import { parseExternal } from '../../common/zod-validation.pipe';

// Capturé le 19/09/2026 pendant Lyon-Rennes (2-0 en cours) : Lyon 2e avec 11 pts,
// le match en cours déjà compté, lignes Lyon/Rennes/Angers/Le Mans en live.
const raw = parseExternal(
  Scores365StandingsResponseSchema,
  JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../test/fixtures/365_standings_ligue1_live_lyon_2nd.json'), 'utf-8')),
  'test',
);

describe('extractStandingsAround', () => {
  it('renvoie OL et ses 2 voisins de chaque côté (5 lignes), dans l\'ordre du classement', () => {
    const rows = extractStandingsAround(raw, 465, 2);
    expect(rows.map((r) => r.position)).toEqual([1, 2, 3, 4, 5]);
    expect(rows.map((r) => r.name)).toEqual(['Monaco', 'Lyon', 'Paris FC', 'Lille', 'Rennes']);
  });

  it('remplit la fenêtre vers le bas quand OL est en tête (toujours 5 lignes)', () => {
    const rows = extractStandingsAround(raw, 465, 2, { forcePosition: 1 });
    expect(rows).toHaveLength(5);
    expect(rows[0].position).toBe(1);
  });

  it('porte points, joués, différence, et le flag live', () => {
    const lyon = extractStandingsAround(raw, 465, 2).find((r) => r.teamId === 465)!;
    expect(lyon).toMatchObject({ played: 5, points: 11, goalDifference: 6, isLive: true, isOl: true });
    const monaco = extractStandingsAround(raw, 465, 2).find((r) => r.teamId !== 465 && r.position === 1)!;
    expect(monaco.isLive).toBe(false);
  });

  it('renvoie vide si OL est absent du classement', () => {
    expect(extractStandingsAround(raw, 999999, 2)).toEqual([]);
  });
});
