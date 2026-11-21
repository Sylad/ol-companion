// L259 — /standings au téléphone (revue UX L255, M4) : à 320 px le tableau commençait à y = 776, sous la barre du
// bas, et Lyon était à y = 1014 ; le H2 « Tracker de classement » venait avant le H1 « Classement ».
// Mesure dans Chromium (jsdom ne mesure rien) :
//  - la première ligne du classement est entière au premier écran, au-dessus de la barre du bas (320, 390) ;
//  - Lyon 5e : sa ligne est au premier écran ; Lyon 17e : le lien « Voir l'OL » l'amène à l'écran,
//    sous l'en-tête collant, sans autre défilement ;
//  - ordre des titres : le H1 « Classement » vient avant tout H2 (WCAG 1.3.1 / 2.4.6), à toute largeur ;
//  - au bureau (1440), le tableau et le tracker restent sur la page, le premier au-dessus du second.
// Avec CAPTURES_DIR, enregistre le premier écran (CAPTURES_NOM : « avant » / « apres »).
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

const CLUBS = [
  [480, 'Paris Saint-Germain'], [1655, 'Olympique de Marseille'], [470, 'AS Monaco'], [469, 'LOSC Lille'],
  [523, 'Olympique Lyonnais'], [474, 'Racing Club de Lens'], [476, 'OGC Nice'], [477, 'Stade Rennais FC'],
  [478, 'Stade Brestois 29'], [479, 'RC Strasbourg Alsace'], [481, 'FC Nantes'], [482, 'Toulouse FC'],
  [483, 'AJ Auxerre'], [484, 'Angers SCO'], [485, 'Le Havre AC'], [486, 'FC Lorient'], [487, 'Paris FC'], [488, 'FC Metz'],
] as const;

/** 18 clubs, Lyon à la place `rangOL`. */
function classement(rangOL: number) {
  const autres = CLUBS.filter(([id]) => id !== 523);
  const ordre = [...autres.slice(0, rangOL - 1), CLUBS[4], ...autres.slice(rangOL - 1)];
  return {
    currentMatchday: 10,
    updatedAt: new Date().toISOString(),
    table: ordre.map(([teamId, team], i) => ({
      position: i + 1, team, teamId, played: 10, won: 9 - Math.floor(i / 2), draw: 1, lost: Math.floor(i / 2),
      goalsFor: 20 - i, goalsAgainst: 5 + i, goalDifference: 15 - 2 * i, points: 28 - 2 * i,
      recentForm: ['W', 'L', 'D', 'W', 'W'],
    })),
  };
}

const EVOLUTION = Array.from({ length: 10 }, (_, i) => ({ matchday: i + 1, position: 5 + (i % 3), points: 2 * i + 1 }));

async function ouvrir(largeur: number, hauteur: number, rangOL: number): Promise<Page> {
  const page = await navigateur.newPage({ viewport: { width: largeur, height: hauteur }, timezoneId: 'Europe/Paris', locale: 'fr-FR' });
  await page.route('**/api/**', (route) => {
    const u = route.request().url();
    if (u.includes('/api/standings/season-rankings')) return route.fulfill({ status: 200, json: EVOLUTION });
    if (/\/api\/standings(\?|$)/.test(u)) return route.fulfill({ status: 200, json: classement(rangOL) });
    if (u.includes('/api/season-matches')) return route.fulfill({ status: 200, json: [] });
    return route.fulfill({ status: 404, json: {} });
  });
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());
  await page.goto(`${url}/standings`);
  await page.locator('tbody tr').first().waitFor();
  // Le tracker (graphique) se charge à part : on attend qu'il soit dessiné pour mesurer la page finale.
  await page.locator('.recharts-surface').first().waitFor();
  return page;
}

/** Bas de la zone visible : le haut de la barre du bas si elle est affichée, sinon la hauteur de la fenêtre. */
async function basVisible(page: Page): Promise<number> {
  return page.evaluate(() => {
    const nav = document.querySelector('nav[aria-label="Navigation principale"]');
    const b = nav?.getBoundingClientRect();
    return b && b.height > 0 && getComputedStyle(nav!).display !== 'none' ? b.top : window.innerHeight;
  });
}

