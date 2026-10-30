// L124 — densité du Calendrier à 390 px : mesurée dans Chromium (jsdom ne mesure aucune hauteur).
// API simulée : /api/season-matches sert les 46 matchs de la saison (src/test/fixtures/season-matches-2026-10-03.json).
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright';
import { createServer, type ViteDevServer } from 'vite';

const matchs = JSON.parse(readFileSync(new URL('../src/test/fixtures/season-matches-2026-10-03.json', import.meta.url), 'utf8'));

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

async function ouvrir(largeur: number): Promise<Page> {
  const page = await navigateur.newPage({ viewport: { width: largeur, height: 844 }, timezoneId: 'Europe/Paris', locale: 'fr-FR' });
  // Playwright essaie les routes de la dernière enregistrée à la première : le cas général d'abord.
  await page.route('**/api/**', (route) => route.fulfill({ status: 404, json: {} }));
  await page.route('**/api/season-matches', (route) => route.fulfill({ status: 200, json: matchs }));
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());
  await page.goto(`${url}/fixtures`);
  await page.getByTestId('liste-mois').waitFor();
  return page;
}

const hauteurs = (page: Page) =>
  page.evaluate(() => ({
    liste: Math.round(document.querySelector('[data-testid="liste-mois"]')!.getBoundingClientRect().height),
    lignes: [...document.querySelectorAll('[data-testid="ligne-match"]')].map((l) => l.getBoundingClientRect().height),
  }));

// Maquette validée de L50 (docs/specs/calendrier/maquette.html) mesurée à 390 px dans le même Chromium :
// liste 2 810 px, lignes à venir 50-52 px, ligne « Horaire à confirmer » 52 px. Avant L124 : 3 163 et 60-61 px.
const MAQUETTE_LISTE_PX = 2810;

describe('L124 — densité du Calendrier à 390 px', () => {
  let page: Page;
  beforeAll(async () => { page = await ouvrir(390); });
  afterAll(async () => { await page?.close(); });

  it('R1 — la liste des 46 matchs ne dépasse pas la maquette de plus de 5 %', async () => {
    const h = await hauteurs(page);
    expect(h.lignes).toHaveLength(46);
    expect(h.liste).toBeLessThanOrEqual(MAQUETTE_LISTE_PX * 1.05);
  });

  it('R2 — une ligne « Horaire à confirmer » (la plus haute des matchs à venir) fait au plus 54 px', async () => {
    const hauts = await page.evaluate(() =>
      [...document.querySelectorAll('[data-testid="ligne-match"]')]
        .filter((l) => /confirmer/i.test((l as HTMLElement).innerText))
        .map((l) => l.getBoundingClientRect().height),
    );
    expect(hauts.length).toBeGreaterThan(10);
    expect(Math.max(...hauts)).toBeLessThanOrEqual(54);
  });

  it('R3 — la lisibilité tient : noms 13 px, scores 14 px, jamais coupés par une ellipse, pas de défilement horizontal', async () => {
    const m = await page.evaluate(() => {
      const ligne = document.querySelector('[data-testid="ligne-match"]')!;
      const noms = [...ligne.querySelectorAll('[data-testid="equipes-match"] a span.break-words')].map((n) => getComputedStyle(n));
      const scores = [...ligne.querySelectorAll('[data-testid="equipes-match"] .num')].map((n) => getComputedStyle(n));
      return {
        noms: noms.map((c) => [c.fontSize, c.textOverflow]),
        scores: scores.map((c) => c.fontSize),
        debordement: document.documentElement.scrollWidth - innerWidth,
      };
    });
    expect(m.noms.length).toBe(2);
    for (const [taille, ellipse] of m.noms) { expect(taille).toBe('13px'); expect(ellipse).not.toBe('ellipsis'); }
    expect(m.scores).toEqual(['14px', '14px']);
    expect(m.debordement).toBeLessThanOrEqual(0);
  });
});
