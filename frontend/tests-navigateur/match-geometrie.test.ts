// L187 — géométrie de la page match (L186) mesurée dans Chromium : jsdom ne calcule aucune mise en page.
// Match des Bleus à 4 buteurs d'un côté, noms complets (France 5-1 Belgique : 5 buts, 4 buteurs ; le cas le plus haut mesuré par L189), API simulée au
// niveau du navigateur, serveur Vite démarré par le test.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright';
import { createServer, type ViteDevServer } from 'vite';

const GAME_ID = 4672325;
const MATCHUP = `5061-2373-${GAME_ID}`;

const goal = (competitorId: number, name: string, min: number, type = 'goal') => ({
  competitorId, gameTime: min, gameTimeDisplay: `${min}'`, type, isMajor: true, playerId: min, extraPlayerId: null,
  playerName: name, playerShortName: null, extraPlayerName: null, description: 'But',
});

const joueur = (id: number, name: string) => ({
  id, name, shortName: name, jerseyNumber: id, positionShort: 'MC', yardLine: 50, yardSide: 2, ranking: 7,
});

function stats(domicile = { id: 5061, name: 'France' }, visiteur = { id: 2373, name: 'Belgique' }) {
  const side = (id: number, name: string, symbolicName: string, score: number) => ({ id, name, symbolicName, imageVersion: 1, score });
  const lineup = (base: number) => ({
    formation: '4-3-3', starters: Array.from({ length: 11 }, (_, i) => joueur(base + i, `Joueur ${base + i}`)), bench: [],
  });
  return {
    gameId: GAME_ID, matchupId: MATCHUP, competitionId: 7016, competitionName: 'Ligue des nations', status: 'ended',
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

async function ouvrir(
  largeur: number, hauteur: number,
  domicile?: { id: number; name: string }, visiteur?: { id: number; name: string }, matchup = MATCHUP,
): Promise<Page> {
  const page = await navigateur.newPage({ viewport: { width: largeur, height: hauteur }, timezoneId: 'Europe/Paris', locale: 'fr-FR' });
  await page.route('**/api/**', (route) => {
    const u = route.request().url();
    if (u.includes(`/api/live-match/${GAME_ID}/stats`)) return route.fulfill({ json: stats(domicile, visiteur) });
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
  const CAS: Array<[string, string, string]> = [
    ['Hoffenheim', 'Lyon', 'domicile'], ['Lyon', 'Crystal Palace', 'visiteur'], ['Lillestrom', 'Lyon', 'domicile'], ['Sparta Prague', 'Lyon', 'domicile'],
  ];
  it.each(CAS)('R1 — %s – %s : chaque nom tient dans sa colonne, dans la carte (320 px)', async (dom, vis) => {
    const page = await ouvrir(320, 700, { id: dom === 'Lyon' ? 523 : 9001, name: dom }, { id: vis === 'Lyon' ? 523 : 9002, name: vis }, `523-9002-${GAME_ID}`);
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
