// L198 — une fiche ouverte reste entière dans la carte après un redimensionnement ou une rotation (setViewportSize) :
// le recadrage de la France (followResize) ne doit pas la laisser hors de la carte. Mesure par la géométrie.
// API et tuiles refusées, serveur Vite démarré par le test (même harnais que carte-popup-recouvrement.test.ts).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright';
import { createServer, type ViteDevServer } from 'vite';
import { LIGUE1_CLUBS_COORDS, OL_ID_365 } from '../src/lib/ligue1-clubs-coords';

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

const base = { competition: 'Ligue 1', homeScore: 2, awayScore: 1, status: 'FINISHED', matchday: 1 };
const saison = LIGUE1_CLUBS_COORDS.filter((c) => c.id365 !== OL_ID_365).flatMap((c, i) => [
  { ...base, id: i * 10 + 1, competitionCode: 'L1', competitionId: 35, date: '2025-09-01T18:00:00Z', homeTeamId: 523, awayTeamId: c.id365, homeTeam: 'Lyon', awayTeam: c.name },
  { ...base, id: i * 10 + 2, competitionCode: 'L1', competitionId: 35, date: '2026-02-01T18:00:00Z', homeTeamId: c.id365, awayTeamId: 523, homeTeam: c.name, awayTeam: 'Lyon' },
  { ...base, id: i * 10 + 3, competitionCode: 'CDF', competitionId: 37, date: '2026-01-05T18:00:00Z', homeTeamId: c.id365, awayTeamId: 523, homeTeam: c.name, awayTeam: 'Lyon' },
]);

async function ouvrir(largeur: number, hauteur: number): Promise<Page> {
  const page = await navigateur.newPage({ viewport: { width: largeur, height: hauteur }, timezoneId: 'Europe/Paris', locale: 'fr-FR' });
  await page.route('**/api/**', (route) => route.fulfill({ status: 503, json: {} }));
  await page.route('**/api/season-matches*', (route) => route.fulfill({ status: 200, json: saison }));
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());
  await page.goto(`${url}/map`);
  await page.waitForSelector('.leaflet-marker-icon');
  await page.waitForTimeout(500);
  return page;
}


const TAILLES: Array<[string, [number, number], [number, number]]> = [
  ['rotation 390×844 → 844×390', [390, 844], [844, 390]],
  ['fenêtre 1440×900 → 1400×900', [1440, 900], [1400, 900]],
];

describe.each(TAILLES)('Fiche ouverte puis %s (L198)', (_nom, [l0, h0], [l1, h1]) => {
  it('R1 — Lille, Lens et Strasbourg : la fiche, son × et son en-tête restent entiers dans la carte après le redimensionnement', async () => {
    const fautes: string[] = [];
    for (const club of ['Lille', 'Lens', 'Strasbourg']) {
      const page = await ouvrir(l0, h0);
      await page.locator(`.leaflet-marker-icon[title="${club}"]`).focus();
      await page.keyboard.press('Enter');
      await page.waitForSelector('.leaflet-popup');
      await page.waitForTimeout(600);
      await page.setViewportSize({ width: l1, height: h1 });
      await page.waitForTimeout(800); // recadrage (≤ 312 ms mesuré) puis recalage de la fiche
      const hors = await page.evaluate(() => {
        const rect = (s: string) => document.querySelector(s)!.getBoundingClientRect();
        const carte = rect('.leaflet-container');
        return ['.leaflet-popup-content-wrapper', '.leaflet-popup-close-button', '.leaflet-popup-content header']
          .map((s) => {
            const r = rect(s);
            return { s, px: Math.round(Math.max(carte.top - r.top, r.bottom - carte.bottom, carte.left - r.left, r.right - carte.right, 0)) };
          })
          .filter((x) => x.px > 0);
      });
      if (hors.length) fautes.push(`${club} ${JSON.stringify(hors)}`);
      await page.close();
    }
    expect(fautes).toEqual([]);
  });
});
