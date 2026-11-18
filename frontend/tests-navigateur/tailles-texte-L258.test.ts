// L258 — tailles de texte en rem, 12 px minimum (revue UX L255, M3), mesurées dans Chromium (jsdom ne calcule ni police ni boîte).
// Pastilles de forme V/N/D de l'accueil, notes des joueurs sur le terrain de /players, noms de la composition de /match à 320 px,
// et preuve que les tailles suivent la taille de police de la racine (rem, pas px). API simulée, serveur Vite démarré par le test.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright';
import { createServer, type ViteDevServer } from 'vite';

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

const CLASSEMENT = {
  currentMatchday: 10,
  table: [{
    position: 5, team: 'Olympique Lyonnais', teamId: 523, played: 10, won: 5, draw: 2, lost: 3,
    goalsFor: 14, goalsAgainst: 11, goalDifference: 3, points: 17, recentForm: ['L', 'W', 'D', 'W', 'L'],
  }],
};

const joueurTerrain = (n: number, shortName: string, yardLine: number, yardSide: number, ranking: number) => ({
  id: n, athleteId: 100 + n, name: shortName, shortName, jerseyNumber: n, position: 'Milieu', positionShort: 'M',
  yardLine, yardSide, ranking, isStarting: true,
});
const COMPO_JOUEURS = {
  gameId: 1, date: '2026-10-10T19:00:00Z', competition: 'Ligue 1', matchday: 8, opponent: 'Lens', opponentId: 7,
  isHome: true, homeScore: 2, awayScore: 1, formation: '4-3-3', bench: [], injured: [],
  starters: [
    joueurTerrain(1, 'Lucas Perri', 1, 50, 6.2),
    joueurTerrain(2, 'Z. Athekame', 2, 10, 5.8), joueurTerrain(3, 'Niakhaté', 2, 36, 7.4), joueurTerrain(4, 'Tagliafico', 2, 64, 10),
    joueurTerrain(5, 'Maitland-Niles', 2, 90, 6.9),
    joueurTerrain(6, 'Tolisso', 3, 15, 8.1), joueurTerrain(7, 'Caqueret', 3, 50, 4.6), joueurTerrain(8, 'Nuamah', 3, 85, 7),
    joueurTerrain(9, 'Fofana', 5, 12, 6.6), joueurTerrain(10, 'Lacazette', 5, 50, 7.7), joueurTerrain(11, 'Cherki', 5, 88, 8.8),
  ],
};

async function ouvrir(largeur: number, chemin: string, routes: (u: string) => unknown | undefined): Promise<Page> {
  const page = await navigateur.newPage({ viewport: { width: largeur, height: 900 }, timezoneId: 'Europe/Paris', locale: 'fr-FR' });
  await page.route('**/api/**', (route) => {
    const corps = routes(route.request().url());
    return corps === undefined ? route.fulfill({ status: 404, json: {} }) : route.fulfill({ status: 200, json: corps });
  });
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());
  await page.goto(`${url}${chemin}`);
  return page;
}

/** Taille de police, boîte de la pastille et boîte réelle du texte (Range), pour chaque élément du sélecteur. */
const mesurerPastilles = (page: Page, selecteur: string) =>
  page.$$eval(selecteur, (els) => els.map((el) => {
    const b = el.getBoundingClientRect();
    const plage = document.createRange();
    plage.selectNodeContents(el);
    const t = plage.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return {
      texte: el.textContent, police: parseFloat(cs.fontSize), largeur: b.width, hauteur: b.height,
      margeG: t.left - b.left - parseFloat(cs.borderLeftWidth), margeD: b.right - t.right - parseFloat(cs.borderRightWidth),
    };
  }));