async function ligne(page: Page, texte: string) {
  return page.locator('tbody tr', { hasText: texte }).first().evaluate((tr) => {
    const b = tr.getBoundingClientRect();
    return { haut: b.top, bas: b.bottom };
  });
}

const capture = async (page: Page, nom: string) => {
  const dossier = process.env.CAPTURES_DIR;
  if (dossier) await page.screenshot({ path: `${dossier}/L259-${nom}-${process.env.CAPTURES_NOM ?? 'apres'}.png` });
};

describe.each([[320, 800], [390, 844]])('/standings au téléphone, %i × %i', (largeur, hauteur) => {
  it('L259 — la première ligne et la ligne de Lyon (5e) sont au premier écran, au-dessus de la barre du bas', async () => {
    const page = await ouvrir(largeur, hauteur, 5);
    try {
      await capture(page, `premier-ecran-${largeur}`);
      expect(await page.evaluate(() => window.scrollY)).toBe(0);
      const bas = await basVisible(page);
      const premiere = await ligne(page, 'Paris Saint-Germain');
      expect(premiere.bas, `1re ligne à y = ${premiere.haut}, bas visible ${bas}`).toBeLessThanOrEqual(bas);
      const lyon = await ligne(page, 'Olympique Lyonnais');
      expect(lyon.bas, `Lyon à y = ${lyon.haut}, bas visible ${bas}`).toBeLessThanOrEqual(bas);
    } finally {
      await page.close();
    }
  });

  it('L259 — Lyon 17e : le lien « Voir l\'OL » l\'amène à l\'écran, sous l\'en-tête collant', async () => {
    const page = await ouvrir(largeur, hauteur, 17);
    try {
      const lien = page.getByRole('link', { name: /^Voir l'OL/ });
      const boite = await lien.boundingBox();
      expect(boite, 'lien visible').not.toBeNull();
      expect(boite!.y + boite!.height).toBeLessThanOrEqual(await basVisible(page));
      expect(boite!.height).toBeGreaterThanOrEqual(24); // WCAG 2.5.8
      await lien.click();
      await page.waitForFunction(() => window.scrollY > 0);
      await page.waitForTimeout(400); // défilement doux éventuel
      await capture(page, `lyon-17e-apres-lien-${largeur}`);
      const lyon = await ligne(page, 'Olympique Lyonnais');
      const entete = await page.locator('thead th').first().evaluate((th) => th.getBoundingClientRect().bottom);
      expect(lyon.haut, 'Lyon sous l\'en-tête collant').toBeGreaterThanOrEqual(entete - 0.5);
      expect(lyon.bas).toBeLessThanOrEqual(await basVisible(page));
      // Le focus suit (clavier, lecteur d'écran).
      expect(await page.evaluate(() => document.activeElement?.closest('tr')?.textContent ?? '')).toContain('Olympique Lyonnais');
    } finally {
      await page.close();
    }
  });
});

describe.each([320, 390, 1440])('/standings à %i px', (largeur) => {
  it('L259 — le H1 « Classement » vient avant tout autre titre ; le tableau précède le tracker', async () => {
    const page = await ouvrir(largeur, 900, 5);
    try {
      if (largeur === 1440) await capture(page, 'bureau-1440');
      const titres = await page.locator('main h1, main h2, main h3').evaluateAll((els) =>
        els.map((e) => ({ niveau: Number(e.tagName[1]), texte: e.textContent?.trim() })));
      expect(titres[0]).toEqual({ niveau: 1, texte: 'Classement' });
      for (let i = 1; i < titres.length; i++)
        expect(titres[i].niveau - titres[i - 1].niveau, `saut de niveau avant « ${titres[i].texte} »`).toBeLessThanOrEqual(1);
      expect(titres.some((t) => t.texte === 'Évolution du classement')).toBe(true);
      const hautTableau = await page.locator('table').first().evaluate((t) => t.getBoundingClientRect().top);
      const hautTracker = await page.getByRole('heading', { name: 'Évolution du classement' }).evaluate((h) => h.getBoundingClientRect().top);
      expect(hautTableau).toBeLessThan(hautTracker);
    } finally {
      await page.close();
    }
  });
});
