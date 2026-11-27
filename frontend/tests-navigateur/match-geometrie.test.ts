// L187 — géométrie de la page match (L186) mesurée dans Chromium : jsdom ne calcule aucune mise en page.
// Match des Bleus à 4 buteurs d'un côté, noms complets (France 5-1 Belgique : 5 buts, 4 buteurs ; le cas le plus haut mesuré par L189), API simulée au
// niveau du navigateur, serveur Vite démarré par le test.
import { appendFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright';
import { createServer, type ViteDevServer } from 'vite';
// L274 : réponse réelle du service pour Lyon 0-0 Lillestrøm (vérifiée égale au service côté backend).
import lillestrom from '../src/test/fixtures/live-match-lyon-lillestrom-L274.json';

const GAME_ID = 4672325;
const MATCHUP = `5061-2373-${GAME_ID}`;
const OL_ID = 465; // identifiant de l'OL chez 365scores (523 = football-data, que l'API du match n'envoie pas)

const goal = (competitorId: number, name: string, min: number, type = 'goal') => ({
  competitorId, gameTime: min, gameTimeDisplay: `${min}'`, type, isMajor: true, playerId: min, extraPlayerId: null,
  playerName: name, playerShortName: null, extraPlayerName: null, description: 'But',
});

const joueur = (id: number, name: string) => ({
  id, name, shortName: name, jerseyNumber: id, positionShort: 'MC', yardLine: 50, yardSide: 2, ranking: 7,
});

type Actions = { home: number; away: number; unattributed: number };
const TOUTES_ATTRIBUEES: Actions = { home: 40, away: 25, unattributed: 0 };
// L274 passe 3 : 27 actions sur 71 sans équipe (Lyon – Lillestrøm avant la correction des noms) : la note la plus longue.
const SANS_EQUIPE: Actions = { home: 44, away: 0, unattributed: 27 };

function stats(domicile = { id: 5061, name: 'France' }, visiteur = { id: 2373, name: 'Belgique' }, competition = { id: 7016, name: 'Ligue des nations' }, momentumActions = TOUTES_ATTRIBUEES) {
  const side = (id: number, name: string, symbolicName: string, score: number) => ({ id, name, symbolicName, imageVersion: 1, score });
  const lineup = (base: number) => ({
    formation: '4-3-3', starters: Array.from({ length: 11 }, (_, i) => joueur(base + i, `Joueur ${base + i}`)), bench: [],
  });
  return {
    gameId: GAME_ID, matchupId: MATCHUP, competitionId: competition.id, competitionName: competition.name, status: 'ended',
    statusGroup: 4, statusText: 'Terminé', gameTime: 90, gameTimeDisplay: "90'", startTime: '2026-10-05T20:45:00+02:00',
    timeConfirmed: true,
    home: side(domicile.id, domicile.name, 'FRA', 5),
    away: side(visiteur.id, visiteur.name, 'BEL', 1),
    teamStats: {
      home: { 'Touches': 58, 'Tirs au total': 16, 'Tirs cadrés': 8, 'Buts attendus': 2.9, 'Passes Completed': 512, 'Fautes faites': 9 },
      away: { 'Touches': 42, 'Tirs au total': 8, 'Tirs cadrés': 3, 'Buts attendus': 1.1, 'Passes Completed': 366, 'Fautes faites': 12 },
    },
    // 4 buteurs d'un côté, noms complets comme les envoie le backend (`playerName` = nom complet, le nom court va dans
    // `playerShortName`) : la liste passe sur deux lignes, c'est l'en-tête le plus haut, donc la pire mesure du pli
    // (bas de la rangée à 763 px à 1366 × 768, 772 px à 1440 × 900 : plus haut que les 748 px du vrai match, et à 5 px du pli).
    events: [
      goal(domicile.id, 'Kylian Mbappé', 12), goal(domicile.id, 'Ousmane Dembélé', 30), goal(domicile.id, 'Antoine Griezmann', 55),
      goal(domicile.id, 'Marcus Thuram', 80), goal(domicile.id, 'Kylian Mbappé', 85, 'penalty_goal'), goal(visiteur.id, 'Romelu Lukaku', 64),
    ],
    topPerformers: [{ role: 'Meilleur joueur', homePlayer: { id: 1, name: 'Mbappé', statValue: '8,9', statName: 'Note' }, awayPlayer: { id: 2, name: 'Lukaku', statValue: '7,1', statName: 'Note' } }],
    shots: Array.from({ length: 12 }, (_, i) => ({
      competitorId: i % 3 ? 5061 : 2373, playerId: i, time: `${i * 7 + 3}'`, xg: 0.05 * (i + 1), xgot: 0, bodyPart: 'Pied',
      outcome: i % 4 === 0 ? 'But' : 'Manqué', line: 20 + i * 5, side: 10 + i * 6,
    })),
    momentum: Array.from({ length: 90 }, (_, i) => ({ minute: i + 1, value: Math.round(Math.sin(i / 6) * 70) })),
    // L274 : phrase sous le graphe avec la liste de la table des poids du backend (`momentumBasis`). Aucune action
    // sans équipe ici ; le cas avec une note « actions sans équipe » est mesuré plus bas sur Lyon – Lillestrøm.
    momentumBasis: ['tirs', 'corners', 'coups francs obtenus', 'hors-jeu'],
    momentumActions,
    lineups: { home: lineup(100), away: lineup(200) },
    updatedAt: '2026-10-05T23:00:00Z',
  };
}

let serveur: ViteDevServer;
let navigateur: Browser;
let url: string;

beforeAll(async () => {
  serveur = await createServer({ configFile: new URL('../vite.config.ts', import.meta.url).pathname, server: { port: 0, host: '127.0.0.1' }, logLevel: 'silent' });
  await serveur.listen();
  url = `http://127.0.0.1:${(serveur.httpServer!.address() as { port: number }).port}`;
  navigateur = await chromium.launch();
});

afterAll(async () => {
  await navigateur?.close();
  await serveur?.close();
});

/** L265 : réponse de `/api/match-impact` (match de Ligue 1 de l'OL terminé), servie quand `libererImpact` est appelé. */
type Impact = { competition: { id: number; name: string }; corps: unknown; libererImpact?: Promise<void> };

async function ouvrir(
  largeur: number, hauteur: number,
  domicile?: { id: number; name: string }, visiteur?: { id: number; name: string }, matchup = MATCHUP, impact?: Impact,
  actions?: Actions,
): Promise<Page> {
  const page = await navigateur.newPage({ viewport: { width: largeur, height: hauteur }, timezoneId: 'Europe/Paris', locale: 'fr-FR' });
  await page.route('**/api/**', async (route) => {
    const u = route.request().url();
    if (u.includes(`/api/live-match/${GAME_ID}/stats`)) return route.fulfill({ json: stats(domicile, visiteur, impact?.competition, actions) });
    if (impact && u.includes('/api/match-impact?at=')) {
      await impact.libererImpact;
      return route.fulfill({ json: impact.corps });
    }
    return route.fulfill({ status: 404, json: {} });
  });
  // Écussons et polices distants : hors sujet, et ils ne doivent pas retarder la mesure.
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());
  await page.goto(`${url}/match/${GAME_ID}?matchupId=${matchup}`);
  await page.getByTestId('rangee-stats-elan').waitFor();
  await page.getByTestId('elan').waitFor();
  await page.evaluate(() => document.fonts.ready);
  return page;
}

