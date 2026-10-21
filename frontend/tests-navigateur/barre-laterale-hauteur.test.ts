// L205 — barre latérale mesurée dans Chromium à faible hauteur : jsdom ne met rien en page, et c'est la hauteur réelle
// (1440×768, 1366×640) qui coupait Sofascore, la pastille du direct, la version et des liens, sans défilement possible.
// API en 503, ressources externes refusées, serveur Vite démarré par le test.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser } from 'playwright';
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

describe.each([[1440, 768], [1366, 640], [1440, 900]])('Barre latérale à %i×%i (L205)', (largeur, hauteur) => {
  async function ouvrir() {
    const page = await navigateur.newPage({ viewport: { width: largeur, height: hauteur }, timezoneId: 'Europe/Paris', locale: 'fr-FR' });
    await page.route('**/api/**', (route) => route.fulfill({ status: 503, json: {} }));
    await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());
    await page.goto(`${url}/`);
    await page.waitForSelector('aside a[href="/fcnoobz"]');
    return page;
  }

  it('R4 — tout le contenu de la barre (dernier lien, pastille, version) s’atteint en la faisant défiler', async () => {
    const page = await ouvrir();
    const m = await page.evaluate(() => {
      const defile = document.querySelector<HTMLElement>('[data-testid="barre-laterale-defilante"]')!;
      const aside = document.querySelector('aside')!.getBoundingClientRect();
      defile.scrollTop = defile.scrollHeight;
      const version = [...defile.querySelectorAll('div')].find((d) => d.textContent === 'v2.0')!.getBoundingClientRect();
      return { bas: version.bottom, hautAside: aside.top, basAside: aside.bottom, haut: version.top, debordeH: defile.scrollWidth > defile.clientWidth };
    });
    await page.close();
    expect(m.haut).toBeGreaterThanOrEqual(m.hautAside);
    expect(m.bas).toBeLessThanOrEqual(m.basAside + 0.5);
    expect(m.debordeH).toBe(false);
  });

  it('R5 — au clavier, chaque lien focalisé de la barre est entièrement visible dans la barre (WCAG 2.4.11)', async () => {
    const page = await ouvrir();
    const liens = await page.locator('aside a').count();
    const cachés: string[] = [];
    for (let i = 0; i < liens; i++) {
      await page.locator('aside a').nth(i).focus();
      const r = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement;
        const b = el.getBoundingClientRect();
        const a = document.querySelector('aside')!.getBoundingClientRect();
        return { nom: el.textContent?.trim() || el.getAttribute('href'), entier: b.top >= a.top - 0.5 && b.bottom <= a.bottom + 0.5 && b.bottom <= window.innerHeight + 0.5 };
      });
      if (!r.entier) cachés.push(String(r.nom));
    }
    await page.close();
    expect(liens).toBeGreaterThanOrEqual(12);
    expect(cachés).toEqual([]);
  });
});
