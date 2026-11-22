// L262 — /standings, premier écran des petits téléphones et du téléphone couché (QA de L259, 18-11) : à 320 × 568, la
// ligne de Lyon (5e) finissait 17 px sous la barre de navigation du bas ; à 844 × 390, elle était 159 px dessous et le
// lien « Voir l'OL » n'existait pas (masqué dès 768 px alors que la barre du bas reste jusqu'à 1023 px).
// Mesure dans Chromium, sur les réponses réelles de l'API enregistrées le 18-11 (`donnees/api-prod-2026-11-18.json`,
// Lyon 5e), puis sur le même classement avec Lyon 17e :
//  - au premier écran (scrollY = 0), la 1re ligne du tableau est entière au-dessus de la barre du bas ;
//  - la ligne de l'OL est entière au-dessus de la barre du bas ; sinon le lien « Voir l'OL » est entier au-dessus de
//    la barre (≥ 24 px de haut, WCAG 2.5.8) et, une fois suivi, la ligne est entière entre l'en-tête collant du tableau
//    et la barre du bas, focus posé sur elle ;
//  - Lyon 5e à 320 × 568 et 390 × 844 : sa ligne est au premier écran, sans le lien (défaut de la QA).
// La boîte comparée est celle de `nav[aria-label="Navigation principale"]` (barre du bas, sous 1024 px).
// Avec CAPTURES_DIR, enregistre chaque premier écran (CAPTURES_NOM : « avant » / « apres »).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { chromium, type Browser, type Page } from 'playwright';
import { createServer, type ViteDevServer } from 'vite';

type Reponses = Record<string, { status: number; body: unknown }>;
const API = JSON.parse(readFileSync(new URL('./donnees/api-prod-2026-11-18.json', import.meta.url), 'utf8')) as Reponses;
type Ligne = { position: number; teamId: number };
const CLASSEMENT = API['/api/standings'].body as { table: Ligne[] };

/** Le classement réel, Lyon déplacé à la place `rang` (les autres gardent leur ordre). */
function classementAvecLyon(rang: number) {
  const lyon = CLASSEMENT.table.find((l) => l.teamId === 523)!;
  const autres = CLASSEMENT.table.filter((l) => l.teamId !== 523);
  const table = [...autres.slice(0, rang - 1), lyon, ...autres.slice(rang - 1)].map((l, i) => ({ ...l, position: i + 1 }));
  return { ...CLASSEMENT, table };
}

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

async function ouvrir(largeur: number, hauteur: number, rangLyon: number): Promise<Page> {
  const page = await navigateur.newPage({ viewport: { width: largeur, height: hauteur }, timezoneId: 'Europe/Paris', locale: 'fr-FR' });
  await page.clock.setFixedTime(new Date('2026-11-18T13:10:00+01:00'));
  await page.route('**/api/**', (route) => {
    const u = new URL(route.request().url());
    if (u.pathname === '/api/standings') return route.fulfill({ status: 200, json: classementAvecLyon(rangLyon) });
    const r = API[u.pathname + u.search];
    return r ? route.fulfill({ status: r.status, json: r.body }) : route.fulfill({ status: 404, json: {} });
  });
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());
  await page.goto(`${url}/standings`);
  await page.locator('#ligne-ol').waitFor();
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  return page;
}

type Boite = { haut: number; bas: number };
const boite = (page: Page, selecteur: string) => page.locator(selecteur).first().evaluate((e) => {
  const b = e.getBoundingClientRect();
  return { haut: b.top, bas: b.bottom };
});

/** Haut de la barre du bas (toujours affichée sous 1024 px : le test l'exige). */
async function hautBarre(page: Page): Promise<number> {
  const nav = page.locator('nav[aria-label="Navigation principale"]');
  expect(await nav.isVisible(), 'barre du bas affichée').toBe(true);
  return (await boite(page, 'nav[aria-label="Navigation principale"]')).haut;
}

const lienOL = (page: Page) => page.getByRole('link', { name: /^Voir l'OL/ });

const capture = async (page: Page, nom: string) => {
  const dossier = process.env.CAPTURES_DIR;
  if (dossier) await page.screenshot({ path: `${dossier}/L262-${nom}-${process.env.CAPTURES_NOM ?? 'apres'}.png` });
};

const TAILLES = [[320, 568], [390, 844], [844, 390]] as const;

describe.each(TAILLES)('/standings à %i × %i', (largeur, hauteur) => {
  it.each([5, 17])('L262 — Lyon %ie : 1re ligne au premier écran ; ligne de l\'OL au premier écran, ou atteinte par « Voir l\'OL » sans rester masquée', async (rang) => {
    const page = await ouvrir(largeur, hauteur, rang);
    try {
      await capture(page, `lyon-${rang}e-${largeur}x${hauteur}`);
      expect(await page.evaluate(() => window.scrollY)).toBe(0);
      const barre = await hautBarre(page);
      const premiere = await boite(page, 'tbody tr');
      expect(premiere.bas, `1re ligne ${JSON.stringify(premiere)}, barre à ${barre}`).toBeLessThanOrEqual(barre);

      const ol: Boite = await boite(page, '#ligne-ol');
      const olVisible = ol.haut >= 0 && ol.bas <= barre;
      if (rang === 5 && largeur < 844)
        expect(ol.bas, `ligne de Lyon ${JSON.stringify(ol)}, barre à ${barre}`).toBeLessThanOrEqual(barre);
      if (olVisible) return;

      const lien = lienOL(page);
      expect(await lien.isVisible(), 'lien « Voir l\'OL » affiché').toBe(true);
      const b = await lien.boundingBox();
      expect(b!.y + b!.height, 'lien au-dessus de la barre').toBeLessThanOrEqual(barre);
      expect(b!.height).toBeGreaterThanOrEqual(24);
      await lien.click();
      await page.waitForFunction(() => window.scrollY > 0);
      await page.waitForTimeout(400);
      await capture(page, `lyon-${rang}e-${largeur}x${hauteur}-apres-lien`);
      const apres = await boite(page, '#ligne-ol');
      const entete = (await boite(page, 'thead')).bas;
      expect(apres.haut, `ligne ${JSON.stringify(apres)} sous l'en-tête collant (${entete})`).toBeGreaterThanOrEqual(entete - 0.5);
      expect(apres.bas, `ligne ${JSON.stringify(apres)} au-dessus de la barre (${barre})`).toBeLessThanOrEqual(await hautBarre(page));
      expect(await page.evaluate(() => document.activeElement?.id)).toBe('ligne-ol');
    } finally {
      await page.close();
    }
  });
});
