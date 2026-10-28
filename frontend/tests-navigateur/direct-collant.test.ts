// L64 — la pastille du direct reste visible au défilement sur téléphone : mesurée dans Chromium (jsdom ne défile pas).
// API en 404, ressources externes refusées, serveur Vite démarré par le test. Les pages de l'app étant courtes sans
// données, on allonge le contenu de <main> d'une réserve de 3000 px pour avoir de quoi défiler.
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

async function ouvrir(largeur: number, chemin: string): Promise<Page> {
  const page = await navigateur.newPage({ viewport: { width: largeur, height: 800 }, timezoneId: 'Europe/Paris', locale: 'fr-FR' });
  await page.route('**/api/**', (route) => route.fulfill({ status: 404, json: {} }));
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());
  await page.goto(`${url}${chemin}`);
  await page.locator('main [role="status"]').first().waitFor();
  await page.evaluate(() => {
    const reserve = document.createElement('div');
    reserve.setAttribute('data-testid', 'reserve');
    reserve.style.height = '3000px';
    document.querySelector('main > div')!.appendChild(reserve);
  });
  return page;
}

const pastille = (page: Page) =>
  page.locator('main [data-testid="pastille-direct"]').first().evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, visible: r.bottom > 0 && r.top < innerHeight };
  });

describe.each([['/match/4672325?matchupId=5061-2373-4672325'], ['/standings'], ['/']])('pastille du direct sur %s', (chemin) => {
  let page: Page;
  beforeAll(async () => { page = await ouvrir(390, chemin); });
  afterAll(async () => { await page?.close(); });

  it('R1 — à 390 px, après 1500 px de défilement, la pastille est toujours à l\'écran, collée sous le haut', async () => {
    const avant = await pastille(page);
    expect(avant.top).toBeGreaterThan(0);
    await page.evaluate(() => window.scrollTo({ top: 1500, behavior: 'instant' }));
    expect(await page.evaluate(() => window.scrollY)).toBe(1500);
    const apres = await pastille(page);
    expect(apres.visible).toBe(true);
    expect(apres.top).toBeGreaterThanOrEqual(0);
    expect(apres.top).toBeLessThanOrEqual(8);
    expect(apres.right).toBeLessThanOrEqual(390);
    expect(apres.left).toBeGreaterThanOrEqual(0);
  });

  it('R2 — la ligne ne masque aucun contenu au repos et ne crée pas de défilement horizontal', async () => {
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    const m = await page.evaluate(() => {
      const ligne = document.querySelector('main [data-testid="ligne-direct"]')!.getBoundingClientRect();
      const suivant = document.querySelector('main [data-testid="ligne-direct"]')!.nextElementSibling!.getBoundingClientRect();
      return { basLigne: ligne.bottom, hautSuivant: suivant.top, largeurDoc: document.documentElement.scrollWidth, largeurFenetre: innerWidth };
    });
    expect(m.hautSuivant).toBeGreaterThanOrEqual(m.basLigne - 0.5);
    expect(m.largeurDoc).toBeLessThanOrEqual(m.largeurFenetre);
  });
});

describe('pastille du direct au bureau', () => {
  it('R3 — à 1440 px, la ligne collante est masquée (la pastille est dans la barre latérale)', async () => {
    const page = await navigateur.newPage({ viewport: { width: 1440, height: 800 }, locale: 'fr-FR' });
    await page.route('**/api/**', (route) => route.fulfill({ status: 404, json: {} }));
    await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());
    await page.goto(`${url}/standings`);
    await page.locator('aside [role="status"]').first().waitFor();
    const affichee = await page.evaluate(() => {
      const lignes = [...document.querySelectorAll('main [data-testid="ligne-direct"]')];
      return lignes.some((e) => getComputedStyle(e).display !== 'none');
    });
    await page.close();
    expect(affichee).toBe(false);
  });
});

