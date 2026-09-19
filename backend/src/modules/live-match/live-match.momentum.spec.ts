import * as fs from 'fs';
import * as path from 'path';
import { attributeTeam, computeMomentum, parsePlayByPlay, scoreMessage } from './live-match.momentum';

const raw = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../../../test/fixtures/365_pbp_anderlecht_lyon_ended.json'), 'utf-8'),
);
const TEAMS = { homeName: 'Anderlecht', awayName: 'Lyon' };

describe('parsePlayByPlay', () => {
  it('lit les messages 365scores (type, minute, période, commentaire)', () => {
    const msgs = parsePlayByPlay(raw);
    expect(msgs.length).toBe(110); // 112 messages, 2 bornes de période sans Timeline
    const goal = msgs.find((m) => m.type === 14 && m.minute === 8);
    expect(goal).toMatchObject({ competitorNum: 2, period: 1 });
  });

  it('tolère un payload inattendu (renvoie vide)', () => {
    expect(parsePlayByPlay({})).toEqual([]);
    expect(parsePlayByPlay(null)).toEqual([]);
  });
});

describe('attributeTeam', () => {
  it("privilégie CompetitorNum quand 365scores l'indique", () => {
    expect(attributeTeam({ competitorNum: 1, comment: 'But! ... (Lyon) marque' }, TEAMS)).toBe('home');
  });
  it('lit « (Équipe) » dans le commentaire', () => {
    expect(attributeTeam({ comment: 'Arrêt. Corentin Tolisso (Lyon) de la tête' }, TEAMS)).toBe('away');
    expect(attributeTeam({ comment: 'Faute de Enric Llansana (Anderlecht).' }, TEAMS)).toBe('home');
  });
  it('lit « Corner, Équipe. » / « Hors jeu, Équipe. »', () => {
    expect(attributeTeam({ comment: 'Corner, Lyon. Corner concédé par X.' }, TEAMS)).toBe('away');
    expect(attributeTeam({ comment: 'Hors jeu, Anderlecht. Y a tenté une passe' }, TEAMS)).toBe('home');
  });
  it('renvoie null sinon', () => {
    expect(attributeTeam({ comment: 'Mi-Temps 0-2' }, TEAMS)).toBeNull();
  });
});

describe('scoreMessage — poids par type', () => {
  it('but > tir cadré > tir contré/non cadré > corner > coup franc adverse', () => {
    const w = (type: number, comment = '') => scoreMessage({ type, comment });
    expect(w(14)).toBeGreaterThan(w(3));
    expect(w(3)).toBeGreaterThan(w(2));
    expect(w(2)).toBeGreaterThanOrEqual(w(20));
    expect(w(20)).toBeGreaterThan(w(9));
    expect(w(9)).toBeGreaterThan(w(12, 'coup franc dans la moitié de terrain adverse'));
    expect(w(12, 'coup franc dans la moitié de terrain adverse')).toBeGreaterThan(w(12, 'coup franc dans sa moitié de terrain'));
  });
  it('ignore les cartons, remplacements, fautes (déjà comptées côté coup franc obtenu) et bornes de période', () => {
    for (const t of [11, 15, 18, 37, 44, 45]) expect(scoreMessage({ type: t, comment: '' })).toBe(0);
  });
});

describe('computeMomentum (Anderlecht 1-2 Lyon, 16/09/2026)', () => {
  const points = computeMomentum(parsePlayByPlay(raw), TEAMS, 90);

  it('une valeur par minute de 1 à 90, bornée à ±100', () => {
    expect(points.length).toBe(90);
    expect(points[0].minute).toBe(1);
    expect(points[89].minute).toBe(90);
    for (const p of points) expect(Math.abs(p.value)).toBeLessThanOrEqual(100);
  });

  it("pousse vers l'extérieur (négatif) aux minutes des buts lyonnais (8', 22') et vers le domicile au but d'Anderlecht (61')", () => {
    const at = (m: number) => points[m - 1].value;
    expect(at(8)).toBeLessThan(0);
    expect(at(22)).toBeLessThan(0);
    expect(at(61)).toBeGreaterThan(0);
  });

  it('est lissé : la minute suivant un but garde le même signe', () => {
    const at = (m: number) => points[m - 1].value;
    expect(Math.sign(at(9))).toBe(Math.sign(at(8)));
    expect(Math.abs(at(9))).toBeLessThan(Math.abs(at(8)));
  });

  it('en cours de match, ne dépasse pas la minute courante', () => {
    expect(computeMomentum(parsePlayByPlay(raw), TEAMS, 30).length).toBe(30);
  });
});
