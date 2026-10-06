import * as fs from 'fs';
import * as path from 'path';
import {
  describeClubsResolvedFromGames,
  readScores365Standings,
  type Scores365StandingsReading,
} from './scores365-standings';

/**
 * L35 — charges RÉELLES de `/web/standings/?…&competitions=35`, capturées le
 * 03/10/2026 à une minute d'intervalle et réduites (clés retirées, aucune
 * valeur modifiée) :
 *  - `rows_without_competitor` : 18 lignes dont 2 (positions 3 et 16) sans objet
 *    `competitor` — le rendu qui vidait /api/standings ;
 *  - `complete` : le même classement, rendu complet (autre clé de cache CDN) ;
 *  - `empty_envelope` : 121 octets, HTTP 200, aucune clé `standings`.
 * Les trois formes sont des rendus dégradés ou sains de la MÊME origine : elles
 * ne dépendent ni des en-têtes ni des paramètres (mesuré), seul le cache
 * CloudFront les fige 30 min par clé.
 */
const fixture = (name: string): unknown =>
  JSON.parse(
    fs.readFileSync(
      path.resolve(__dirname, '../../../test/fixtures', name),
      'utf-8',
    ),
  );

const degraded = () =>
  fixture('365_standings_ligue1_rows_without_competitor.json') as Payload;
const complete = () => fixture('365_standings_ligue1_complete.json') as Payload;
const emptyEnvelope = () => fixture('365_standings_ligue1_empty_envelope.json');

interface Payload {
  standings: Array<{ rows: Array<Record<string, unknown>> }>;
}

type Ok = Extract<Scores365StandingsReading, { ok: true }>;
type Ko = Extract<Scores365StandingsReading, { ok: false }>;

function ok(reading: Scores365StandingsReading): Ok {
  if (!reading.ok) throw new Error(`lecture refusée : ${reading.reason}`);
  return reading;
}

function ko(reading: Scores365StandingsReading): Ko {
  if (reading.ok)
    throw new Error('lecture acceptée alors qu’un refus était attendu');
  return reading;
}

const clubs = (reading: Ok) =>
  reading.rows.map((r) => [r.position, r.competitor.id, r.competitor.name]);

describe('readScores365Standings — lignes sans « competitor » (L35)', () => {
  it('rend les 18 lignes, dans l’ordre, avec le club des lignes 3 et 16 résolu par leurs propres matchs', () => {
    const reading = ok(readScores365Standings(degraded(), 'test'));

    expect(reading.rows).toHaveLength(18);
    expect(reading.rows.map((r) => r.position)).toEqual(
      Array.from({ length: 18 }, (_, i) => i + 1),
    );
    expect(clubs(reading)[2]).toEqual([3, 6075, 'Paris FC']);
    expect(clubs(reading)[15]).toEqual([16, 488, 'Troyes']);
    expect(reading.resolvedFromGames).toEqual([
      { position: 3, id: 6075, name: 'Paris FC' },
      { position: 16, id: 488, name: 'Troyes' },
    ]);
  });

  it('donne exactement les clubs du rendu complet capturé au même moment', () => {
    const fromDegraded = ok(readScores365Standings(degraded(), 'test'));
    const fromComplete = ok(readScores365Standings(complete(), 'test'));

    expect(fromComplete.resolvedFromGames).toEqual([]);
    expect(clubs(fromDegraded)).toEqual(clubs(fromComplete));
  });

  it('ne touche pas aux statistiques des lignes résolues', () => {
    const row = ok(readScores365Standings(degraded(), 'test')).rows[2];

    expect(row).toMatchObject({
      position: 3,
      gamePlayed: 5,
      gamesWon: 3,
      gamesEven: 2,
      gamesLost: 0,
      for: 8,
      against: 3,
      ratio: 5,
      points: 11,
      recentForm: [1, 2, 1, 1, 2],
    });
  });

  it('retrouve le club de CHACUNE des 18 lignes du rendu complet quand on lui retire son « competitor »', () => {
    const expected = clubs(ok(readScores365Standings(complete(), 'test')));

    for (let i = 0; i < 18; i++) {
      const payload = complete();
      delete payload.standings[0].rows[i].competitor;

      const reading = ok(readScores365Standings(payload, 'test'));

      expect(clubs(reading)).toEqual(expected);
      expect(reading.resolvedFromGames.map((c) => c.position)).toEqual([i + 1]);
    }
  });

  it('porte la saison et les compétitions de la réponse', () => {
    const reading = ok(readScores365Standings(degraded(), 'test'));

    expect(reading.seasonNum).toBe(94);
    expect(reading.data.competitions?.[0]?.seasons).toEqual([
      { num: 94, name: '2026/2027' },
    ]);
  });
});

