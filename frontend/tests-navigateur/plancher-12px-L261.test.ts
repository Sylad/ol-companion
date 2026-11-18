// L261 — plancher de 12 px mesuré sur la page, pas dans les déclarations (QA du 18-11 sur la prod, après L258).
// `typographie.test.ts` lit le code : il ne voit pas une taille relative (`<sup>` à `font-size: smaller`, un `em` dans
// un texte déjà petit) ni une taille posée par le script (noms de la composition de /match). Ce test parcourt CHAQUE
// page de l'app à 390 et 1440 px dans Chromium et lit `getComputedStyle(el).fontSize` de tout élément qui porte du texte
// visible (boîte de plus de 1 px, `checkVisibility`, hors `sr-only`, qui fait 1 × 1 px).
// Données : réponses réelles de l'API de prod enregistrées le 18-11 (`donnees/api-prod-2026-11-18.json`, même jeu que le
// passage QA : Brest – Lyon et France – Turquie, dont « Çalhanoğlu » descendu à 8 px). Ressources externes refusées.
//
// Exceptions : AUCUNE. L'ancienne exception de L258 (noms d'un mot de la composition de /match jusqu'à 8 px) est levée
// par L261 : un nom trop large pour sa pastille ne rétrécit plus, sa rangée passe en quinconce (`lineup-card.tsx`).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { mkdirSync } from 'node:fs';
import { chromium, type Browser, type Page } from 'playwright';
import { createServer, type ViteDevServer } from 'vite';

const API = JSON.parse(readFileSync(new URL('./donnees/api-prod-2026-11-18.json', import.meta.url), 'utf8')) as Record<string, { status: number; body: unknown }>;
const CAPTURES = process.env.CAPTURES_DIR;

let serveur: ViteDevServer;
let navigateur: Browser;
let url: string;

beforeAll(async () => {
  serveur = await createServer({ configFile: new URL('../vite.config.ts', import.meta.url).pathname, server: { port: 0, host: '127.0.0.1' }, logLevel: 'silent' });
  await serveur.listen();
  url = `http://127.0.0.1:${(serveur.httpServer!.address() as { port: number }).port}`;
  navigateur = await chromium.launch();
  if (CAPTURES) mkdirSync(CAPTURES, { recursive: true });
});
afterAll(async () => {
  await navigateur?.close();
  await serveur?.close();
});

/** Les 16 pages des attendus QA (docs/qa/expectations.md), avec les paramètres du passage QA du 18-11. */
const PAGES: { chemin: string; onglets?: string[] }[] = [
  { chemin: '/' },
  { chemin: '/fixtures' },
  { chemin: '/standings' },
  { chemin: '/news' },
  { chemin: '/cups' },
  { chemin: '/players', onglets: ['Effectif', 'Stats saison'] },
  { chemin: '/player/2185' },
  { chemin: '/fcnoobz' },
  { chemin: '/fcnoobz/jeux-video' },
  { chemin: '/about' },
  { chemin: '/nouveautes' },
  { chemin: '/plan' },
  { chemin: '/match/4735215?matchupId=534-465-4735215' }, // Brest – Lyon
  { chemin: '/match/4672282?matchupId=5061-5047-4672282' }, // France – Turquie
  { chemin: '/map' },
  { chemin: '/equipe-de-france' },
  { chemin: '/match' }, // 404
];

async function ouvrir(largeur: number, chemin: string): Promise<Page> {
  const page = await navigateur.newPage({ viewport: { width: largeur, height: 900 }, timezoneId: 'Europe/Paris', locale: 'fr-FR' });
  // Le jour du passage QA : « à venir », « terminé », comptes à rebours lus comme en prod ce jour-là.
  await page.clock.setFixedTime(new Date('2026-11-18T13:10:00+01:00'));
  await page.route('**/api/**', (route) => {
    const u = new URL(route.request().url());
    const r = API[u.pathname + u.search];
    return r ? route.fulfill({ status: r.status, json: r.body }) : route.fulfill({ status: 404, json: {} });
  });
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());
  await page.goto(`${url}${chemin}`);
  await page.locator('h1').first().waitFor();
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300); // mesures du script (ResizeObserver) après le dernier rendu
  return page;
}

/** Texte visible sous 12 px : « texte (taille) ». */
const petitsTextes = (page: Page) => page.evaluate(() => [...document.querySelectorAll('body *')]
  .filter((e) => [...e.childNodes].some((c) => c.nodeType === 3 && c.textContent!.trim()))
  .filter((e) => {
    const r = e.getBoundingClientRect();
    return r.width > 1 && r.height > 1 && e.checkVisibility({ opacityProperty: true, visibilityProperty: true });
  })
  .filter((e) => parseFloat(getComputedStyle(e).fontSize) < 12)
  .map((e) => `${e.tagName.toLowerCase()} « ${e.textContent!.trim().slice(0, 30)} » (${getComputedStyle(e).fontSize})`));

