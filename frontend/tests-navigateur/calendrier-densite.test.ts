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

// L258 (revue, constat 1) — à 12 px, le jour (« Sam. 22 », « Week-end ») et sa seconde ligne doivent tenir dans
// leur colonne : aucun texte de la date ne mord sur la colonne des équipes, à aucune largeur, et rien sous 12 px.
describe('L258 — la date du Calendrier tient dans sa colonne, à 12 px au moins', () => {
  for (const largeur of [320, 359, 360, 390, 1440]) {
    it(`${largeur} px : aucun texte de date ne déborde sur les équipes`, async () => {
      const page = await ouvrir(largeur);
      try {
        const m = await page.evaluate(() =>
          [...document.querySelectorAll('[data-testid="ligne-match"]')].flatMap((ligne) => {
            const equipes = ligne.querySelector('[data-testid="equipes-match"]')!.getBoundingClientRect();
            const date = ligne.querySelector('[data-testid="date-match"]')!;
            const gauche = ligne.getBoundingClientRect().left;
            const textes: { texte: string; taille: number; debord: number; sortGauche: number; lignes: number }[] = [];
            const marcheur = document.createTreeWalker(date, NodeFilter.SHOW_TEXT);
            for (let n = marcheur.nextNode(); n; n = marcheur.nextNode()) {
              const parent = n.parentElement!;
              // Masqué à l'écran : display none, ou forme réservée aux lecteurs d'écran (sr-only : boîte de 1 px découpée).
              const cache = (e: Element) => getComputedStyle(e).display === 'none' || e.getBoundingClientRect().width <= 1;
              if (!n.textContent?.trim() || cache(parent)) continue;
              const r = document.createRange();
              r.selectNodeContents(n);
              const b = r.getBoundingClientRect();
              if (b.width === 0) continue;
              textes.push({
                texte: n.textContent.trim(),
                taille: parseFloat(getComputedStyle(parent).fontSize),
                debord: b.right - equipes.left,
                sortGauche: gauche - b.left,
                lignes: r.getClientRects().length,
              });
            }
            return textes;
          }),
        );
        expect(m.length).toBeGreaterThanOrEqual(46);
        const fautifs = m.filter((t) => t.debord > 0 || t.sortGauche > 0).map((t) => `${t.texte} (+${t.debord.toFixed(1)})`);
        expect(fautifs).toEqual([]);
        expect(Math.min(...m.map((t) => t.taille))).toBeGreaterThanOrEqual(12);
        // L100 : « Week-end » ne se coupe jamais au trait d'union (abrégé « WE » sous 360 px).
        expect(m.filter((t) => t.texte.includes('-') && t.lignes > 1).map((t) => t.texte)).toEqual([]);
        if (largeur < 360) expect(m.some((t) => t.texte === 'WE')).toBe(true);
      } finally {
        await page.close();
      }
    });
  }
});
