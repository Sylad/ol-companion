import * as fs from 'fs';
import * as path from 'path';
import {
  applyMomentum,
  attributeTeam,
  computeMomentum,
  countMomentumActions,
  MOMENTUM_BASIS,
  normaliseTeamName,
  parsePlayByPlay,
  scoreMessage,
  type TeamNames,
} from './live-match.momentum';

const raw = JSON.parse(
  fs.readFileSync(
    path.resolve(
      __dirname,
      '../../../test/fixtures/365_pbp_anderlecht_lyon_ended.json',
    ),
    'utf-8',
  ),
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
    expect(
      attributeTeam(
        { competitorNum: 1, comment: 'But! ... (Lyon) marque' },
        TEAMS,
      ),
    ).toBe('home');
  });
  it('lit « (Équipe) » dans le commentaire', () => {
    expect(
      attributeTeam(
        { comment: 'Arrêt. Corentin Tolisso (Lyon) de la tête' },
        TEAMS,
      ),
    ).toBe('away');
    expect(
      attributeTeam(
        { comment: 'Faute de Enric Llansana (Anderlecht).' },
        TEAMS,
      ),
    ).toBe('home');
  });
  it('lit « Corner, Équipe. » / « Hors jeu, Équipe. »', () => {
    expect(
      attributeTeam({ comment: 'Corner, Lyon. Corner concédé par X.' }, TEAMS),
    ).toBe('away');
    expect(
      attributeTeam(
        { comment: 'Hors jeu, Anderlecht. Y a tenté une passe' },
        TEAMS,
      ),
    ).toBe('home');
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
    expect(w(9)).toBeGreaterThan(
      w(12, 'coup franc dans la moitié de terrain adverse'),
    );
    expect(
      w(12, 'coup franc dans la moitié de terrain adverse'),
    ).toBeGreaterThan(w(12, 'coup franc dans sa moitié de terrain'));
  });
  it("« aile » en mot entier : un « failed » du flux anglais ne fait pas un coup franc dangereux (L274)", () => {
    const fk = (comment: string) => scoreMessage({ type: 12, comment });
    expect(fk('Free kick won after a failed clearance, in the defensive half.')).toBe(0.3);
    expect(fk("Coup franc obtenu sur l'aile droite.")).toBe(1);
    expect(fk('Coup franc obtenu sur l’aile gauche.')).toBe(1);
  });
  it('ignore les cartons, remplacements, fautes (déjà comptées côté coup franc obtenu) et bornes de période', () => {
    for (const t of [11, 15, 18, 37, 44, 45])
      expect(scoreMessage({ type: t, comment: '' })).toBe(0);
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

/**
 * L274 (D-4) : Lyon – Lillestrøm (26/11/2026) n'avait que des barres Lyon. Le détail du match nomme
 * l'équipe « Lillestrom », le play-by-play « Lillestrøm » : les 27 actions de Lillestrøm (tirs, corners, coups francs, hors-jeu) perdues en silence.
 * Play-by-play réels relevés le 27/11/2026 (pbpgenerator.365scores.com), noms et noms longs du détail du match.
 */
const fixture = (name: string) =>
  parsePlayByPlay(
    JSON.parse(
      fs.readFileSync(
        path.resolve(__dirname, `../../../test/fixtures/${name}`),
        'utf-8',
      ),
    ),
  );

const REJOUES: { match: string; file: string; teams: TeamNames }[] = [
  {
    match: 'Lyon 0-0 Lillestrøm (26/11)',
    file: '365_pbp_lyon_lillestrom_L274.json',
    teams: {
      homeName: 'Lyon',
      awayName: 'Lillestrom',
      homeAliases: ['Olympique Lyonnais'],
      awayAliases: [],
    },
  },
  {
    match: 'Lille 0-1 Lyon (21/11)',
    file: '365_pbp_lille_lyon_L274.json',
    teams: {
      homeName: 'Lille',
      awayName: 'Lyon',
      homeAliases: ['LOSC Lille'],
      awayAliases: ['Olympique Lyonnais'],
    },
  },
  {
    match: 'Real Sociedad 1-1 Lyon (05/11)',
    file: '365_pbp_real_sociedad_lyon_L274.json',
    teams: {
      homeName: 'Real Sociedad',
      awayName: 'Lyon',
      homeAliases: ['Real Sociedad de Fútbol'],
      awayAliases: ['Olympique Lyonnais'],
    },
  },
  {
    match: 'Brest 2-0 Lyon (08/11)',
    file: '365_pbp_brest_lyon_L274.json',
    teams: {
      homeName: 'Brest',
      awayName: 'Lyon',
      homeAliases: ['Stade Brestois 29'],
      awayAliases: ['Olympique Lyonnais'],
    },
  },
];

describe('normaliseTeamName (L274)', () => {
  it('ignore accents, lettres liées, casse et ponctuation', () => {
    expect(normaliseTeamName('Lillestrøm')).toBe('lillestrom');
    expect(normaliseTeamName('  Fenerbahçe SK ')).toBe('fenerbahce sk');
    expect(normaliseTeamName('Bodø/Glimt')).toBe('bodo glimt');
    expect(normaliseTeamName('Malmö FF')).toBe('malmo ff');
    expect(normaliseTeamName('Real Sociedad de Fútbol')).toBe(
      'real sociedad de futbol',
    );
    expect(normaliseTeamName('Æbelø')).toBe('aebelo');
    expect(normaliseTeamName('Saint-Étienne')).toBe('saint etienne');
  });
});

describe('attributeTeam — noms écrits autrement (L274)', () => {
  const T = REJOUES[0].teams;
  it('« Lillestrøm » du commentaire = « Lillestrom » du match', () => {
    expect(
      attributeTeam(
        { comment: 'Corner, Lillestrøm. Conceded by Ruben Kluivert.' },
        T,
      ),
    ).toBe('away');
    expect(
      attributeTeam(
        {
          comment: 'Attempt missed. Gustav Nyheim (Lillestrøm) header misses.',
        },
        T,
      ),
    ).toBe('away');
    expect(
      attributeTeam({ comment: 'Corner, Lyon. Conceded by Sander Foss.' }, T),
    ).toBe('home');
  });
  it("nom long en alias, et nom contenu dans l'autre quand un seul côté correspond", () => {
    const t: TeamNames = {
      homeName: 'Lille',
      awayName: 'Lyon',
      homeAliases: ['LOSC Lille'],
      awayAliases: ['Olympique Lyonnais'],
    };
    expect(
      attributeTeam({ comment: 'Corner, LOSC Lille. Conceded by X.' }, t),
    ).toBe('home');
    expect(
      attributeTeam({ comment: 'Foul by X (Olympique Lyonnais).' }, t),
    ).toBe('away');
    expect(
      attributeTeam({ comment: 'Corner, OL Lyon. Conceded by X.' }, t),
    ).toBe('away');
  });
  it('ne parie pas : un nom qui touche les deux côtés, ou aucun, reste sans équipe', () => {
    const t: TeamNames = {
      homeName: 'Paris FC',
      awayName: 'Paris Saint-Germain',
    };
    expect(
      attributeTeam({ comment: 'Corner, Paris. Conceded by X.' }, t),
    ).toBeNull();
    expect(
      attributeTeam({ comment: 'Corner, Marseille. Conceded by X.' }, t),
    ).toBeNull();
  });
});

describe.each(REJOUES)(
  'play-by-play réel rejoué — $match (L274)',
  ({ file, teams }) => {
    const messages = fixture(file);
    const actions = countMomentumActions(messages, teams);
    const total = actions.home + actions.away + actions.unattributed;

    it('les deux équipes ont des actions', () => {
      expect(actions.home).toBeGreaterThan(5);
      expect(actions.away).toBeGreaterThan(5);
    });

    it("moins de 5 % d'actions sans équipe", () => {
      expect(actions.unattributed / total).toBeLessThan(0.05);
    });

    it('le graphe va des deux côtés', () => {
      const points = computeMomentum(messages, teams, 90);
      expect(points.some((p) => p.value > 10)).toBe(true);
      expect(points.some((p) => p.value < -10)).toBe(true);
    });
  },
);

describe('Lyon – Lillestrøm sans le nom long (L274)', () => {
  it('la normalisation seule (« Lillestrøm » = « Lillestrom ») attribue les 27 actions de Lillestrøm', () => {
    const { teams, file } = REJOUES[0];
    const sansAlias = countMomentumActions(fixture(file), {
      homeName: teams.homeName,
      awayName: teams.awayName,
    });
    // Avec la normalisation, plus rien n'est perdu, même sans le nom long.
    expect(sansAlias.unattributed).toBe(0);
    expect(sansAlias.away).toBe(27);
  });
});

describe('coups francs obtenus — flux réel en anglais (L274)', () => {
  const fk = (file: string) => fixture(file).filter((m) => m.type === 12);

  it.each(REJOUES.map((r) => r.file))(
    '%s : camp adverse et ailes pèsent 1, son propre camp 0,3',
    (file) => {
      const msgs = fk(file);
      expect(msgs.length).toBeGreaterThan(0);
      for (const m of msgs) {
        const dangereux = /in the attacking half|on the (left|right) wing/.test(
          m.comment,
        );
        const sonCamp = /in the defensive half/.test(m.comment);
        // Chaque coup franc du flux est l'un ou l'autre : aucune formulation n'échappe à la règle.
        expect(dangereux !== sonCamp).toBe(true);
        expect(scoreMessage(m)).toBe(dangereux ? 1 : 0.3);
      }
    },
  );

  it('Lyon – Lillestrøm : 6 coups francs dangereux sur 23 (17 dans son camp)', () => {
    const w = fk(REJOUES[0].file).map(scoreMessage);
    expect(w.filter((x) => x === 1)).toHaveLength(6);
    expect(w.filter((x) => x === 0.3)).toHaveLength(17);
  });

  it("l'ancien flux français reste lu (Anderlecht – Lyon)", () => {
    const w = parsePlayByPlay(raw)
      .filter((m) => m.type === 12)
      .map(scoreMessage);
    expect(w.filter((x) => x === 1)).toHaveLength(10); // 5 adverse + 5 aile
    expect(w.filter((x) => x === 0.3)).toHaveLength(15); // « dans sa moitié de terrain »
  });
});

describe('MOMENTUM_BASIS — ce que la phrase sous le graphe énumère (L274)', () => {
  it("cite chaque sorte d'action pesée, hors-jeu compris, et rien d'autre", () => {
    expect(MOMENTUM_BASIS).toEqual([
      'tirs',
      'corners',
      'coups francs obtenus',
      'hors-jeu',
    ]);
  });

  it('les types qui pèsent sont exactement ceux de la table (tirs, but, corner, coup franc, hors-jeu)', () => {
    // Types 0 à 200 : un poids non nul hors de la table ferait mentir la légende.
    const pesés = Array.from({ length: 201 }, (_, t) => t).filter(
      (t) => scoreMessage({ type: t, comment: '' }) > 0,
    );
    expect(pesés).toEqual([2, 3, 9, 12, 14, 20, 21]);
  });
});

describe('applyMomentum — repli sur la réponse précédente (L274)', () => {
  const points = [
    { minute: 1, value: 40 },
    { minute: 2, value: -20 },
  ];
  const actions = { home: 44, away: 27, unattributed: 3 };

  it("momentum frais : points, comptes et sortes d'actions de cet appel", () => {
    const payload: Parameters<typeof applyMomentum>[0] = {};
    applyMomentum(
      payload,
      { points, actions },
      {
        momentum: [{ minute: 1, value: 99 }],
        momentumActions: { home: 1, away: 1, unattributed: 1 },
      },
    );
    expect(payload).toEqual({
      momentum: points,
      momentumActions: actions,
      momentumBasis: [...MOMENTUM_BASIS],
    });
  });

  it('play-by-play en échec : points ET comptes de la réponse précédente, repris ensemble', () => {
    const payload: Parameters<typeof applyMomentum>[0] = {};
    applyMomentum(payload, undefined, {
      momentum: points,
      momentumActions: actions,
    });
    expect(payload.momentum).toBe(points);
    expect(payload.momentumActions).toBe(actions);
    expect(payload.momentumBasis).toEqual([...MOMENTUM_BASIS]);
  });

  it('réponse précédente sans comptes (cache plus ancien) : les points seuls, aucune part inventée', () => {
    const payload: Parameters<typeof applyMomentum>[0] = {};
    applyMomentum(payload, undefined, { momentum: points });
    expect(payload.momentum).toBe(points);
    expect(payload.momentumActions).toBeUndefined();
  });

  it('ni frais ni précédent : pas de momentum du tout', () => {
    const payload: Parameters<typeof applyMomentum>[0] = {};
    applyMomentum(payload, undefined, undefined);
    applyMomentum(payload, undefined, { momentumActions: actions });
    expect(payload).toEqual({});
  });
});
