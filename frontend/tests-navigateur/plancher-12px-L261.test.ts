// L261 — plancher de 12 px mesuré sur la page, pas dans les déclarations (QA du 18-11 sur la prod, après L258).
// `typographie.test.ts` lit le code : il ne voit pas une taille relative (`<sup>` à `font-size: smaller`, un `em` dans
// un texte déjà petit) ni une taille posée par le script (noms de la composition de /match). Ce test parcourt CHAQUE
// page de l'app à 390 et 1440 px dans Chromium et lit `getComputedStyle(el).fontSize` de tout élément qui porte du texte
// visible (boîte de plus de 1 px, `checkVisibility`, hors `sr-only`, qui fait 1 × 1 px).
// Données : réponses réelles de l'API de prod enregistrées le 18-11 (`donnees/api-prod-2026-11-18.json`, même jeu que le
// passage QA : Brest – Lyon et France – Turquie, dont « Çalhanoğlu » descendu à 8 px). Ressources externes refusées.
//
// Exceptions : AUCUNE. L'ancienne exception de L258 (noms d'un mot de la composition de /match jusqu'à 8 px) est levée
// par L261 ; depuis L269, un nom trop large pour la pastille commune élargit la sienne (ses voisines cèdent la place) et
// sa rangée reste sur une ligne ; il ne se coupe en syllabes qu'en dernier recours (`lineup-card.tsx`, `lib/coupure-nom.ts`).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { mkdirSync } from 'node:fs';
import { chromium, type Browser, type Page } from 'playwright';
import { createServer, type ViteDevServer } from 'vite';

type Reponses = Record<string, { status: number; body: unknown }>;
const lire = (nom: string) => JSON.parse(readFileSync(new URL(`./donnees/${nom}`, import.meta.url), 'utf8')) as Reponses;
// L265 : « Ce que ça change » (accueil et page de Brest – Lyon) a ses réponses à part (`_note` du fichier).
// L269 : Lille – Lyon du 21-11 (capture de Sylvain) et sa variante 4-2-3-1, dans `lille-lyon-L269.json`.
const API: Reponses = { ...lire('api-prod-2026-11-18.json'), ...lire('match-impact-L265.json'), ...lire('lille-lyon-L269.json') };
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
  { chemin: '/match/4735207?matchupId=478-523-4735207' }, // Lille – Lyon (L269)
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