describe.each([390, 1440])('L258 à %i px', (largeur) => {
  it('accueil : lettres V / N / D à 12 px dans un rond d’au moins 20 px, sans toucher le bord', async () => {
    const page = await ouvrir(largeur, '/', (u) => (/\/api\/standings(\?|$)/.test(u) ? CLASSEMENT : u.includes('/api/season-matches') && !u.includes('team-stats') ? [] : undefined));
    try {
      await page.getByTestId('stat-forme').locator('span[role="img"]').first().waitFor();
      const pastilles = await mesurerPastilles(page, '[data-testid="stat-forme"] span[role="img"]');
      expect(pastilles.map((p) => p.texte)).toEqual(['D', 'V', 'N', 'V', 'D']);
      for (const p of pastilles) {
        expect(p.police, p.texte!).toBeGreaterThanOrEqual(12);
        expect(Math.min(p.largeur, p.hauteur), p.texte!).toBeGreaterThanOrEqual(20);
        expect(Math.min(p.margeG, p.margeD), p.texte!).toBeGreaterThanOrEqual(2);
      }
    } finally { await page.close(); }
  });

  it('/players : notes des joueurs à 12 px, chiffre à au moins 2 px du bord de sa pastille', async () => {
    const page = await ouvrir(largeur, '/players', (u) => (u.includes('/api/lineup') ? COMPO_JOUEURS : undefined));
    try {
      await page.locator('[data-testid="pastille-note"]').first().waitFor();
      const notes = await mesurerPastilles(page, '[data-testid="pastille-note"]');
      expect(notes).toHaveLength(11);
      for (const n of notes) {
        expect(n.police, n.texte!).toBeGreaterThanOrEqual(12);
        expect(n.hauteur, n.texte!).toBeGreaterThanOrEqual(20);
        expect(Math.min(n.margeG, n.margeD), n.texte!).toBeGreaterThanOrEqual(2);
      }
      // Les noms du terrain aussi à 12 px.
      const noms = await page.$$eval('[data-testid="nom-joueur"]', (els) => els.map((e) => parseFloat(getComputedStyle(e).fontSize)));
      expect(Math.min(...noms)).toBeGreaterThanOrEqual(12);
    } finally { await page.close(); }
  });

  it('aucun texte visible sous 12 px sur l’accueil et /players', async () => {
    for (const [chemin, routes] of [
      ['/', (u: string) => (/\/api\/standings(\?|$)/.test(u) ? CLASSEMENT : u.includes('/api/season-matches') && !u.includes('team-stats') ? [] : undefined)],
      ['/players', (u: string) => (u.includes('/api/lineup') ? COMPO_JOUEURS : undefined)],
    ] as const) {
      const page = await ouvrir(largeur, chemin, routes);
      try {
        await page.waitForLoadState('networkidle');
        const petits = await page.evaluate(() => [...document.querySelectorAll('body *')]
          .filter((e) => [...e.childNodes].some((c) => c.nodeType === 3 && c.textContent!.trim()))
          .filter((e) => { const r = e.getBoundingClientRect(); return r.width > 1 && r.height > 1 && getComputedStyle(e).visibility !== 'hidden'; })
          .filter((e) => parseFloat(getComputedStyle(e).fontSize) < 12)
          .map((e) => `${e.textContent!.trim().slice(0, 30)} (${getComputedStyle(e).fontSize})`));
        expect(petits, chemin).toEqual([]);
      } finally { await page.close(); }
    }
  });
});

it('L258 — les tailles suivent la racine (rem) : racine à 20 px → lettres de forme à 15 px', async () => {
  const page = await ouvrir(390, '/', (u) => (/\/api\/standings(\?|$)/.test(u) ? CLASSEMENT : undefined));
  try {
    await page.getByTestId('stat-forme').locator('span[role="img"]').first().waitFor();
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).fontSize)).toBe('16px'); // racine à 100 %
    await page.addStyleTag({ content: 'html { font-size: 20px !important; }' });
    const [p] = await mesurerPastilles(page, '[data-testid="stat-forme"] span[role="img"]');
    expect(p.police).toBe(15);
    expect(p.largeur).toBe(25);
  } finally { await page.close(); }
});

