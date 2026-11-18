// L256 — graphique « Évolution diff. de buts cumulée » de l'accueil : chaque étiquette de l'axe Y est entière, dans le SVG
// et à gauche de la zone tracée. Avant, `margin.left = -12` faisait partir « -4 » à x = -3 px (lu « 4 ») et « 12 » à
// x = -2 px (lu « I2 »). jsdom ne mesure aucun texte : mesure dans Chromium (getBBox / getBoundingClientRect).
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

/** Statistiques de saison dont la diff. cumulée suit `serie` (une valeur par match). */
function stats(serie: number[]) {
  const chart = serie.map((gd, i) => ({
    matchIndex: i + 1, date: new Date(Date.UTC(2026, 7, 10 + 7 * i)).toISOString(), goalDifference: gd,
    points: null, competitionCode: 'L1', result: i > 0 && gd > serie[i - 1] ? 'W' : i > 0 && gd < serie[i - 1] ? 'L' : 'D',
  }));
  return {
    played: serie.length, won: 5, draw: 2, lost: 3, goalsFor: 20, goalsAgainst: 8, goalDifference: serie[serie.length - 1],
    goalsForPerMatch: 2, goalsAgainstPerMatch: 0.8, cleanSheets: 3, cleanSheetRate: 30, winRate: 50,
    perCompetition: [{ competitionCode: 'L1', played: serie.length, won: 5, draw: 2, lost: 3, goalsFor: 20, goalsAgainst: 8, cleanSheets: 3, points: 17 }],
    chart,
  };
}

const SERIES: Record<string, number[]> = {
  // Le cas de la revue L255 : axe de -4 à 12.
  'de -4 à 12': [-1, -4, -2, 0, 3, 5, 8, 10, 12, 11],
  // Étiquettes de trois caractères des deux côtés : les plus larges qu'une saison puisse produire.
  'de -24 à 36': [-6, -14, -24, -10, 0, 12, 20, 28, 36, 30],
};

describe.each([320, 390, 768, 1024, 1440])('axe Y du graphique diff. de buts à %i px', (largeur) => {
  it.each(Object.keys(SERIES))('L256 — étiquettes %s entières, dans le SVG, à gauche de la zone tracée', async (nom) => {
    const page = await navigateur.newPage({ viewport: { width: largeur, height: 900 }, timezoneId: 'Europe/Paris', locale: 'fr-FR' });
    try {
      const corps = stats(SERIES[nom]);
      await page.route('**/api/**', (route) => {
        const u = route.request().url();
        if (u.includes('/api/season-matches/team-stats')) return route.fulfill({ status: 200, json: corps });
        if (u.includes('/api/season-matches')) return route.fulfill({ status: 200, json: [] });
        return route.fulfill({ status: 404, json: {} });
      });
      await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());
      await page.goto(`${url}/`);
      const graphique = page.getByTestId('graphique-diff-buts');
      await graphique.locator('.recharts-yAxis .recharts-cartesian-axis-tick-value').first().waitFor();
      const mesure = await graphique.evaluate((el) => {
        const svg = el.querySelector('svg.recharts-surface')!.getBoundingClientRect();
        const grille = el.querySelector('.recharts-cartesian-grid')!.getBoundingClientRect();
        const ticks = Array.from(el.querySelectorAll<SVGTextElement>('.recharts-yAxis .recharts-cartesian-axis-tick-value')).map((t) => {
          const r = t.getBoundingClientRect();
          return { texte: t.textContent, gauche: r.left - svg.left, droite: r.right - svg.left, haut: r.top - svg.top, bas: r.bottom - svg.top };
        });
        return { largeur: svg.width, hauteur: svg.height, zoneGauche: grille.left - svg.left, ticks };
      });
      expect(mesure.ticks.length).toBeGreaterThanOrEqual(3);
      // Les deux extrêmes de la série apparaissent, signe compris (« -4 » ne doit pas se lire « 4 »).
      const textes = mesure.ticks.map((t) => t.texte);
      expect(textes.some((t) => t!.startsWith('-'))).toBe(true);
      for (const t of mesure.ticks) {
        expect(t.gauche, `« ${t.texte} » part à x = ${t.gauche.toFixed(1)} px`).toBeGreaterThanOrEqual(0);
        expect(t.droite, `« ${t.texte} » déborde sur la zone tracée`).toBeLessThanOrEqual(mesure.zoneGauche);
        expect(t.haut).toBeGreaterThanOrEqual(0);
        expect(t.bas).toBeLessThanOrEqual(mesure.hauteur);
      }
    } finally {
      await page.close();
    }
  });
});