// L269 (D-1, capture de Sylvain du 21-11 : défense de Lille – Lyon coupée en 2 + 2 par le quinconce de L261) — une rangée
// de la formation = une ligne à l'écran, toujours. Critères d'acceptation de la fiche du lot : 4-3-3 et 4-2-3-1 de
// Lille – Lyon à 1440, 1366 et 390 px (plus 320, et les deux matchs du 18-11) : chaque rangée sur une seule ligne (même
// haut à 1 px), aucun nom sous 12 px, nom entier dans sa pastille, pastilles disjointes dans le terrain, ordre de gauche
// à droite gardé. Une pastille n'est plus large que la pastille commune que si son nom l'exige.
const COMPOSITIONS = [
  ['Lille – Lyon 4-3-3', '/match/4735207?matchupId=478-523-4735207'],
  ['Lille – Lyon 4-2-3-1', '/match/4735299?matchupId=478-523-4735299'],
  ['Brest – Lyon', '/match/4735215?matchupId=534-465-4735215'],
  ['France – Turquie', '/match/4672282?matchupId=5061-5047-4672282'],
] as const;
describe.each([320, 390, 1366, 1440])('L269 — composition de /match à %i px', (largeur) => {
  it.each(COMPOSITIONS)('%s : chaque rangée sur une ligne, noms à 12 px entiers, pastilles disjointes', async (titre, chemin) => {
    const page = await ouvrir(largeur, chemin);
    try {
      const blocs = await page.$$eval('[data-testid="terrain-composition"]', (terrains) => terrains.map((t) => {
        const tr = t.getBoundingClientRect();
        const rangees = [...t.querySelectorAll('[data-testid="rangee-composition"]')].map((r) => [...r.children].map((c) => {
          const b = c.getBoundingClientRect();
          const nom = c.lastElementChild as HTMLElement;
          const cs = getComputedStyle(c);
          const place = c.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
          return {
            nom: nom.textContent!.replaceAll('\u00AD', ''), coupe: nom.textContent!.includes('\u00AD'),
            police: parseFloat(getComputedStyle(nom).fontSize), l: b.left, r: b.right, t: b.top, b: b.bottom, place,
            deborde: nom.scrollWidth > place + 0.5,
          };
        }));
        // Largeur commune (L43 R7) : (rangée − (n − 1) × 4) / n pour la rangée la plus fournie.
        const larg = Math.max(...rangees.map((r) => r.length));
        const rangee = (t.querySelector('[data-testid="rangee-composition"]') as HTMLElement).clientWidth;
        return { coupe: t.hasAttribute('data-coupe'), commune: (rangee - (larg - 1) * 4) / larg, terrain: { l: tr.left, r: tr.right, t: tr.top, b: tr.bottom }, rangees };
      }));
      expect(blocs).toHaveLength(2);
      if (CAPTURES) {
        const clip = await page.$$eval('[data-testid="bloc-composition"]', (bs) => {
          const r = bs.map((b) => b.getBoundingClientRect());
          const x = Math.min(...r.map((b) => b.left)), y = Math.min(...r.map((b) => b.top)) + window.scrollY;
          return { x, y, width: Math.max(...r.map((b) => b.right)) - x, height: Math.max(...r.map((b) => b.bottom)) + window.scrollY - y };
        });
        await page.screenshot({ path: `${CAPTURES}/L269-${largeur}-${titre.replace(/[^A-Za-z0-9-]+/g, '_')}.png`, fullPage: true, clip });
      }
      for (const { terrain, rangees, commune } of blocs) {
        const toutes = rangees.flat();
        expect(toutes).toHaveLength(11);
        const fautes: string[] = [];
        for (const r of rangees) {
          if (Math.max(...r.map((p) => p.t)) - Math.min(...r.map((p) => p.t)) > 1) fautes.push(`rangée ${r.map((p) => p.nom).join(' / ')} sur plusieurs lignes`);
          for (let k = 1; k < r.length; k++) if (r[k].l < r[k - 1].r - 0.5) fautes.push(`${r[k].nom} pas à droite de ${r[k - 1].nom}`);
        }
        for (const p of toutes) {
          if (p.police < 12) fautes.push(`${p.nom} à ${p.police} px`);
          if (p.deborde) fautes.push(`${p.nom} déborde de sa pastille`);
          if (p.l < terrain.l - 0.5 || p.r > terrain.r + 0.5 || p.t < terrain.t - 0.5 || p.b > terrain.b + 0.5) fautes.push(`${p.nom} hors du terrain`);
          for (const q of toutes) {
            if (q !== p && Math.min(p.r, q.r) - Math.max(p.l, q.l) > 0.5 && Math.min(p.b, q.b) - Math.max(p.t, q.t) > 0.5) fautes.push(`${p.nom} recouvre ${q.nom}`);
          }
        }
        // Une rangée non pleine garde la largeur commune pour tous ses noms qui y tiennent.
        for (const r of rangees) {
          const large = r.some((p) => p.r - p.l > commune + 1);
          if (!large) for (const p of r) if (Math.abs(p.r - p.l - commune) > 1) fautes.push(`${p.nom} : ${(p.r - p.l).toFixed(1)} px au lieu de ${commune.toFixed(1)}`);
        }
        expect(fautes).toEqual([]);
      }
      // Lille – Lyon : la place des noms se trouve sans les couper, à toute largeur testée (dernier recours inutile).
      if (titre.startsWith('Lille')) expect(blocs.flatMap((b) => b.rangees.flat()).filter((p) => p.coupe).map((p) => p.nom)).toEqual([]);
    } finally { await page.close(); }
  });
});