/** Mesures relevées pour le rapport (`MESURES=<fichier>`) : la console de Vitest ne sort pas toujours. */
const mesure = (ligne: string) => {
  if (process.env.MESURES) appendFileSync(process.env.MESURES, `${ligne}\n`);
};

type Boite = { top: number; bottom: number; left: number; right: number; height: number };
const boite = (page: Page, testId: string): Promise<Boite> =>
  page.getByTestId(testId).evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { top: r.top + window.scrollY, bottom: r.bottom + window.scrollY, left: r.left, right: r.right, height: r.height };
  });

describe('jeu de test', () => {
  it('le score de chaque équipe est le nombre de ses buts dans les événements', () => {
    const { home, away, events } = stats();
    for (const equipe of [home, away]) {
      expect(events.filter((e) => e.competitorId === equipe.id).length).toBe(equipe.score);
    }
  });
});

const ECRANS = [[1366, 768], [1440, 900]] as const;

describe.each(ECRANS)('page match à %i × %i', (largeur, hauteur) => {
  let page: Page;
  beforeAll(async () => { page = await ouvrir(largeur, hauteur); });
  afterAll(async () => { await page?.close(); });

  it('R16 — le bas de la rangée Statistiques | Momentum est au-dessus du pli (4 buteurs d\'un côté)', async () => {
    // Le test ne vaut que sur un bloc Statistiques garni : les quatre mesures comparées sont affichées.
    await expect(page.getByTestId('message-stats-vide').count()).resolves.toBe(0);
    const rangee = await boite(page, 'rangee-stats-elan');
    expect(rangee.bottom).toBeLessThanOrEqual(hauteur);
  });

  it('R16 — avec des actions sans équipe (27 sur 71), la note ne fait pas passer la rangée sous le pli (L274)', async () => {
    // Avant la passe 3 de L274, la note allongeait la phrase sous le graphe d'une ligne : 781,5 px pour 768 à 1366 × 768.
    const avecNote = await ouvrir(largeur, hauteur, undefined, undefined, MATCHUP, undefined, SANS_EQUIPE);
    try {
      await avecNote.getByTestId('elan-non-attribuees').waitFor();
      const rangee = await boite(avecNote, 'rangee-stats-elan');
      mesure(`L274 4 buteurs ${largeur} × ${hauteur} sans équipe : bas de la rangée ${rangee.bottom.toFixed(1)} px`);
      expect(rangee.bottom).toBeLessThanOrEqual(hauteur);
    } finally {
      await avecNote.close();
    }
  });

  it('R16 — le tracé du Momentum mesure 96 px de haut', async () => {
    const trace = await page.getByRole('img', { name: 'Momentum' }).evaluate((el) => el.getBoundingClientRect().height);
    expect(trace).toBeCloseTo(96, 0);
  });

  it('R4 — 16 px entre deux rangées du centre, sans trou ni chevauchement', async () => {
    const rangees = await page.getByTestId('colonne-centre').evaluate((centre) =>
      Array.from(centre.children).map((c) => {
        const r = c.getBoundingClientRect();
        return { top: r.top, bottom: r.bottom };
      }),
    );
    expect(rangees.length).toBeGreaterThanOrEqual(3); // Faits, Statistiques | Momentum, Carte des tirs | pile
    for (let i = 1; i < rangees.length; i++) {
      expect(rangees[i].top - rangees[i - 1].bottom).toBeCloseTo(16, 0);
    }
  });
});

