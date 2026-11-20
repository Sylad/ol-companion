import * as fs from 'fs';
import * as path from 'path';
import { aggregate } from './live-match.aggregator';
import { performerStat } from './top-performer-stats';
import { Scores365GameDetailResponseSchema } from '../../config/scores365-game.schema';
import { parseExternal } from '../../common/zod-validation.pipe';

const fixture = (name: string) =>
  JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../test/fixtures', name), 'utf-8'));

/** Réponse réelle de `/web/game/?langId=15&gameId=4735207` (Lille – Lyon, à venir), relevée le 20-11. */
const lilleLyon = parseExternal(Scores365GameDetailResponseSchema, fixture('365_game_lille_lyon_upcoming_L266.json'), 'fixture');

describe('L266 — Joueurs en vue, Lille – Lyon (réponse réelle, match à venir)', () => {
  const tp = aggregate(lilleLyon).topPerformers;
  const ligne = (nom: string) => {
    for (const c of tp) for (const p of [c.homePlayer, c.awayPlayer]) if (p?.name === nom) return p;
    throw new Error(`${nom} absent`);
  };

  it('la source donne bien « Tackles 0.1 » à Niakhate (type 38) pour 8 apparitions', () => {
    const cat = lilleLyon.game!.topPerformers!.categories!.find((c) => c.awayPlayer?.name === 'Moussa Niakhate')!;
    expect(cat.awayPlayer!.stats![0]).toMatchObject({ type: 38, name: 'Tackles', value: '0.1' });
    expect(cat.awayPlayer!.stats![2]).toMatchObject({ type: 5, value: '8' });
  });

  it('Niakhate : 0,1 tacle gagné PAR MATCH, jamais « Tacles : 0.1 »', () => {
    expect(ligne('Moussa Niakhate')).toMatchObject({ statName: 'Tacles gagnés par match', statValue: '0.1' });
  });

  it('une moyenne entière garde sa décimale (Ribeiro « 1 » → « 1.0 »), pour ne pas se lire comme un total', () => {
    expect(ligne('Alexsandro Ribeiro')).toMatchObject({ statName: 'Tacles gagnés par match', statValue: '1.0' });
  });

  it('attaquants et milieux : buts de la saison, en total', () => {
    expect(ligne('Ernest Nuamah')).toMatchObject({ statName: 'Buts', statValue: '4' });
    expect(ligne('Corentin Tolisso')).toMatchObject({ statName: 'Buts', statValue: '2' });
    expect(ligne('Soriba Diaoune')).toMatchObject({ statName: 'Buts', statValue: '1' });
    expect(ligne('Ethan Mbappé')).toMatchObject({ statName: 'Buts', statValue: '2' });
  });
});

describe('L266 — sens des types, établi sur le classement des joueurs de Ligue 1 (réponse réelle)', () => {
  const tables = fixture('365_stats_ligue1_joueurs_L266.json').stats.athletesStats.tables as {
    id: number;
    name: string;
    rows: { entity: { id: number }; stats: { typeId: number; value: string }[] }[];
  }[];
  const table = (id: number) => tables.find((t) => t.id === id)!;
  const valeur = (t: number, athlete: number, type: number) =>
    table(t).rows.find((r) => r.entity.id === athlete)?.stats.find((s) => s.typeId === type)?.value;

  it('type 38 = « Tacles Gagnés », chiffres décimaux : une moyenne par match, pas un total', () => {
    expect(table(9).name).toBe('Tacles Gagnés');
    const v = table(9).rows.map((r) => r.stats.find((s) => s.typeId === 38)!.value);
    expect(v.length).toBe(20);
    // fractions au dixième (2.7, 1.3…) : impossible pour un total ; une moyenne ronde s'écrit
    // sans décimale (« 2 », au milieu des 2.1 et 1.8) — d'où le « 1 » de Ribeiro.
    expect(v.filter((x) => /^\d+\.\d$/.test(x)).length).toBeGreaterThan(15);
    expect(v.every((x) => /^\d+(\.\d)?$/.test(x) && Number(x) < 5)).toBe(true);
    expect(v).toContain('2');
  });

  it('types 1 et 2 = totaux de la saison : mêmes chiffres que les Joueurs en vue', () => {
    expect(valeur(1, 115749, 1)).toBe('4'); // Nuamah, 4 buts
    expect(valeur(3, 2185, 2)).toBe('3'); // Tolisso, 3 passes décisives
    const tolisso = lilleLyon.game!.topPerformers!.categories!.find((c) => c.awayPlayer?.name === 'Corentin Tolisso')!;
    expect(tolisso.awayPlayer!.stats!.find((s) => s.type === 2)!.value).toBe('3');
  });
});

describe('performerStat', () => {
  it('un type au sens non établi n’est pas affiché ; on prend le suivant', () => {
    expect(performerStat([{ type: 999, name: 'Mystère', value: '3' }, { type: 5, name: 'Apparitions', value: '8' }], 'saison')).toEqual({
      statName: 'Matchs joués',
      statValue: '8',
    });
    expect(performerStat([{ type: 999, name: 'Mystère', value: '3' }], 'saison')).toBeNull();
    expect(performerStat(undefined, 'match')).toBeNull();
  });

  it('les types dépendent de la période : 4 = tirs cadrés dans un match, inconnu avant', () => {
    expect(performerStat([{ type: 4, value: '1' }], 'match')).toEqual({ statName: 'Tirs cadrés', statValue: '1' });
    expect(performerStat([{ type: 4, value: '1' }], 'saison')).toBeNull();
    // 38 n'existe pas dans un match en cours (les tacles y sont le type 20)
    expect(performerStat([{ type: 38, value: '0.1' }], 'match')).toBeNull();
  });

  it('match en cours (Lyon – Rennes, réponse réelle) : chiffres du match', () => {
    const tp = aggregate(fixture('365_game_lyon_rennes_live.json')).topPerformers;
    expect(tp.map((c) => c.homePlayer?.statName)).toEqual(['Buts', 'Buts attendus (xG)', 'Interceptions']);
  });

  it('match terminé (Anderlecht – Lyon, réponse réelle) : défenseurs en interceptions du match', () => {
    const tp = aggregate(fixture('365_game_anderlecht_lyon_ended_member_without_id.json')).topPerformers;
    expect(tp[2].homePlayer).toMatchObject({ statName: 'Interceptions', statValue: '2' });
  });
});