// Composition de la page match : les 7 noms de la QA du 12-10 dans des pastilles de largeur fixe, à 320 px.
const GAME_ID = 4672325;
const joueurCompo = (id: number, name: string, yardLine: number, yardSide: number) => ({
  id, name, shortName: name, jerseyNumber: id, positionShort: 'MC', yardLine, yardSide, ranking: 7,
});
const NOMS_QA = ['Frankowski', 'Omobamidele', 'Augustinsson', 'Coosemans', 'Thomasson', 'Greenwood', 'Guendouzi'];
const compo = (base: number) => ({
  formation: '4-1-4-1',
  starters: [
    joueurCompo(base, 'Samba', 1, 50),
    joueurCompo(base + 1, NOMS_QA[0], 2, 10), joueurCompo(base + 2, NOMS_QA[1], 2, 35), joueurCompo(base + 3, NOMS_QA[2], 2, 65), joueurCompo(base + 4, 'Diop', 2, 90),
    joueurCompo(base + 5, NOMS_QA[3], 3, 50),
    joueurCompo(base + 6, NOMS_QA[4], 4, 10), joueurCompo(base + 7, NOMS_QA[5], 4, 35), joueurCompo(base + 8, NOMS_QA[6], 4, 65), joueurCompo(base + 9, 'Mata', 4, 90),
    joueurCompo(base + 10, 'Kalimuendo', 5, 50),
  ],
  bench: [],
});
const STATS = {
  gameId: GAME_ID, matchupId: `465-2373-${GAME_ID}`, competitionId: 35, competitionName: 'Ligue 1', status: 'ended',
  statusGroup: 4, statusText: 'Terminé', gameTime: 90, gameTimeDisplay: "90'", startTime: '2026-10-05T20:45:00+02:00', timeConfirmed: true,
  home: { id: 465, name: 'Lyon', symbolicName: 'OL', imageVersion: 1, score: 2 },
  away: { id: 2373, name: 'Lens', symbolicName: 'RCL', imageVersion: 1, score: 1 },
  teamStats: { home: {}, away: {} }, events: [], topPerformers: [], shots: [], momentum: [],
  lineups: { home: compo(100), away: compo(200) }, updatedAt: '2026-10-05T23:00:00Z',
};

it('L258 — /match à 320 px : noms de la composition à 12 px, réduits à la mesure (exception, plancher 8 px) seulement s’ils ne tiennent pas, jamais coupés', async () => {
  const page = await ouvrir(320, `/match/${GAME_ID}?matchupId=465-2373-${GAME_ID}`, (u) => (u.includes(`/api/live-match/${GAME_ID}/stats`) ? STATS : undefined));
  try {
    await page.getByTestId('bloc-composition').first().waitFor();
    await page.evaluate(() => document.fonts.ready);
    const noms = await page.$$eval('[data-testid="bloc-composition"] [data-testid="rangee-composition"] > span > span:last-child', (els) => els.map((e) => {
      const pastille = e.parentElement!;
      const cs = getComputedStyle(pastille);
      const place = pastille.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      return { nom: e.textContent!, police: parseFloat(getComputedStyle(e).fontSize), largeur: e.scrollWidth, place };
    }));
    expect(noms.length).toBe(22);
    for (const n of noms) {
      // Tient, ou est au plancher (8 px) : hors réseau la police Inter n'est pas chargée, la police de repli est plus large
      // et « Omobamidele » y déborde même à 8 px (comme avant L258, plancher inchangé).
      if (n.largeur > n.place + 0.5) expect(n.police, `${n.nom} ne tient pas : au plancher`).toBe(8);
      expect(n.police, n.nom).toBeGreaterThanOrEqual(8);
      // Pas plus petit que nécessaire : un demi-pixel de plus ne tiendrait pas.
      if (n.police < 12) expect(n.largeur * (n.police + 0.5) / n.police, n.nom).toBeGreaterThan(n.place - 0.5);
      if (n.nom.length <= 6) expect(n.police, n.nom).toBe(12); // un nom qui tient garde 12 px
    }
  } finally { await page.close(); }
});

// L258 (captures du lead à 390 px) — la note agrandie (12 px, pastille de 20 px) posée à cheval sur le rond recouvrait le
// second chiffre des numéros à deux chiffres (« 19 », « 13 »). Composition réelle du 08-11 (Brest – OL, 4-3-3), numéros
// et notes de la capture ; « 10 » ajouté pour la note la plus large.
const terrainReel = (n: number, nom: string, yardLine: number, yardSide: number, ranking: number) => ({ ...joueurTerrain(n, nom, yardLine, yardSide, ranking), id: 1000 + n });
const COMPO_REELLE = {
  ...COMPO_JOUEURS,
  starters: [
    terrainReel(1, 'Greif', 1, 50, 4.9),
    terrainReel(3, 'Abner', 2, 10, 6.6), terrainReel(19, 'Niakhaté', 2, 36, 5.9), terrainReel(21, 'Mata', 2, 64, 6.7), terrainReel(13, 'Maitland-Niles', 2, 90, 5.2),
    terrainReel(8, 'Tolisso', 3, 15, 6.2), terrainReel(6, 'Tessmann', 3, 50, 6.6), terrainReel(99, 'N. Nartey', 3, 85, 10),
    terrainReel(11, 'Nakamura', 5, 12, 7.1), terrainReel(18, 'Merah', 5, 50, 6.2), terrainReel(26, 'Boudache', 5, 88, 5.8),
  ],
};