// L65 — à 320 px, le nom d'un club dans l'en-tête du score d'un match de l'OL n'est ni rogné ni débordant.
describe('en-tête du score d\'un match de l\'OL à 320 px', () => {
  const CAS: Array<[string, string]> = [
    ['Hoffenheim', 'Lyon'], ['Lyon', 'Crystal Palace'], ['Lillestrom', 'Lyon'], ['Sparta Prague', 'Lyon'],
  ];
  it.each(CAS)('R1 — %s – %s : chaque nom tient dans sa colonne, dans la carte (320 px)', async (dom, vis) => {
    const page = await ouvrir(320, 700, { id: dom === 'Lyon' ? OL_ID : 9001, name: dom }, { id: vis === 'Lyon' ? OL_ID : 9002, name: vis }, `${dom === 'Lyon' ? OL_ID : 9001}-${vis === 'Lyon' ? OL_ID : 9002}-${GAME_ID}`);
    try {
      const mesures = await page.getByTestId('entete-score').evaluate((carte) => {
        const r = carte.getBoundingClientRect();
        const noms = Array.from(carte.querySelectorAll<HTMLElement>('.font-display.font-bold.leading-none'));
        return noms.map((el) => {
          const b = el.getBoundingClientRect();
          return { texte: el.textContent, defile: el.scrollWidth - el.clientWidth, gauche: b.left - r.left, droite: r.right - b.right };
        });
      });
      expect(mesures.length).toBe(2);
      for (const m of mesures) {
        expect(m.defile, `${m.texte} déborde de sa colonne`).toBeLessThanOrEqual(0);
        expect(m.gauche, `${m.texte} dépasse à gauche`).toBeGreaterThanOrEqual(0);
        expect(m.droite, `${m.texte} dépasse à droite`).toBeGreaterThanOrEqual(0);
      }
    } finally { await page.close(); }
  });
});

