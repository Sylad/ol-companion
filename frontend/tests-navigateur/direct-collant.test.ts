// L64 — la pastille du direct reste visible au défilement sur téléphone : mesurée dans Chromium (jsdom ne défile pas).
// API en 404, ressources externes refusées, serveur Vite démarré par le test. Les pages de l'app étant courtes sans
// données, on allonge le contenu de <main> d'une réserve de 3000 px pour avoir de quoi défiler.
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

async function ouvrir(largeur: number, chemin: string): Promise<Page> {
  const page = await navigateur.newPage({ viewport: { width: largeur, height: 800 }, timezoneId: 'Europe/Paris', locale: 'fr-FR' });
  await page.route('**/api/**', (route) => route.fulfill({ status: 404, json: {} }));
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());
  await page.goto(`${url}${chemin}`);
  await page.locator('main [role="status"]').first().waitFor();
  await page.evaluate(() => {
    const reserve = document.createElement('div');
    reserve.setAttribute('data-testid', 'reserve');
    reserve.style.height = '3000px';
    document.querySelector('main > div')!.appendChild(reserve);
  });
  return page;
}

const pastille = (page: Page) =>
  page.locator('main [role="status"]').first().evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, visible: r.bottom > 0 && r.top < innerHeight };
  });

describe.each([['/match/4672325?matchupId=5061-2373-4672325'], ['/standings'], ['/']])('pastille du direct sur %s', (chemin) => {
  let page: Page;
  beforeAll(async () => { page = await ouvrir(390, chemin); });
  afterAll(async () => { await page?.close(); });

  it('R1 — à 390 px, après 1500 px de défilement, la pastille est toujours à l\'écran, collée sous le haut', async () => {
    const avant = await pastille(page);
    expect(avant.top).toBeGreaterThan(0);
    await page.evaluate(() => window.scrollTo({ top: 1500, behavior: 'instant' }));
    expect(await page.evaluate(() => window.scrollY)).toBe(1500);
    const apres = await pastille(page);
    expect(apres.visible).toBe(true);
    expect(apres.top).toBeGreaterThanOrEqual(0);
    expect(apres.top).toBeLessThanOrEqual(8);
    expect(apres.right).toBeLessThanOrEqual(390);
    expect(apres.left).toBeGreaterThanOrEqual(0);
  });

  it('R2 — la ligne ne masque aucun contenu au repos et ne crée pas de défilement horizontal', async () => {
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    const m = await page.evaluate(() => {
      const ligne = document.querySelector('main [role="status"]')!.parentElement!.getBoundingClientRect();
      const suivant = document.querySelector('main [role="status"]')!.parentElement!.nextElementSibling!.getBoundingClientRect();
      return { basLigne: ligne.bottom, hautSuivant: suivant.top, largeurDoc: document.documentElement.scrollWidth, largeurFenetre: innerWidth };
    });
    expect(m.hautSuivant).toBeGreaterThanOrEqual(m.basLigne - 0.5);
    expect(m.largeurDoc).toBeLessThanOrEqual(m.largeurFenetre);
  });
});

describe('pastille du direct au bureau', () => {
  it('R3 — à 1440 px, la ligne collante est masquée (la pastille est dans la barre latérale)', async () => {
    const page = await navigateur.newPage({ viewport: { width: 1440, height: 800 }, locale: 'fr-FR' });
    await page.route('**/api/**', (route) => route.fulfill({ status: 404, json: {} }));
    await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());
    await page.goto(`${url}/standings`);
    await page.locator('aside [role="status"]').first().waitFor();
    const affichee = await page.evaluate(() => {
      const lignes = [...document.querySelectorAll('main [role="status"]')].map((e) => e.parentElement!);
      return lignes.some((e) => getComputedStyle(e).display !== 'none');
    });
    await page.close();
    expect(affichee).toBe(false);
  });
});
