// L192 — cadrage de la carte L1 mesuré dans Chromium : jsdom n’anime ni ne met en page, et c’est l’animation d’un
// zoom minimal posé avant le cadrage qui l’avait décalé de 35 px vers le nord (Marseille collé au bord bas) ; la limite
// du glisser (clubs à l’écran après des glissers dans les 4 directions), le redimensionnement et l’ordre de tabulation
// ne se mesurent que là. API en 503 sauf une liste de matchs vide (la carte se cadre sans eux), tuiles refusées, serveur Vite démarré par le test.
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
  // Depuis L194 la carte attend la liste des matchs : une erreur ne la rend pas, une liste vide chargée si.
  await page.route('**/api/season-matches*', (route) => route.fulfill({ status: 200, json: [] }));
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
    // Le pointeur est sur la carte : une carte qui prendrait la molette ne laisserait pas la page défiler.
    await page.mouse.move(boite.x + 80, Math.min(Math.max(boite.y, 0) + 80, hauteur - 20));
    const defilable = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
    expect(defilable, 'la page doit pouvoir défiler pour que la mesure ait un sens').toBeGreaterThan(50);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    await page.mouse.wheel(0, 200);
    await page.waitForTimeout(500);
    const bas = await page.evaluate(() => window.scrollY);
    expect(bas, 'la molette vers le bas fait défiler la page').toBeGreaterThan(0);
    await page.mouse.wheel(0, -100);
    await page.waitForTimeout(500);
    expect(await page.evaluate(() => window.scrollY), 'la molette vers le haut la fait remonter').toBeLessThan(bas);
    // La carte n'a pas bougé : mêmes marges (relevées dans la carte, indifférentes au défilement de la page).
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

  it('R10b — Recentrer depuis un zoom 3 crans plus près remet le zoom minimal : − grisé, puis un + ne gagne qu’un cran', async () => {
    const page = await ouvrir(largeur, hauteur);
    const plus = page.getByRole('button', { name: 'Zoom in' });
    const moins = page.getByRole('button', { name: 'Zoom out' });
    const ouverture = await marges(page);
    for (let i = 0; i < 3; i++) await plus.click(); // sans attendre : trois crans d'affilée
    await page.waitForTimeout(800);
    expect(await moins.evaluate((b) => b.classList.contains('leaflet-disabled'))).toBe(false);
    await page.getByRole('button', { name: 'Recentrer' }).click();
    await page.waitForTimeout(1000);
    expect(await moins.evaluate((b) => b.classList.contains('leaflet-disabled'))).toBe(true);
    expect(await plus.evaluate((b) => b.classList.contains('leaflet-disabled'))).toBe(false);
    const recentree = await marges(page);
    for (const k of ['haut', 'bas', 'gauche', 'droite'] as const) expect(recentree[k]).toBeCloseTo(ouverture[k], 0);
    await plus.click();
    await page.waitForTimeout(500);
    // Un cran de zoom : le − se dégrise, et la marge haute n'a pas plongé de 4 crans.
    expect(await moins.evaluate((b) => b.classList.contains('leaflet-disabled'))).toBe(false);
    const un = await marges(page);
    await moins.click();
    await page.waitForTimeout(500);
    const retour = await marges(page);
    await page.close();
    expect(un.haut).toBeLessThan(ouverture.haut);
    expect(un.haut).toBeGreaterThan(-ouverture.haut * 4);
    for (const k of ['haut', 'bas', 'gauche', 'droite'] as const) expect(retour[k]).toBeCloseTo(ouverture[k], 0);
  });
});

/** Nombre de marqueurs dont une partie est visible dans la carte. */
async function marqueursVisibles(page: Page): Promise<number> {
  return page.evaluate(() => {
    const c = document.querySelector('.leaflet-container')!.getBoundingClientRect();
    return [...document.querySelectorAll('.ligue1-map-marker')].filter((e) => {
      const r = e.getBoundingClientRect();
      return r.right > c.left && r.left < c.right && r.bottom > c.top && r.top < c.bottom;
    }).length;
  });
}

/** Glisse la carte de `fois` fois 40 % de sa largeur, dans la direction (dx, dy). */
async function glisser(page: Page, dx: number, dy: number, fois = 6) {
  const boite = (await page.locator('.leaflet-container').boundingBox())!;
  const pas = boite.width * 0.4;
  for (let i = 0; i < fois; i++) {
    // Départ au milieu de la carte, décalé pour que l'arrivée reste dans le cadre.
    const x = boite.x + boite.width / 2 - (dx * pas) / 2;
    const y = boite.y + boite.height / 2 - (dy * pas) / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx * pas, y + dy * pas, { steps: 8 });
    await page.mouse.up();
  }
  await page.waitForTimeout(300);
}