// L65 — entre 360 et 599 px, un nom de club de l'OL se coupe à l'espace, jamais au milieu d'un mot (« Renne / s »).
describe.each([360, 390])('en-tête du score d\'un match de l\'OL à %i px', (largeur) => {
  const CAS: Array<[string, string]> = [
    ['Lyon', 'Rennes'], ['Lyon', 'Crystal Palace'], ['Olympique de Marseille', 'Lyon'],
    ['Hoffenheim', 'Lyon'], ['Lillestrom', 'Lyon'], ['Lyon', 'Bayer Leverkusen'],
  ];
  it.each(CAS)('R2 — %s – %s : aucun mot du nom n\'est coupé en son milieu', async (dom, vis) => {
    const page = await ouvrir(largeur, 700, { id: dom === 'Lyon' ? OL_ID : 9001, name: dom }, { id: vis === 'Lyon' ? OL_ID : 9002, name: vis }, `${dom === 'Lyon' ? OL_ID : 9001}-${vis === 'Lyon' ? OL_ID : 9002}-${GAME_ID}`);
    try {
      const coupes = await page.getByTestId('entete-score').evaluate((carte) => {
        const res: string[] = [];
        for (const el of Array.from(carte.querySelectorAll<HTMLElement>('.font-display.font-bold.leading-none'))) {
          const noeud = el.firstChild;
          if (!noeud || noeud.nodeType !== Node.TEXT_NODE) continue;
          const texte = noeud.textContent ?? '';
          for (const m of texte.matchAll(/\S+/g)) {
            const plage = document.createRange();
            plage.setStart(noeud, m.index!);
            plage.setEnd(noeud, m.index! + m[0].length);
            const lignes = new Set(Array.from(plage.getClientRects()).map((r) => Math.round(r.top)));
            if (lignes.size > 1) res.push(m[0]);
          }
        }
        return res;
      });
      expect(coupes, `mots coupés à ${largeur} px`).toEqual([]);
    } finally { await page.close(); }
  });
});

// L265 — « Ce que ça change » d'un match de Ligue 1 de l'OL terminé : rangée à part en bas du centre, sur toute sa
// largeur, sous la rangée Carte des tirs | pile (revue UX r1 : dans la pile de 264 px, 5 lignes et ~430 px vides sous la
// carte des tirs). Jamais entre l'en-tête et la grille (R16 : Statistiques | Momentum sous le pli à 1366 × 768, 852 px).
// La place réservée pendant le chargement couvre le bloc chargé, avec ou sans « Provisoire » : rien ne bouge de plus de 4 px.
const IMPACT = {
  matchday: 10, finished: true, homeTeam: 'Lyon', awayTeam: 'Belgique', score: { home: 5, away: 1 },
  before: { position: 3, points: 17 }, after: { position: 5, points: 17 },
  remaining: 1, remainingInMatchday: 1, above: { place: 3, gap: 3 }, below: { place: 5, margin: 0 }, updatedAt: '2026-10-05T22:00:00Z',
};
const IMPACT_COMPLET = { ...IMPACT, remaining: 0, remainingInMatchday: 0 };
const LIGUE_1 = { id: 35, name: 'Ligue 1' };

/** Positions (page) de ce qui entoure le bloc : au-dessus (rangée tirs | pile), dessous (bas de la grille, note des sources).
 *  La note des sources gagne la mention football-data à l'arrivée de la réponse : seul son HAUT est comparé (elle est la
 *  dernière de la page, ce qu'elle gagne en dessous ne pousse rien). */
const autour = async (page: Page) => ({
  bloc: await boite(page, 'ce-que-ca-change'),
  dessus: (await boite(page, 'rangee-tirs-joueurs')).top,
  sources: (await boite(page, 'sources-match')).top,
  grille: (await boite(page, 'grille-match')).bottom,
});

