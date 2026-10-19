// L193 — zone cliquable des 18 clubs de la carte L1 mesurée dans Chromium : jsdom ne met rien en page, et c'est
// la superposition réelle des marqueurs (PSG sous Paris FC, Monaco sous Nice, Lille sous Lens) qui était en cause.
// API en 503 sauf une liste de matchs vide, tuiles refusées (la carte se cadre sans elles), serveur Vite démarré par le test.
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

describe.each([[1440, 900], [390, 844]])('Carte L1 à %i×%i (L193)', (largeur, hauteur) => {
  it('R1 — chaque club a une zone d’au moins 24×24 px, entièrement à lui à l’ouverture (PSG, Monaco et Lille compris)', async () => {
    const page = await navigateur.newPage({ viewport: { width: largeur, height: hauteur }, timezoneId: 'Europe/Paris', locale: 'fr-FR' });
    await page.route('**/api/**', (route) => route.fulfill({ status: 503, json: {} }));
    // Depuis L194 la carte attend la liste des matchs : une erreur ne la rend pas, une liste vide chargée si.
    await page.route('**/api/season-matches*', (route) => route.fulfill({ status: 200, json: [] }));
    await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());
    await page.goto(`${url}/map`);
    await page.waitForSelector('.leaflet-marker-icon');
    await page.waitForTimeout(500);
    const mesures = await page.evaluate(() => {
      const carte = document.querySelector('.leaflet-container')!.getBoundingClientRect();
      return [...document.querySelectorAll<HTMLElement>('.leaflet-marker-icon')].map((el) => {
        const r = el.getBoundingClientRect();
        // Grille 6×6 de points dans la zone : chacun doit tomber sur ce marqueur, pas sur un voisin ou un contrôle.
        let touches = 0;
        const autres = new Set<string>();
        let total = 0;
        for (let i = 0; i < 6; i++) {
          for (let j = 0; j < 6; j++) {
            const x = r.left + 1 + ((r.width - 2) * i) / 5;
            const y = r.top + 1 + ((r.height - 2) * j) / 5;
            total++;
            const sur = document.elementFromPoint(x, y);
            if (sur?.closest('.leaflet-marker-icon') === el) touches++;
            else autres.add(`${sur?.tagName}.${sur?.className}`);
          }
        }
        const dansLaCarte = r.left >= carte.left && r.right <= carte.right && r.top >= carte.top && r.bottom <= carte.bottom;
        return { club: el.title, largeur: r.width, hauteur: r.height, part: touches / total, couvert: [...autres], dansLaCarte };
      });
    });
    await page.close();
    expect(mesures).toHaveLength(18);
    for (const m of mesures) {
      expect(m, JSON.stringify(m)).toMatchObject({ dansLaCarte: true, part: 1 });
      expect(m.largeur, m.club).toBeGreaterThanOrEqual(24);
      expect(m.hauteur, m.club).toBeGreaterThanOrEqual(24);
    }
  });
});