describe.each([[1440, 900], [390, 844], [320, 700]])('Glisser de la carte L1 à %i×%i (L192)', (largeur, hauteur) => {
  const directions: Array<[string, number, number]> = [['vers la gauche', -1, 0], ['vers la droite', 1, 0], ['vers le haut', 0, -1], ['vers le bas', 0, 1]];

  it.each(directions)('R11 — à l’ouverture comme après Recentrer, 6 glissers %s laissent des clubs à l’écran', async (_nom, dx, dy) => {
    const page = await ouvrir(largeur, hauteur);
    await page.getByRole('button', { name: 'Recentrer' }).click();
    await page.waitForTimeout(800);
    const avant = await marges(page);
    await glisser(page, dx, dy);
    const visibles = await marqueursVisibles(page);
    const apres = await marges(page);
    await page.close();
    // La vue d'ouverture est la limite : les 18 clubs y sont, ils y restent, et la vue ne se décale pas de plus d'un pixel.
    expect(visibles).toBe(18);
    for (const k of ['haut', 'bas', 'gauche', 'droite'] as const) expect(Math.abs(apres[k] - avant[k])).toBeLessThanOrEqual(2);
  });

  it.each(directions)('R12 — un cran plus près, 6 glissers %s gardent au moins un club à l’écran', async (_nom, dx, dy) => {
    const page = await ouvrir(largeur, hauteur);
    await page.getByRole('button', { name: 'Zoom in' }).click();
    await page.waitForTimeout(500);
    await glisser(page, dx, dy);
    const visibles = await marqueursVisibles(page);
    await page.close();
    expect(visibles).toBeGreaterThanOrEqual(1);
  });
});

describe.each([[1440, 900], [390, 844]])('Carte L1 à %i×%i — redimensionnement et clavier (L192)', (largeur, hauteur) => {
  it('R13 — un redimensionnement de 20 px garde le zoom et le déplacement de l’utilisateur', async () => {
    const page = await ouvrir(largeur, hauteur);
    const plus = page.getByRole('button', { name: 'Zoom in' });
    for (let i = 0; i < 3; i++) {
      await plus.click();
      await page.waitForTimeout(300);
    }
    await glisser(page, -1, 0, 1);
    const avant = await marges(page);
    await page.setViewportSize({ width: largeur - 20, height: hauteur });
    await page.waitForTimeout(600);
    const apres = await marges(page);
    // Même vue au demi-redimensionnement près (la carte a perdu 20 px de large) : pas de retour au cadrage d'ouverture.
    expect(Math.abs(apres.haut - avant.haut)).toBeLessThanOrEqual(2);
    expect(Math.abs(apres.bas - avant.bas)).toBeLessThanOrEqual(2);
    expect(await page.getByRole('button', { name: 'Zoom out' }).evaluate((b) => b.classList.contains('leaflet-disabled'))).toBe(false);
    // Au zoom minimal, en revanche, le cadrage suit le nouveau format.
    await page.getByRole('button', { name: 'Recentrer' }).click();
    await page.waitForTimeout(800);
    await page.setViewportSize({ width: largeur - 40, height: hauteur });
    await page.waitForTimeout(600);
    const recadree = await marges(page);
    await page.close();
    for (const marge of [recadree.haut, recadree.bas, recadree.gauche, recadree.droite]) expect(marge).toBeGreaterThanOrEqual(8);
    expect(Math.abs(recadree.gauche - recadree.droite)).toBeLessThanOrEqual(2);
  });

  it('R14 — l’ordre de tabulation suit l’ordre visuel : zoom, Recentrer, puis les liens d’attribution', async () => {
    const page = await ouvrir(largeur, hauteur);
    await page.getByRole('button', { name: 'Zoom in' }).focus();
    const suivants: string[] = [];
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press('Tab');
      suivants.push(await page.evaluate(() => (document.activeElement as HTMLElement).getAttribute('aria-label') ?? (document.activeElement as HTMLElement).textContent?.trim() ?? ''));
    }
    await page.close();
    // Zoom in (focus de départ) → Zoom out → Recentrer → premier lien d'attribution.
    expect(suivants[0]).toBe('Zoom out');
    expect(suivants[1]).toBe('Recentrer');
    expect(suivants[2]).toMatch(/Leaflet|OpenStreetMap/);
  });
});