describe.each([...ECRANS, [390, 844]] as const)('match de Ligue 1 de l\'OL terminé, avec « Ce que ça change », à %i × %i', (largeur, hauteur) => {
  for (const [cas, corps, attendu] of [
    ['provisoire', IMPACT, 'ce-que-ca-change-provisoire'],
    ['journée complète', IMPACT_COMPLET, 'ce-que-ca-change-phrase'],
  ] as const) {
    describe(cas, () => {
      let page: Page;
      let pendant: Awaited<ReturnType<typeof autour>>;
      let apres: Awaited<ReturnType<typeof autour>>;
      beforeAll(async () => {
        let liberer!: () => void;
        const libererImpact = new Promise<void>((r) => { liberer = r; });
        page = await ouvrir(largeur, hauteur, { id: OL_ID, name: 'Lyon' }, { id: 2373, name: 'Belgique' }, `${OL_ID}-2373-${GAME_ID}`, { competition: LIGUE_1, corps, libererImpact });
        await page.getByTestId('ce-que-ca-change-chargement').waitFor();
        pendant = await autour(page);
        liberer();
        await page.getByTestId(attendu).waitFor();
        apres = await autour(page);
        if (process.env.CAPTURES_DIR && cas === 'provisoire') await page.screenshot({ path: `${process.env.CAPTURES_DIR}/L265-match-${largeur}.png`, fullPage: true });
      });
      afterAll(async () => { await page?.close(); });

      it('rangée à part, dernière du centre, sur toute sa largeur, sous la rangée Carte des tirs | pile', async () => {
        expect(await page.getByTestId('colonne-centre-bas').getByTestId('ce-que-ca-change').count()).toBe(0);
        const centre = await boite(page, 'colonne-centre');
        const rangee = await boite(page, 'rangee-tirs-joueurs');
        expect(apres.bloc.top).toBeGreaterThanOrEqual(rangee.bottom);
        expect(Math.abs(apres.bloc.left - centre.left)).toBeLessThanOrEqual(1);
        expect(Math.abs(apres.bloc.right - centre.right)).toBeLessThanOrEqual(1);
        if (largeur === 1440) expect(Math.round(apres.bloc.right - apres.bloc.left)).toBe(544);
      });

      it('R16 — le bas de la rangée Statistiques | Momentum reste au-dessus du pli', async () => {
        if (largeur < 1366) return; // R16 vaut pour l'écran de bureau
        const rangee = await boite(page, 'rangee-stats-elan');
        expect(rangee.bottom).toBeLessThanOrEqual(hauteur);
      });

      it('la place réservée couvre le bloc chargé : rien ne bouge de plus de 4 px à l\'arrivée de la réponse', () => {
        expect(Math.abs(apres.dessus - pendant.dessus)).toBeLessThanOrEqual(4);
        expect(Math.abs(apres.bloc.top - pendant.bloc.top)).toBeLessThanOrEqual(4);
        expect(Math.abs(apres.bloc.height - pendant.bloc.height)).toBeLessThanOrEqual(4);
        expect(Math.abs(apres.sources - pendant.sources)).toBeLessThanOrEqual(4);
        expect(Math.abs(apres.grille - pendant.grille)).toBeLessThanOrEqual(4);
        console.info(`L265 ${largeur} ${cas} : bloc ${pendant.bloc.height.toFixed(1)} → ${apres.bloc.height.toFixed(1)} px, sources ${pendant.sources.toFixed(1)} → ${apres.sources.toFixed(1)}`);
      });
    });
  }
});

// L274 passe 3 : Lyon – Lillestrøm, réponse réelle du service. Avec des actions sans équipe (27 sur 71, le compte du
// match avant la correction des noms), la phrase sous le graphe passait à 3 lignes et la rangée Statistiques | Momentum
// descendait à 781,5 px pour 768 à 1366 × 768 (mesuré le 27-11) : R16 l'interdit.
async function ouvrirLillestrom(largeur: number, hauteur: number, actions: Actions): Promise<Page> {
  const page = await navigateur.newPage({ viewport: { width: largeur, height: hauteur }, timezoneId: 'Europe/Paris', locale: 'fr-FR' });
  await page.route('**/api/**', (route) =>
    route.request().url().includes(`/api/live-match/${lillestrom.gameId}/stats`)
      ? route.fulfill({ json: { ...lillestrom, momentumActions: actions } })
      : route.fulfill({ status: 404, json: {} }));
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());
  await page.goto(`${url}/match/${lillestrom.gameId}?matchupId=${lillestrom.matchupId}`);
  await page.getByTestId('rangee-stats-elan').waitFor();
  await page.getByTestId('elan').waitFor();
  await page.evaluate(() => document.fonts.ready);
  return page;
}

describe.each([...ECRANS, [390, 844]] as const)('Lyon – Lillestrøm, Momentum avec et sans actions sans équipe, à %i × %i', (largeur, hauteur) => {
  for (const [cas, actions] of [
    ['27 actions sur 71 sans équipe', SANS_EQUIPE],
    ['toutes attribuées', lillestrom.momentumActions],
  ] as const) {
    it(`R16 — ${cas} : le bas de la rangée Statistiques | Momentum est au-dessus du pli`, async () => {
      const page = await ouvrirLillestrom(largeur, hauteur, actions);
      try {
        if (actions.unattributed > 0) await page.getByTestId('elan-non-attribuees').waitFor();
        else expect(await page.getByTestId('elan-non-attribuees').count()).toBe(0);
        const rangee = await boite(page, 'rangee-stats-elan');
        const elan = await boite(page, 'elan');
        mesure(`L274 Lyon – Lillestrøm ${largeur} × ${hauteur} ${cas} : rangée ${rangee.top.toFixed(1)} → ${rangee.bottom.toFixed(1)} px (${rangee.height.toFixed(1)}), Momentum ${elan.height.toFixed(1)} px`);
        if (process.env.CAPTURES_DIR) {
          await page.getByTestId('rangee-stats-elan').screenshot({ path: `${process.env.CAPTURES_DIR}/L274-elan-${largeur}-${actions.unattributed}.png` });
        }
        if (largeur >= 1366) expect(rangee.bottom).toBeLessThanOrEqual(hauteur); // R16 vaut pour l'écran de bureau
      } finally {
        await page.close();
      }
    });
  }
});