describe('readScores365Standings — jamais de classement incomplet (L35)', () => {
  it('refuse tout le classement quand une ligne sans club n’a aucun match pour le désigner', () => {
    const payload = degraded();
    delete payload.standings[0].rows[2].detailedRecentForm;
    delete payload.standings[0].rows[2].nextMatch;

    const reading = ko(readScores365Standings(payload, 'test'));

    expect(reading.reason).toContain('position 3');
    expect(reading).not.toHaveProperty('rows');
  });

  it('refuse quand un seul match reste : deux clubs possibles, aucun moyen de trancher', () => {
    const payload = degraded();
    delete payload.standings[0].rows[15].detailedRecentForm;

    const reading = ko(readScores365Standings(payload, 'test'));

    expect(reading.reason).toContain('position 16');
  });

  it('refuse quand un seul match à un seul côté reste : il peut désigner l’adversaire', () => {
    const payload = degraded();
    const row = payload.standings[0].rows[15];
    const [game] = row.detailedRecentForm as Array<Record<string, unknown>>;
    // Le seul match gardé ne porte que Angers (l’adversaire de la ligne 16).
    row.detailedRecentForm = [{ ...game, awayCompetitor: undefined }];
    delete row.nextMatch;

    const reading = ko(readScores365Standings(payload, 'test'));

    expect(reading.reason).toContain('position 16');
  });

  it('refuse quand les matchs à deux clubs sont moins de deux, même si d’autres n’en portent qu’un', () => {
    const payload = degraded();
    const row = payload.standings[0].rows[15];
    const games = row.detailedRecentForm as Array<Record<string, unknown>>;
    row.detailedRecentForm = [
      games[0],
      { ...games[1], awayCompetitor: undefined },
      { ...games[2], awayCompetitor: undefined },
    ];
    delete row.nextMatch;

    const reading = ko(readScores365Standings(payload, 'test'));

    expect(reading.reason).toContain('position 16');
  });

  it('résout le club avec un seul match récent et le prochain match (début de saison)', () => {
    const payload = degraded();
    const row = payload.standings[0].rows[15];
    row.detailedRecentForm = (
      row.detailedRecentForm as Array<Record<string, unknown>>
    ).slice(0, 1);

    const reading = ok(readScores365Standings(payload, 'test'));

    expect(clubs(reading)[15]).toEqual([16, 488, 'Troyes']);
  });

  it('refuse un club retrouvé par ses matchs mais sans nom', () => {
    const payload = degraded();
    const row = payload.standings[0].rows[15];
    const strip = (g: Record<string, unknown>) => {
      for (const side of ['homeCompetitor', 'awayCompetitor']) {
        const c = g[side] as { id: number } | undefined;
        if (c?.id === 488) g[side] = { id: 488 };
      }
      return g;
    };
    row.detailedRecentForm = (
      row.detailedRecentForm as Array<Record<string, unknown>>
    ).map(strip);
    strip(row.nextMatch as Record<string, unknown>);

    const reading = ko(readScores365Standings(payload, 'test'));

    expect(reading.reason).toContain('position 16');
  });

  it('refuse un classement dont les positions ne sont pas 1..N (ligne entière manquante)', () => {
    const payload = complete();
    payload.standings[0].rows.splice(6, 1);

    const reading = ko(readScores365Standings(payload, 'test'));

    expect(reading.reason).toMatch(/position/i);
    expect(reading.reason).toContain('expected 7');
  });

  it('refuse un classement amputé de sa dernière ligne (18 clubs attendus)', () => {
    const payload = complete();
    payload.standings[0].rows.pop();

    const reading = ko(readScores365Standings(payload, 'test'));

    expect(reading.reason).toContain('18');
    expect(reading.reason).toContain('17');
  });

  it('refuse un classement dont une position est en double', () => {
    const payload = complete();
    payload.standings[0].rows[5].position = 5;

    const reading = ko(readScores365Standings(payload, 'test'));

    expect(reading.reason).toMatch(/position/i);
    expect(reading.reason).toContain('expected 6, found 5');
    expect(reading.reason).not.toContain('whole rows are missing');
  });

  it('refuse quand les matchs désignent un club déjà porté par une autre ligne', () => {
    const payload = degraded();
    const rows = payload.standings[0].rows;
    // Ligne 3 (sans club) : on lui donne les matchs de Lyon, déjà ligne 2.
    rows[2].detailedRecentForm = rows[1].detailedRecentForm;
    rows[2].nextMatch = rows[1].nextMatch;

    const reading = ko(readScores365Standings(payload, 'test'));

    expect(reading.reason).toContain('465');
    expect(reading.reason).toMatch(/position(s)? 2.*3|3.*2/);
  });

  it('lève toujours sur une ligne sans position (forme inconnue)', () => {
    const payload = complete();
    delete payload.standings[0].rows[0].position;

    expect(() => readScores365Standings(payload, 'test')).toThrow(
      /Invalid test response/,
    );
  });

  it('ne rejette pas un rendu complet dont les matchs d’une ligne ont une forme inattendue', () => {
    const payload = complete();
    payload.standings[0].rows[4].detailedRecentForm = 'n/a';
    payload.standings[0].rows[4].nextMatch = [1, 2];

    const reading = ok(readScores365Standings(payload, 'test'));

    expect(reading.rows).toHaveLength(18);
  });
});

describe('readScores365Standings — enveloppe vide (L35)', () => {
  it('refuse en disant pourquoi : pas de classement, et les clés reçues', () => {
    const reading = ko(readScores365Standings(emptyEnvelope(), 'test'));

    expect(reading.reason).toContain('no standings');
    expect(reading.reason).toContain(
      'lastUpdateId, requestedUpdateId, ttl, sports, countries, competitions, bookmakers',
    );
  });

  it('refuse un bloc de classement sans ligne', () => {
    const reading = ko(
      readScores365Standings(
        { standings: [{ isCurrentStage: true, rows: [] }] },
        'test',
      ),
    );

    expect(reading.reason).toContain('no standings');
  });
});

describe('describeClubsResolvedFromGames', () => {
  it('nomme la position et le club retrouvé', () => {
    expect(
      describeClubsResolvedFromGames([
        { position: 3, id: 6075, name: 'Paris FC' },
        { position: 16, id: 488, name: 'Troyes' },
      ]),
    ).toBe('3 → Paris FC (#6075), 16 → Troyes (#488)');
  });
});
