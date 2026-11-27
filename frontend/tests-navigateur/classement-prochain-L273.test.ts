// L273 — /standings, colonne « Prochain » (prochain adversaire en Ligue 1, football-data.org). Mesure dans Chromium,
// sur le classement réel de la prod du 27-11-2026 et les adversaires de la J12 (`donnees/classement-prochain-L273.json`) :
//  - aucun défilement horizontal (page ni tableau) à 320, 390, 768, 1024 et 1440 px, dans les deux vues du téléphone ;
//  - au téléphone, vue « Prochain » : la colonne est entière dans le tableau, G, N, P masqués ;
//  - au bureau : 18 cases, écusson nommé de 20 px et libellé Dom./Ext. de 12 px au moins, dans la cellule ;
//  - trois lignes contre le calendrier réel : Lyon – Monaco (Dom.), Monaco (Ext.), Paris FC à Brest (Ext.).
// Avec CAPTURES_DIR, enregistre les écrans (CAPTURES_NOM : « avant » / « apres »).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { chromium, type Browser, type Page } from 'playwright';
import { createServer, type ViteDevServer } from 'vite';

type Reponses = Record<string, { status: number; body: unknown }>;
const DONNEES = JSON.parse(readFileSync(new URL('./donnees/classement-prochain-L273.json', import.meta.url), 'utf8')) as Reponses;

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

async function ouvrir(largeur: number, hauteur = 900): Promise<Page> {
  const page = await navigateur.newPage({ viewport: { width: largeur, height: hauteur }, timezoneId: 'Europe/Paris', locale: 'fr-FR' });
  await page.clock.setFixedTime(new Date('2026-11-27T17:00:00+01:00'));
  await page.route('**/api/**', (route) => {
    const u = new URL(route.request().url());
    const r = DONNEES[u.pathname + u.search];
    return r ? route.fulfill({ status: r.status, json: r.body }) : route.fulfill({ status: 404, json: {} });
  });
  // Écussons du CDN 365scores servis par un carré gris (le test ne sort pas sur le réseau).
  await page.route(/^https:\/\/imagecache\.365scores\.com\//, (route) =>
    route.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="#888"/></svg>' }));
  await page.route(/^https?:\/\/(?!127\.0\.0\.1|imagecache\.365scores\.com)/, (route) => route.abort());
  await page.goto(`${url}/standings`);
  await page.locator('#ligne-ol').waitFor();
  await page.getByTestId('legende-prochain').waitFor();
  await page.evaluate(() => document.fonts.ready);
  return page;
}

const capture = async (page: Page, nom: string, pleine = false) => {
  const dossier = process.env.CAPTURES_DIR;
  if (dossier) await page.screenshot({ path: `${dossier}/L273-${nom}-${process.env.CAPTURES_NOM ?? 'apres'}.png`, fullPage: pleine });
};

/** Débords horizontaux : page, et tableau dans son conteneur. */
const debords = (page: Page) => page.evaluate(() => {
  const table = document.querySelector('table')!;
  const parent = table.parentElement!.getBoundingClientRect();
  const t = table.getBoundingClientRect();
  return {
    page: document.documentElement.scrollWidth - window.innerWidth,
    tableDroite: t.right - parent.right,
    largeurTable: t.width,
  };
});

/** Ce que montre la case « Prochain » d'une ligne : nom de l'écusson, libellé visible, boîte de la case et de son contenu. */
const caseProchain = (page: Page, club: string) => page.locator('tbody tr').filter({ has: page.locator(`[title="${club}"]`) }).first()
  .locator('td:last-child').evaluate((td) => {
    const img = td.querySelector('[role="img"], img') as HTMLElement | null;
    const lib = td.querySelector('[aria-hidden="true"]:not(img)') as HTMLElement | null;
    const c = td.getBoundingClientRect();
    const contenu = (td.firstElementChild as HTMLElement).getBoundingClientRect();
    return {
      visible: getComputedStyle(td).display !== 'none',
      adversaire: img?.getAttribute('alt') ?? img?.getAttribute('aria-label') ?? null,
      libelle: lib?.textContent ?? null,
      taillePolice: lib ? parseFloat(getComputedStyle(lib.parentElement!).fontSize) : 0,
      tailleLogo: img?.getBoundingClientRect().width ?? 0,
      dedans: contenu.left >= c.left - 0.5 && contenu.right <= c.right + 0.5,
    };
  });

describe.each([320, 390])('/standings au téléphone, %i px (L273)', (largeur) => {
  it('vue « Bilan » : aucun défilement horizontal, colonne « Prochain » repliée', async () => {
    const page = await ouvrir(largeur);
    try {
      await capture(page, `bilan-${largeur}`);
      const d = await debords(page);
      expect(d.page, 'défilement horizontal de la page').toBeLessThanOrEqual(0);
      expect(d.tableDroite, 'tableau plus large que son conteneur').toBeLessThanOrEqual(0.5);
      expect((await caseProchain(page, 'Lyon')).visible).toBe(false);
    } finally {
      await page.close();
    }
  });

  it('vue « Prochain » : G, N, P repliés, colonne entière, aucun défilement horizontal ; trois lignes = calendrier réel', async () => {
    const page = await ouvrir(largeur);
    try {
      await page.getByRole('button', { name: 'Prochain' }).click();
      await page.waitForTimeout(100);
      await capture(page, `prochain-${largeur}`);
      await capture(page, `prochain-${largeur}-page`, true);
      const d = await debords(page);
      expect(d.page).toBeLessThanOrEqual(0);
      expect(d.tableDroite).toBeLessThanOrEqual(0.5);
      const g = await page.locator('thead th', { hasText: /^G$/ }).evaluate((th) => getComputedStyle(th).display);
      expect(g).toBe('none');
      const attendu = [['Lyon', 'Monaco', 'Dom.'], ['Monaco', 'Lyon', 'Ext.'], ['Paris FC', 'Brest', 'Ext.']] as const;
      for (const [club, adv, lib] of attendu) {
        const c = await caseProchain(page, club);
        expect(c, club).toMatchObject({ visible: true, adversaire: adv, libelle: lib, dedans: true });
        expect(c.taillePolice).toBeGreaterThanOrEqual(12);
      }
    } finally {
      await page.close();
    }
  });
});

describe.each([768, 1024, 1440])('/standings à %i px (L273)', (largeur) => {
  it('colonne « Prochain » affichée pour les 18 clubs, sans défilement horizontal ni sélecteur de vue', async () => {
    const page = await ouvrir(largeur);
    try {
      await capture(page, `bureau-${largeur}`, largeur === 1440);
      const d = await debords(page);
      expect(d.page).toBeLessThanOrEqual(0);
      expect(d.tableDroite).toBeLessThanOrEqual(0.5);
      expect(await page.getByRole('group', { name: 'Colonnes du tableau' }).isVisible()).toBe(false);
      expect(await page.getByTestId('prochain-adversaire').count()).toBe(18);
      const lyon = await caseProchain(page, 'Lyon');
      expect(lyon).toMatchObject({ visible: true, adversaire: 'Monaco', libelle: 'Dom.', dedans: true });
      expect(lyon.tailleLogo).toBe(20);
      expect(lyon.taillePolice).toBeGreaterThanOrEqual(12);
    } finally {
      await page.close();
    }
  });
});
