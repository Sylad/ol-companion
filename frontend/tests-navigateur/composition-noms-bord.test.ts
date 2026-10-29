// L76 — sur /players, le nom d'un joueur excentré (Tolisso, Nuamah, Athekame) n'est plus coupé par le bord du terrain :
// mesuré dans Chromium (jsdom ne mesure aucune largeur). API simulée, ressources externes refusées, serveur Vite démarré par le test.
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

const joueur = (n: number, shortName: string, yardLine: number, yardSide: number) => ({
  id: n, athleteId: 100 + n, name: shortName, shortName, jerseyNumber: n, position: 'Milieu', positionShort: 'M',
  yardLine, yardSide, ranking: n % 2 ? 7.4 : null, isStarting: true,
});

// Noms longs aux deux bords, plus un joueur au centre ; yardSide hors [4 ; 96] pour couvrir le clamp.
const lineup = {
  gameId: 1, date: '2026-10-10T19:00:00Z', competition: 'Ligue 1', matchday: 8, opponent: 'Lens', opponentId: 7,
  isHome: true, homeScore: 2, awayScore: 1, formation: '4-3-3',
  starters: [
    joueur(1, 'Lucas Perri', 1, 50),
    joueur(2, 'Athekame', 2, 3), joueur(3, 'Niakhaté', 2, 38), joueur(4, 'Tagliafico', 2, 62), joueur(5, 'Tolisso Corentin', 2, 99),
    joueur(6, 'Tolisso', 3, 2), joueur(7, 'Caqueret', 3, 50), joueur(8, 'Nuamah-Longnom', 3, 98),
    joueur(9, 'Nuamah', 5, 4), joueur(10, 'Lacazette', 5, 50), joueur(11, 'Cherki', 5, 96),
  ],
  bench: [], injured: [],
};

describe.each([390, 1440])('noms des joueurs du terrain à %i px', (largeur) => {
  let page: Page;
  beforeAll(async () => {
    page = await navigateur.newPage({ viewport: { width: largeur, height: 900 }, timezoneId: 'Europe/Paris', locale: 'fr-FR' });
    await page.route('**/api/**', (route) => route.fulfill({ status: 404, json: {} }));
    await page.route('**/api/lineup*', (route) => route.fulfill({ status: 200, json: lineup }));
    await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());
    await page.goto(`${url}/players`);
    await page.locator('[data-testid="terrain"]').waitFor();
  });
  afterAll(async () => { await page?.close(); });

  it('R1 — le nom de chaque titulaire est entièrement dans le terrain (aucun bord coupé)', async () => {
    const m = await page.evaluate(() => {
      const t = document.querySelector('[data-testid="terrain"]')!.getBoundingClientRect();
      return [...document.querySelectorAll('[data-testid="terrain"] [data-testid="nom-joueur"]')].map((el) => {
        const r = el.getBoundingClientRect();
        return { nom: el.textContent, gauche: r.left - t.left, droite: t.right - r.right };
      });
    });
    expect(m).toHaveLength(11);
    for (const n of m) {
      expect(n.gauche, `${n.nom} à gauche`).toBeGreaterThanOrEqual(0);
      expect(n.droite, `${n.nom} à droite`).toBeGreaterThanOrEqual(0);
    }
  });

  it('R2 — le rond du numéro reste dans le terrain et un joueur central n\'est pas déplacé', async () => {
    const m = await page.evaluate(() => {
      const t = document.querySelector('[data-testid="terrain"]')!.getBoundingClientRect();
      const rond = (nom: string) => {
        const a = [...document.querySelectorAll('[data-testid="terrain"] a')].find((x) => x.textContent!.includes(nom))!;
        return a.querySelector('div')!.getBoundingClientRect();
      };
      const c = rond('Lacazette');
      return { gaucheT: rond('Tolisso').left - t.left, droiteN: t.right - rond('Nuamah-Longnom').right, centre: (c.left + c.right) / 2 - (t.left + t.right) / 2 };
    });
    expect(m.gaucheT).toBeGreaterThanOrEqual(0);
    expect(m.droiteN).toBeGreaterThanOrEqual(0);
    expect(Math.abs(m.centre)).toBeLessThan(1);
  });
});
