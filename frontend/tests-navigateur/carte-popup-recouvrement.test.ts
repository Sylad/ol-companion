// L195 (reprise) — rien ne recouvre le × ni l'en-tête de la fiche d'un club, aux cinq largeurs, pour les 18 clubs
// ouverts au clavier. Mesure par la GÉOMÉTRIE des éléments qui flottent sur la carte (boutons de zoom, Recentrer,
// attribution, légende) : `elementFromPoint` traverse ce qui a `pointer-events: none` (la légende l'avait), il ne
// sert ici que de filet pour un élément inattendu (barre collée, bandeau…).
// API et tuiles refusées, serveur Vite démarré par le test.
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

describe.each([[1440, 900], [1024, 768], [768, 900], [390, 844], [320, 640]])('Fiche de la Carte L1 à %i×%i — rien ne la recouvre (L195)', (largeur, hauteur) => {
  it('R7 — pour les 18 clubs ouverts au clavier, le × et l’en-tête sont entiers dans la carte et sous aucune légende, aucun contrôle', async () => {
    const page = await ouvrir(largeur, hauteur);
    const clubs = await page.$$eval('.leaflet-marker-icon', (els) => els.map((el) => (el as HTMLElement).title));
    expect(clubs).toHaveLength(18);
    const fautes: string[] = [];
    for (const club of clubs) {
      await page.locator(`.leaflet-marker-icon[title="${club}"]`).focus();
      await page.keyboard.press('Enter');
      await page.waitForSelector('.leaflet-popup');
      await page.waitForTimeout(600); // fin du recalage automatique
      const m = await page.evaluate(() => {
        const rect = (el: Element | null) => {
          const r = el!.getBoundingClientRect();
          return { l: r.left, t: r.top, r: r.right, b: r.bottom };
        };
        type R = ReturnType<typeof rect>;
        const touche = (a: R, b: R) => a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;
        const dans = (a: R, c: R) => a.l >= c.l && a.r <= c.r && a.t >= c.t && a.b <= c.b;
        const carte = rect(document.querySelector('.leaflet-container'));
        const croix = rect(document.querySelector('.leaflet-popup-close-button'));
        const entete = rect(document.querySelector('.leaflet-popup-content header'));
        // Tout ce qui peut flotter sur la carte : les contrôles Leaflet, et la légende quel que soit l'endroit où elle est posée.
        const flottants: Array<[string, R]> = [];
        for (const el of document.querySelectorAll('.leaflet-control-zoom, .leaflet-bottom.leaflet-left .leaflet-control, .leaflet-control-attribution, [aria-label="Légende des marqueurs"]')) {
          const nom = el.getAttribute('aria-label') ?? el.className.toString().split(' ').slice(0, 2).join('.');
          const r = rect(el);
          if (r.r - r.l > 0 && r.b - r.t > 0) flottants.push([nom, r]);
        }
        const recouverts: string[] = [];
        for (const [nom, r] of flottants) {
          if (touche(croix, r)) recouverts.push(`× sous ${nom}`);
          if (touche(entete, r)) recouverts.push(`en-tête sous ${nom}`);
        }
        // Filet : ce que le navigateur trouve réellement aux quatre coins et au centre du × et de l'en-tête.
        const fiche = document.querySelector('.leaflet-popup')!;
        for (const [nom, r] of [['×', croix], ['en-tête', entete]] as const) {
          for (const [x, y] of [[r.l + 1, r.t + 1], [r.r - 1, r.t + 1], [r.l + 1, r.b - 1], [r.r - 1, r.b - 1], [(r.l + r.r) / 2, (r.t + r.b) / 2]]) {
            const haut = document.elementFromPoint(x, y);
            if (!haut || !fiche.contains(haut)) recouverts.push(`${nom} : ${haut ? haut.tagName + '.' + String(haut.className).slice(0, 40) : 'rien'} en (${Math.round(x)},${Math.round(y)})`);
          }
        }
        return {
          croixDansCarte: dans(croix, carte),
          enteteDansCarte: dans(entete, carte),
          croixVisible: croix.r - croix.l > 0 && croix.b - croix.t > 0,
          recouverts,
          nombreFlottants: flottants.length,
        };
      });
      if (!(m.croixDansCarte && m.enteteDansCarte && m.croixVisible && m.recouverts.length === 0)) fautes.push(`${club} ${JSON.stringify(m)}`);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(400);
    }
    await page.close();
    expect(fautes).toEqual([]);
  });
});

describe('Clavier de la fiche dans Chromium (L195)', () => {
  it('R8 — Échap ferme la fiche de Lens depuis le marqueur de Troyes (Maj+Tab depuis le ×) et rend le focus à Lens', async () => {
    const page = await ouvrir(1440, 900);
    await page.locator('.leaflet-marker-icon[title="Lens"]').focus();
    await page.keyboard.press('Enter');
    await page.waitForSelector('.leaflet-popup');
    await page.waitForTimeout(600);
    // Le focus quitte la fiche : on le met sur un autre marqueur, comme le ferait Maj+Tab depuis le ×.
    await page.locator('.leaflet-marker-icon[title="Troyes"]').focus();
    expect(await page.evaluate(() => !!document.activeElement?.closest('.leaflet-popup'))).toBe(false);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    expect(await page.locator('.leaflet-popup').count()).toBe(0);
    expect(await page.evaluate(() => (document.activeElement as HTMLElement | null)?.title)).toBe('Lens');
    await page.close();
  });

  it('R9 — après quatre ouvertures, Échap rend le focus au marqueur une seule fois, et le × aussi', async () => {
    const page = await ouvrir(1440, 900);
    // Compte les focus() posés sur le marqueur de Lens.
    await page.evaluate(() => {
      const icone = document.querySelector<HTMLElement>('.leaflet-marker-icon[title="Lens"]')!;
      const w = window as unknown as { __focus: number };
      w.__focus = 0;
      const origine = icone.focus.bind(icone);
      icone.focus = (...a: Parameters<HTMLElement['focus']>) => {
        w.__focus += 1;
        origine(...a);
      };
    });
    const lens = page.locator('.leaflet-marker-icon[title="Lens"]');
    for (let i = 0; i < 4; i++) {
      await lens.focus();
      await page.keyboard.press('Enter');
      await page.waitForSelector('.leaflet-popup');
      await page.waitForTimeout(300);
      if (i < 3) {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(400);
      }
    }
    await page.evaluate(() => {
      (window as unknown as { __focus: number }).__focus = 0;
    });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    expect(await page.evaluate(() => (window as unknown as { __focus: number }).__focus)).toBe(1);
    // Le × : même nombre.
    await lens.focus();
    await page.keyboard.press('Enter');
    await page.waitForSelector('.leaflet-popup');
    await page.waitForTimeout(300);
    expect(await page.locator('.leaflet-popup-close-button').getAttribute('aria-label')).toBe('Fermer la fiche');
    await page.evaluate(() => {
      (window as unknown as { __focus: number }).__focus = 0;
    });
    await page.locator('.leaflet-popup-close-button').click();
    await page.waitForTimeout(400);
    expect(await page.evaluate(() => (window as unknown as { __focus: number }).__focus)).toBe(1);
    await page.close();
  });
});