describe.each([320, 360, 390, 1440])('L258 — /players à %i px : la note ne recouvre aucun numéro, aucun rond voisin, aucun nom', (largeur) => {
  it('pastilles de note, numéros, ronds et noms disjoints, notes dans le terrain', async () => {
    const page = await ouvrir(largeur, '/players', (u) => (u.includes('/api/lineup') ? COMPO_REELLE : undefined));
    try {
      await page.locator('[data-testid="pastille-note"]').first().waitFor();
      await page.evaluate(() => document.fonts.ready);
      const m = await page.evaluate(() => {
        const boite = (r: DOMRect) => ({ l: r.left, r: r.right, t: r.top, b: r.bottom });
        const joueurs = [...document.querySelectorAll('[data-testid="joueur"]')].map((j) => {
          const rond = j.querySelector('[data-testid="rond-joueur"]')!;
          // Encre des chiffres (measureText), pas la boîte de la police, qui garde au-dessus des chiffres la place des
          // capitales accentuées : la note peut couvrir le haut vide du rond, jamais un chiffre.
          const span = rond.querySelector('span')!;
          const plage = document.createRange();
          plage.selectNodeContents(span);
          const p = plage.getBoundingClientRect();
          const cs = getComputedStyle(span);
          const ctx = document.createElement('canvas').getContext('2d')!;
          ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
          const t = ctx.measureText(span.textContent!);
          const encre = {
            l: p.left - t.actualBoundingBoxLeft, r: p.left + t.actualBoundingBoxRight,
            t: p.top + t.fontBoundingBoxAscent - t.actualBoundingBoxAscent, b: p.top + t.fontBoundingBoxAscent + t.actualBoundingBoxDescent,
          };
          const note = j.querySelector('[data-testid="pastille-note"]')!;
          return {
            numero: rond.textContent!.replace(note.textContent!, ''),
            rond: boite(rond.getBoundingClientRect()),
            chiffres: encre,
            note: boite(note.getBoundingClientRect()),
            nom: boite(j.querySelector('[data-testid="nom-joueur"]')!.getBoundingClientRect()),
          };
        });
        const terrain = boite(document.querySelector('[data-testid="joueur"]')!.parentElement!.getBoundingClientRect());
        return { joueurs, terrain };
      });
      type B = { l: number; r: number; t: number; b: number };
      const recouvre = (a: B, b: B) => Math.min(a.r, b.r) - Math.max(a.l, b.l) > 0.5 && Math.min(a.b, b.b) - Math.max(a.t, b.t) > 0.5;
      expect(m.joueurs).toHaveLength(11);
      const fautes: string[] = [];
      for (const j of m.joueurs) {
        for (const k of m.joueurs) {
          if (recouvre(j.note, k.chiffres)) fautes.push(`note de ${j.numero} sur le numéro ${k.numero}`);
          if (k !== j && recouvre(j.note, k.rond)) fautes.push(`note de ${j.numero} sur le rond ${k.numero}`);
          if (recouvre(j.note, k.nom)) fautes.push(`note de ${j.numero} sur le nom de ${k.numero}`);
          if (k !== j && recouvre(j.note, k.note)) fautes.push(`note de ${j.numero} sur la note de ${k.numero}`);
        }
        const t = m.terrain;
        if (j.note.l < t.l || j.note.r > t.r || j.note.t < t.t || j.note.b > t.b) fautes.push(`note de ${j.numero} hors du terrain`);
      }
      expect(fautes).toEqual([]);
    } finally { await page.close(); }
  });
});
