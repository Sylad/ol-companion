// L195 — la fiche d'un club tient dans la carte à 320 px : × visible, logo hors des boutons de zoom, pour les 18
// clubs (jsdom ne met rien en page). API et tuiles refusées, serveur Vite démarré par le test.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser } from 'playwright';
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

// Fiche la plus haute : aller et retour joués, plus un match de Coupe de France, pour chaque adversaire.
const base = { competition: 'Ligue 1', homeScore: 2, awayScore: 1, status: 'FINISHED', matchday: 1 };
const saison = LIGUE1_CLUBS_COORDS.filter((c) => c.id365 !== OL_ID_365).flatMap((c, i) => [
  { ...base, id: i * 10 + 1, competitionCode: 'L1', competitionId: 35, date: '2025-09-01T18:00:00Z', homeTeamId: 523, awayTeamId: c.id365, homeTeam: 'Lyon', awayTeam: c.name },
  { ...base, id: i * 10 + 2, competitionCode: 'L1', competitionId: 35, date: '2026-02-01T18:00:00Z', homeTeamId: c.id365, awayTeamId: 523, homeTeam: c.name, awayTeam: 'Lyon' },
  { ...base, id: i * 10 + 3, competitionCode: 'CDF', competitionId: 37, date: '2026-01-05T18:00:00Z', homeTeamId: c.id365, awayTeamId: 523, homeTeam: c.name, awayTeam: 'Lyon' },
]);

describe.each([[320, 640], [390, 844], [1440, 900]])('Fiche de la Carte L1 à %i×%i (L195)', (largeur, hauteur) => {
  it('R6 — la fiche de chaque club est dans la carte, son × est atteignable et son logo ne touche pas les boutons de zoom', async () => {
    const page = await navigateur.newPage({ viewport: { width: largeur, height: hauteur }, timezoneId: 'Europe/Paris', locale: 'fr-FR' });
    await page.route('**/api/**', (route) => route.fulfill({ status: 503, json: {} }));
    // Depuis L194 la carte attend la liste des matchs : une erreur ne la rend pas.
    await page.route('**/api/season-matches*', (route) => route.fulfill({ status: 200, json: saison }));
    await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());
    await page.goto(`${url}/map`);
    await page.waitForSelector('.leaflet-marker-icon');
    await page.waitForTimeout(500);
    const clubs = await page.$$eval('.leaflet-marker-icon', (els) => els.map((el) => (el as HTMLElement).title));
    expect(clubs).toHaveLength(18);
    const fautes: string[] = [];
    for (const club of clubs) {
      await page.locator(`.leaflet-marker-icon[title="${club}"]`).focus();
      await page.keyboard.press('Enter');
      await page.waitForSelector('.leaflet-popup');
      await page.waitForTimeout(600); // fin du recalage automatique
      const m = await page.evaluate(() => {
        const carte = document.querySelector('.leaflet-container')!.getBoundingClientRect();
        const fiche = document.querySelector('.leaflet-popup-content-wrapper')!.getBoundingClientRect();
        const croix = document.querySelector('.leaflet-popup-close-button')!.getBoundingClientRect();
        const zoom = document.querySelector('.leaflet-control-zoom')!.getBoundingClientRect();
        const logo = document.querySelector('.leaflet-popup-content img')!.getBoundingClientRect();
        const dans = (r: DOMRect) => r.left >= carte.left && r.right <= carte.right && r.top >= carte.top && r.bottom <= carte.bottom;
        const touche = (a: DOMRect, b: DOMRect) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
        const surCroix = document.elementFromPoint(croix.left + croix.width / 2, croix.top + croix.height / 2);
        return {
          carte: [carte.left, carte.top, carte.right, carte.bottom].map(Math.round), fiche: [fiche.left, fiche.top, fiche.right, fiche.bottom].map(Math.round),
          ficheDansCarte: dans(fiche),
          croixDansCarte: dans(croix),
          croixAtteignable: !!surCroix?.closest('.leaflet-popup-close-button'),
          logoSurZoom: touche(logo, zoom),
          debordement: document.querySelector('.leaflet-popup-content')!.scrollWidth > document.querySelector('.leaflet-popup-content')!.clientWidth,
        };
      });
      if (!(m.ficheDansCarte && m.croixDansCarte && m.croixAtteignable && !m.logoSurZoom && !m.debordement)) fautes.push(`${club} ${JSON.stringify(m)}`);
      await page.keyboard.press('Escape');
      // La limite du glisser (L192) revient à la fermeture : la carte regagne la vue d'ouverture par un déplacement animé, à laisser finir.
      await page.waitForTimeout(400);
    }
    await page.close();
    expect(fautes).toEqual([]);
  });
});