describe.each([390, 1440])('L261 — à %i px, aucun texte visible sous 12 px de taille calculée', (largeur) => {
  it.each(PAGES.map((p) => [p.chemin, p] as const))('%s', async (_, { chemin, onglets }) => {
    const page = await ouvrir(largeur, chemin);
    try {
      const fautes: string[] = [];
      const nombre = await page.evaluate(() => document.querySelectorAll('body *').length);
      expect(nombre, 'la page a rendu son contenu').toBeGreaterThan(50);
      fautes.push(...await petitsTextes(page));
      for (const onglet of onglets ?? []) {
        await page.getByRole('tab', { name: onglet }).click();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(300);
        fautes.push(...(await petitsTextes(page)).map((f) => `[${onglet}] ${f}`));
      }
      if (CAPTURES) await page.screenshot({ path: `${CAPTURES}/L261-${largeur}${chemin.split('?')[0].replace(/\//g, '_') || '_'}.png`, fullPage: true });
      expect(fautes).toEqual([]);
    } finally { await page.close(); }
  });
});

// L261 — quinconce de la composition : pastilles de même largeur, deux à deux disjointes, dans le terrain ; nom entier
// dans sa pastille (jamais coupé en milieu de mot, règle L43) ; ordre de gauche à droite gardé dans chaque rangée.
describe.each([320, 390, 1440])('L261 — composition de /match à %i px', (largeur) => {
  it.each([
    ['Brest – Lyon', '/match/4735215?matchupId=534-465-4735215'],
    ['France – Turquie', '/match/4672282?matchupId=5061-5047-4672282'],
  ])('%s : noms à 12 px, pastilles disjointes dans le terrain', async (_, chemin) => {
    const page = await ouvrir(largeur, chemin);
    try {
      const blocs = await page.$$eval('[data-testid="terrain-composition"]', (terrains) => terrains.map((t) => {
        const tr = t.getBoundingClientRect();
        const rangees = [...t.querySelectorAll('[data-testid="rangee-composition"]')].map((r) => [...r.children].map((c) => {
          const b = c.getBoundingClientRect();
          const nom = c.lastElementChild as HTMLElement;
          const cs = getComputedStyle(c);
          return {
            nom: nom.textContent!, police: parseFloat(getComputedStyle(nom).fontSize), l: b.left, r: b.right, t: b.top, b: b.bottom,
            deborde: nom.scrollWidth > c.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) + 0.5,
          };
        }));
        return { quinconce: t.hasAttribute('data-quinconce'), terrain: { l: tr.left, r: tr.right, t: tr.top, b: tr.bottom }, rangees };
      }));
      expect(blocs).toHaveLength(2);
      for (const { terrain, rangees } of blocs) {
        const toutes = rangees.flat();
        expect(toutes).toHaveLength(11);
        const fautes: string[] = [];
        for (const p of toutes) {
          if (p.police < 12) fautes.push(`${p.nom} à ${p.police} px`);
          if (p.deborde) fautes.push(`${p.nom} déborde de sa pastille`);
          if (p.l < terrain.l - 0.5 || p.r > terrain.r + 0.5 || p.t < terrain.t - 0.5 || p.b > terrain.b + 0.5) fautes.push(`${p.nom} hors du terrain`);
          for (const q of toutes) {
            if (q !== p && Math.min(p.r, q.r) - Math.max(p.l, q.l) > 0.5 && Math.min(p.b, q.b) - Math.max(p.t, q.t) > 0.5) fautes.push(`${p.nom} recouvre ${q.nom}`);
          }
        }
        expect(new Set(toutes.map((p) => Math.round((p.r - p.l) * 2) / 2)).size, 'même largeur pour toutes les pastilles').toBe(1);
        for (const r of rangees) for (let k = 1; k < r.length; k++) if (r[k].l <= r[k - 1].l) fautes.push(`${r[k].nom} pas à droite de ${r[k - 1].nom}`);
        expect(fautes).toEqual([]);
      }
      // Le cas de la QA : à 1440, la Turquie (5 défenseurs, « Çalhanoğlu ») passe en quinconce.
      if (largeur === 1440 && chemin.includes('5061')) expect(blocs.some((b) => b.quinconce)).toBe(true);
    } finally { await page.close(); }
  });
});
