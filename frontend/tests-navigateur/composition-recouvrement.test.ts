// L232 — sur /players, aucun élément d'un joueur (rond, nom, pastille de note) ne recouvre celui d'un autre joueur, à 320 et 390 px.
// Mesuré dans Chromium (jsdom ne mesure rien). API simulée, ressources externes refusées, serveur Vite démarré par le test.
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

const joueur = (n: number, shortName: string, yardLine: number, yardSide: number, ranking: number | null = 6.5 + (n % 4) / 2) => ({
  id: n, athleteId: 100 + n, name: shortName, shortName, jerseyNumber: n, position: 'Milieu', positionShort: 'M',
  yardLine, yardSide, ranking, isStarting: true,
});

const base = {
  gameId: 1, date: '2026-10-10T19:00:00Z', competition: 'Ligue 1', matchday: 8, opponent: 'Lens', opponentId: 7,
  isHome: true, homeScore: 2, awayScore: 1, bench: [], injured: [],
};

// Noms longs et notes partout, lignes rapprochées (yardLine 1 à 5) : le cas du 29-10 (J. Duranville sur la note de Tolisso).
const compo433 = {
  ...base, formation: '4-3-3',
  starters: [
    joueur(1, 'Lucas Perri', 1, 50),
    joueur(2, 'Z. Athekame', 2, 10), joueur(3, 'Niakhaté', 2, 36), joueur(4, 'Tagliafico', 2, 64), joueur(5, 'Maitland-Niles', 2, 90),
    joueur(6, 'Tolisso', 3, 15), joueur(7, 'Caqueret', 3, 50), joueur(8, 'Nuamah-Longnom', 3, 85),
    joueur(9, 'J. Duranville', 5, 12), joueur(10, 'Lacazette', 5, 50), joueur(11, 'Cherki', 5, 88),
  ],
};
const compo4231 = {
  ...base, formation: '4-2-3-1',
  starters: [
    joueur(1, 'Lucas Perri', 1, 50),
    joueur(2, 'Z. Athekame', 2, 10), joueur(3, 'Niakhaté', 2, 36), joueur(4, 'Tagliafico', 2, 64), joueur(5, 'Maitland-Niles', 2, 90),
    joueur(6, 'Tolisso', 3, 35), joueur(7, 'Caqueret', 3, 65),
    joueur(8, 'J. Duranville', 4, 12), joueur(9, 'Nuamah-Longnom', 4, 50), joueur(10, 'Cherki', 4, 88),
    joueur(11, 'Lacazette', 5, 50),
  ],
};

async function recouvrements(largeur: number, composition: typeof compo433) {
  const page: Page = await navigateur.newPage({ viewport: { width: largeur, height: 900 }, timezoneId: 'Europe/Paris', locale: 'fr-FR' });
  try {
    await page.route('**/api/**', (route) => route.fulfill({ status: 404, json: {} }));
    await page.route('**/api/lineup*', (route) => route.fulfill({ status: 200, json: composition }));
    await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());
    await page.goto(`${url}/players`);
    await page.locator('[data-testid="terrain"]').waitFor();
    await page.waitForTimeout(300); // recalage des noms de bord (useLayoutEffect + ResizeObserver)
    return await page.evaluate(() => {
      type Boite = { joueur: string; partie: string; l: number; r: number; t: number; b: number };
      const boites: Boite[] = [];
      for (const j of document.querySelectorAll('[data-testid="terrain"] [data-testid="joueur"]')) {
        const nom = j.querySelector('[data-testid="nom-joueur"]')!;
        for (const [partie, sel] of [['rond', '[data-testid="rond-joueur"]'], ['nom', '[data-testid="nom-joueur"]'], ['note', '[data-testid="pastille-note"]']] as const) {
          const el = j.querySelector(sel);
          if (!el) continue;
          if (partie === 'nom' && getComputedStyle(el).visibility === 'hidden') continue; // nom masqué : rien à recouvrir
          const r = el.getBoundingClientRect();
          if (r.width === 0) continue;
          boites.push({ joueur: nom.textContent ?? '', partie, l: r.left, r: r.right, t: r.top, b: r.bottom });
        }
      }
      const trouves: string[] = [];
      for (let i = 0; i < boites.length; i++) for (let k = i + 1; k < boites.length; k++) {
        const a = boites[i], c = boites[k];
        if (a.joueur === c.joueur) continue;
        if (Math.min(a.r, c.r) - Math.max(a.l, c.l) > 0.5 && Math.min(a.b, c.b) - Math.max(a.t, c.t) > 0.5) trouves.push(`${a.joueur} (${a.partie}) × ${c.joueur} (${c.partie})`);
      }
      return trouves;
    });
  } finally { await page.close(); }
}

describe.each([320, 390])('R1 — aucun élément d\'un joueur ne recouvre celui d\'un autre à %i px', (largeur) => {
  it.each([['4-3-3', compo433], ['4-2-3-1', compo4231]] as const)('formation %s', async (_, compo) => {
    expect(await recouvrements(largeur, compo)).toEqual([]);
  });
});