describe('en-tête du classement sous la pastille du direct', () => {
  it('R4 — à 390 px, défilé sous le tableau, chaque cellule de l\'en-tête reste lisible (rien ne la recouvre)', async () => {
    const page = await navigateur.newPage({ viewport: { width: 390, height: 800 }, timezoneId: 'Europe/Paris', locale: 'fr-FR' });
    const table = Array.from({ length: 18 }, (_, i) => ({
      position: i + 1, team: `Club ${i + 1}`, teamId: 1000 + i, played: 9, won: 5, draw: 2, lost: 2,
      goalsFor: 15, goalsAgainst: 9, goalDifference: 6, points: 17 - i,
    }));
    await page.route('**/api/**', (route) => route.fulfill({ status: 404, json: {} }));
    await page.route('**/api/standings', (route) => route.fulfill({ json: { season: '2026-27', updatedAt: new Date().toISOString(), currentMatchday: 9, table } }));
    await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());
    await page.goto(`${url}/standings`);
    await page.locator('thead th').first().waitFor();
    await page.evaluate(() => {
      const haut = document.querySelector('thead')!.getBoundingClientRect().top + scrollY;
      window.scrollTo({ top: haut + 200, behavior: 'instant' });
    });
    const recouverts = await page.evaluate(() =>
      [...document.querySelectorAll('thead th')]
        .filter((th) => getComputedStyle(th).display !== 'none')
        .filter((th) => {
          const r = th.getBoundingClientRect();
          return !th.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2));
        })
        .map((th) => th.textContent),
    );
    const haut = await page.evaluate(() => document.querySelector('thead th')!.getBoundingClientRect().top);
    await page.close();
    expect(recouverts).toEqual([]);
    expect(haut).toBeGreaterThanOrEqual(36);
  });
});

// Match en direct simulé : la pastille porte le score et la minute sur la ligne collante seulement.
const DIRECT = {
  gameId: 4672325, matchupId: '35-465-4672325', competitionId: 35, competitionName: 'Ligue 1', status: 'live',
  statusGroup: 3, statusText: 'Deuxième mi-temps', gameTime: 63, gameTimeDisplay: "63'", startTime: new Date().toISOString(),
  home: { id: 465, name: 'Lyon', symbolicName: 'OL', imageVersion: 1, score: 2 },
  away: { id: 1, name: 'Nice', symbolicName: 'NIC', imageVersion: 1, score: 1 },
};

async function ouvrirEnDirect(largeur: number): Promise<Page> {
  const page = await navigateur.newPage({ viewport: { width: largeur, height: 800 }, timezoneId: 'Europe/Paris', locale: 'fr-FR' });
  // Flux SSE « connecté » : un EventSource factice qui s'ouvre et ne coupe jamais (le 404 de /api/events le mettrait en reconnexion).
  await page.addInitScript(() => {
    class FluxOuvert {
      onopen: (() => void) | null = null;
      onmessage: unknown = null;
      onerror: unknown = null;
      constructor() { setTimeout(() => this.onopen?.(), 0); }
      close() {}
    }
    (window as unknown as { EventSource: unknown }).EventSource = FluxOuvert;
  });
  await page.route('**/api/**', (route) => route.fulfill({ status: 404, json: {} }));
  await page.route('**/api/live-match/current', (route) => route.fulfill({ json: DIRECT }));
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());
  await page.goto(`${url}/standings`);
  return page;
}

describe('pastille du direct pendant un match en cours', () => {
  // Hauteur d'avant le lot (sha 8424ee6, mesurée ici) : 40 px, « Temps réel · / connecté » sur deux lignes dans 192 px.
  // Avec le score et la minute (ca1cfa0) elle passait à 55 px, le score coupé au milieu.
  it('R5 — à 1440 px, la pastille de la barre latérale (192 px) garde sa hauteur d\'avant le lot, sans score ni minute', async () => {
    const page = await ouvrirEnDirect(1440);
    const aside = page.locator('aside [data-testid="pastille-direct"]');
    await aside.locator('.animate-ping').waitFor();
    const m = await aside.evaluate((el) => ({ hauteur: el.getBoundingClientRect().height, texte: el.textContent }));
    await page.close();
    expect(m.texte).toBe('Temps réel · connecté');
    expect(m.hauteur).toBeLessThanOrEqual(40);
  });

  it("R6 — à 390 px, la ligne collante porte « OL 2 · 1 NIC · 63' » sur une ligne, sans défilement horizontal", async () => {
    const page = await ouvrirEnDirect(390);
    const ligne = page.locator('main [data-testid="pastille-direct"]');
    await ligne.locator('.animate-ping').waitFor();
    const m = await ligne.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { hauteur: r.height, right: r.right, texte: el.textContent, largeurDoc: document.documentElement.scrollWidth };
    });
    await page.close();
    expect(m.texte).toContain("OL 2 · 1 NIC · 63'");
    expect(m.hauteur).toBeLessThanOrEqual(30);
    expect(m.right).toBeLessThanOrEqual(390);
    expect(m.largeurDoc).toBeLessThanOrEqual(390);
  });
});
