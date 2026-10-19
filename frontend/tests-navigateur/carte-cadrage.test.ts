// L192 — cadrage de la carte L1 mesuré dans Chromium : jsdom n'anime ni ne met en page, et c'est l'animation d'un
// zoom minimal posé avant le cadrage qui l'avait décalé de 35 px vers le nord (Marseille collé au bord bas).
// API et tuiles refusées (la carte se cadre sans elles), serveur Vite démarré par le test.
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

async function ouvrir(largeur: number, hauteur: number): Promise<Page> {
  const page = await navigateur.newPage({ viewport: { width: largeur, height: hauteur }, timezoneId: 'Europe/Paris', locale: 'fr-FR' });
  await page.route('**/api/**', (route) => route.fulfill({ status: 503, json: {} }));
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());
  await page.goto(`${url}/map`);
  await page.waitForSelector('.ligue1-map-marker');
  await page.waitForTimeout(500);
  return page;
}

/** Marges (px) entre les 18 marqueurs et les bords de la carte. */
async function marges(page: Page) {
  return page.evaluate(() => {
    const c = document.querySelector('.leaflet-container')!.getBoundingClientRect();
    const r = [...document.querySelectorAll('.ligue1-map-marker')].map((e) => e.getBoundingClientRect());
    return {
      n: r.length,
      haut: Math.min(...r.map((x) => x.top)) - c.top,
      bas: c.bottom - Math.max(...r.map((x) => x.bottom)),
      gauche: Math.min(...r.map((x) => x.left)) - c.left,
      droite: c.right - Math.max(...r.map((x) => x.right)),
    };
  });
}

describe.each([[1440, 900], [768, 900], [390, 844], [320, 700]])('Carte L1 à %i×%i (L192)', (largeur, hauteur) => {
  it('R1 — les 18 marqueurs entiers dans la carte, centrés (écart haut/bas et gauche/droite ≤ 2 px)', async () => {
    const page = await ouvrir(largeur, hauteur);
    const m = await marges(page);
    await page.close();
    expect(m.n).toBe(18);
    for (const marge of [m.haut, m.bas, m.gauche, m.droite]) expect(marge).toBeGreaterThanOrEqual(8);
    expect(Math.abs(m.haut - m.bas)).toBeLessThanOrEqual(2);
    expect(Math.abs(m.gauche - m.droite)).toBeLessThanOrEqual(2);
  });

  it('R8 — la molette défile la page sans zoomer ; Recentrer ramène la vue d’ouverture', async () => {
    const page = await ouvrir(largeur, hauteur);
    const avant = await marges(page);
    const boite = (await page.locator('.leaflet-container').boundingBox())!;
    await page.mouse.move(boite.x + 80, Math.max(boite.y, 0) + 80);
    await page.mouse.wheel(0, -300);
    await page.waitForTimeout(500);
    expect(await marges(page)).toEqual(avant);

    await page.getByRole('button', { name: 'Zoom in' }).click();
    await page.waitForTimeout(500);
    expect((await marges(page)).haut).not.toBeCloseTo(avant.haut, 0);
    await page.getByRole('button', { name: 'Recentrer' }).click();
    await page.waitForTimeout(800);
    const apres = await marges(page);
    await page.close();
    for (const k of ['haut', 'bas', 'gauche', 'droite'] as const) expect(apres[k]).toBeCloseTo(avant[k], 0);
  });

  it('R10 — après plusieurs + puis Recentrer, − est grisé et un + ne gagne qu’un cran', async () => {
    const page = await ouvrir(largeur, hauteur);
    const plus = page.getByRole('button', { name: 'Zoom in' });
    const moins = page.getByRole('button', { name: 'Zoom out' });
    for (let i = 0; i < 4; i++) {
      await plus.click();
      await page.waitForTimeout(300);
    }
    await page.getByRole('button', { name: 'Recentrer' }).click();
    await page.waitForTimeout(800);
    const grise = await moins.evaluate((b) => b.classList.contains('leaflet-disabled'));
    const avant = await marges(page);
    await plus.click();
    await page.waitForTimeout(500);
    const apres = await marges(page);
    await page.close();
    expect(grise).toBe(true);
    // Un cran de zoom (×2) écarte les marqueurs : la marge haute n'est plus celle du cadrage, sans les envoyer à Lyon (zoom +4).
    expect(apres.haut).toBeLessThan(avant.haut);
    expect(apres.haut).toBeGreaterThan(-avant.haut * 4);
  });
});