// L269 (revue de code, m1) — le dernier recours rendu pour de vrai. Aucune composition réelle ne le déclenche : variante
// FICTIVE de Lille – Lyon (gameId 4735301), la défense de Lille renommée en quatre noms longs d'un seul mot. Attendu : la
// rangée reste sur une ligne, les noms gardent 12 px, ne débordent pas, et ceux qu'il faut se coupent entre deux syllabes
// (césure douce U+00AD, rendue en trait d'union, nom sur plusieurs lignes) ; `data-coupe` sur le terrain.
const LONGS = ['Papastathopoulos', 'Kristoffersen', 'Omobamidele', 'Abdelhamid'];
{
  const vrai = API['/api/live-match/4735207/stats?matchupId=478-523-4735207'];
  const body = structuredClone(vrai.body) as { gameId: number; lineups: { home: { starters: { shortName: string; yardLine: number }[] } } };
  body.gameId = 4735301;
  body.lineups.home.starters.filter((p) => p.yardLine === 2).forEach((p, k) => { p.shortName = LONGS[k]; });
  API['/api/live-match/4735301/stats?matchupId=478-523-4735301'] = { status: 200, body };
}
describe.each([320, 390, 1440])('L269 — dernier recours de la composition à %i px', (largeur) => {
  it('défense de quatre noms longs : une ligne, 12 px, noms coupés en syllabes sans débordement', async () => {
    const page = await ouvrir(largeur, '/match/4735301?matchupId=478-523-4735301');
    try {
      const terrain = page.locator('[data-testid="terrain-composition"]').filter({ hasText: 'Kristof' });
      expect(await terrain.getAttribute('data-coupe')).toBe('true');
      const rangee = terrain.locator('[data-testid="rangee-composition"]').filter({ hasText: 'Kristof' });
      const pastilles = await rangee.evaluate((r) => [...r.children].map((c) => {
        const nom = c.lastElementChild as HTMLElement;
        const cs = getComputedStyle(c);
        const place = c.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
        const lignes = new Set([...nom.getClientRects()].map((x) => Math.round(x.top))).size;
        const range = document.createRange();
        range.selectNodeContents(nom);
        return {
          nom: nom.textContent!.replaceAll('­', ''), coupe: nom.textContent!.includes('­'),
          lignesTexte: new Set([...range.getClientRects()].map((x) => Math.round(x.top))).size, lignes,
          police: parseFloat(getComputedStyle(nom).fontSize), haut: c.getBoundingClientRect().top, deborde: nom.scrollWidth > place + 0.5,
        };
      }));
      if (CAPTURES) await terrain.screenshot({ path: `${CAPTURES}/L269-dernier-recours-${largeur}.png` });
      expect(pastilles.map((p) => p.nom)).toEqual(LONGS);
      expect(Math.max(...pastilles.map((p) => p.haut)) - Math.min(...pastilles.map((p) => p.haut))).toBeLessThanOrEqual(1);
      for (const p of pastilles) {
        expect(p.police, p.nom).toBe(12);
        expect(p.deborde, p.nom).toBe(false);
      }
      const coupes = pastilles.filter((p) => p.coupe);
      expect(coupes.length).toBeGreaterThan(0);
      // Un nom coupé passe vraiment à la ligne (le navigateur a utilisé au moins une césure).
      expect(coupes.some((p) => p.lignesTexte > 1)).toBe(true);
    } finally { await page.close(); }
  });
});

// L265 — le plancher ci-dessus ne vaut pour « Ce que ça change » que si le bloc est rendu : badge « Provisoire »
// (`text-petite`) et ligne des matchs restants (`text-xs`) sur la page de Brest – Lyon, phrase seule à l'accueil.
describe.each([390, 1440])('L265 — « Ce que ça change » rendu et mesuré à %i px', (largeur) => {
  it.each([
    ['/', false],
    ['/match/4735215?matchupId=534-465-4735215', true],
  ] as const)('%s', async (chemin, provisoire) => {
    const page = await ouvrir(largeur, chemin);
    try {
      await page.getByTestId('ce-que-ca-change-phrase').waitFor();
      expect(await page.getByTestId('ce-que-ca-change-provisoire').count()).toBe(provisoire ? 1 : 0);
      const tailles = await page.getByTestId('ce-que-ca-change').evaluate((bloc) =>
        [...bloc.querySelectorAll('*')].filter((e) => [...e.childNodes].some((c) => c.nodeType === 3 && c.textContent!.trim()))
          .map((e) => parseFloat(getComputedStyle(e).fontSize)));
      expect(tailles.length).toBeGreaterThanOrEqual(provisoire ? 4 : 2);
      expect(Math.min(...tailles)).toBeGreaterThanOrEqual(12);
    } finally { await page.close(); }
  });
});
