// L275 — marqueurs de la carte L1 à ≥ 3:1 de leurs voisins (WCAG 1.4.11), sur les tuiles OSM claires comme sur le
// fond sombre. Revue UX de L272 (27-11) : le gris du nul mesurait 2,25 à 2,38:1 sur les tuiles claires et le contour
// blanc 1,3 à 2,4:1 ; les teintes n'avaient été calibrées que pour le fond sombre.
//
// Mesure sur CAPTURE, pas sur les constantes : pour chaque marqueur, les pixels de la tuile voisine (médiane d'un
// cercle à 6 px du bord), le profil de 24 rayons qui traversent le bord (le contour doit tenir ≥ 3:1 sur chaque
// rayon) et un pixel au milieu de chaque moitié (≥ 3:1 sur la tuile pour V, N, D). Les tuiles sont servies en aplats
// des couleurs d'osm-carto (terre, la plus claire ; mer et forêt, les plus sombres des grandes surfaces) ; le fond
// sombre est celui de la carte sans tuile. La légende est mesurée sur la même capture : chaque moitié de pastille a la
// couleur que la carte dessine pour ce résultat (règle des cartes : la légende correspond au rendu).
// `CAPTURES_L275=<dossier>` enregistre une capture par fond ; `TUILES_REELLES=1` laisse passer les vraies tuiles OSM
// (réseau, hors CI) pour une mesure sur la carte telle qu'on la voit.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, type Browser } from 'playwright';
import { createServer, type ViteDevServer } from 'vite';
import { MAP_DARK_BACKGROUND, OSM_TILE_FILLS, RESULT_COLORS, type MapResult } from '../src/lib/ligue1-map-colors';
import { contrastRatio, parseHsl, type Rgb } from '../src/lib/contrast';

type Reponses = Record<string, { status: number; body: unknown }>;
const API = JSON.parse(readFileSync(new URL('./donnees/api-prod-2026-11-18.json', import.meta.url), 'utf8')) as Reponses;

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

type Px = [number, number, number];
interface Releve {
  nom: string;
  /** Moitiés (couleur source lue dans le SVG) ; vide pour l'OL. */
  moities: { source: string; pixel: Px }[];
  tuile: Px;
  rayons: Px[][];
}

const rgb = (p: Px): Rgb => p.map((c) => c / 255) as Rgb;
const resultatDe = (source: string) => (Object.entries(RESULT_COLORS) as [MapResult, string][]).find(([, c]) => c === source)?.[0];
const ecart = (a: Px, b: Px) => Math.max(...a.map((c, i) => Math.abs(c - b[i])));

/** Relève, sur la capture décodée dans la page, les pixels utiles de chaque rond (marqueurs, ou pastilles de la légende). */
async function relever(page: import('playwright').Page, selecteur: string): Promise<Releve[]> {
  const png = (await page.screenshot({ fullPage: true })).toString('base64');
  return page.evaluate(async ({ png, selecteur }) => {
    const img = new Image();
    img.src = `data:image/png;base64,${png}`;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    const { data, width } = ctx.getImageData(0, 0, img.width, img.height);
    const px = (x: number, y: number): [number, number, number] => {
      const i = (Math.round(y) * width + Math.round(x)) * 4;
      return [data[i], data[i + 1], data[i + 2]];
    };
    const ronds = [...document.querySelectorAll<HTMLElement>(selecteur)].map((el) => {
      // Rond dessiné : le svg d'un club, la pastille de l'OL (span dans la zone de toucher, ou dans la pastille de légende).
      const dessin = (el.querySelector('svg') ?? el.querySelector('span > span')) as HTMLElement;
      const r = dessin.getBoundingClientRect();
      return {
        nom: el.title || el.parentElement?.textContent || '',
        x: r.left + r.width / 2 + window.scrollX,
        y: r.top + r.height / 2 + window.scrollY,
        d: r.width,
        fills: [...dessin.querySelectorAll('path')].map((p) => p.getAttribute('fill') ?? ''),
        // Le halo de l'OL (anneau sombre de 2 px, lueur de 12 px) fait partie du marqueur : la tuile se
        // lit au-delà, et le profil des rayons va jusqu'à l'anneau sombre, posé hors de la pastille.
        halo: dessin.tagName === 'svg' ? 0 : 12,
      };
    });
    return ronds.map((rond) => {
      const R = rond.d / 2;
      const voisins = ronds.filter((o) => o !== rond);
      const tuiles: [number, number, number][] = [];
      for (let k = 0; k < 48; k++) {
        const a = (k / 48) * 2 * Math.PI;
        const x = rond.x + Math.cos(a) * (R + 6 + rond.halo);
        const y = rond.y + Math.sin(a) * (R + 6 + rond.halo);
        if (voisins.some((o) => Math.hypot(o.x - x, o.y - y) < o.d / 2 + 6 + o.halo)) continue;
        tuiles.push(px(x, y));
      }
      tuiles.sort((p, q) => p[0] + p[1] + p[2] - (q[0] + q[1] + q[2]));
      const rayons: [number, number, number][][] = [];
      for (let k = 0; k < 24; k++) {
        const a = (k / 24) * 2 * Math.PI;
        const profil: [number, number, number][] = [];
        for (let t = R - 3; t <= R + 1 + (rond.halo ? 2 : 0); t += 0.5) profil.push(px(rond.x + Math.cos(a) * t, rond.y + Math.sin(a) * t));
        rayons.push(profil);
      }
      // Milieu de chaque moitié, au-dessus du motif : (±5 ; −7,5) unités du repère 28×28.
      const u = rond.d / 28;
      const moities = rond.fills.map((source, i) => ({ source, pixel: px(rond.x + (i === 0 ? -5 : 5) * u, rond.y - 7.5 * u) }));
      return { nom: rond.nom, moities, tuile: tuiles[Math.floor(tuiles.length / 2)], rayons };
    });
  }, { png, selecteur });
}

const tuileSvg = (couleur: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="${couleur}"/></svg>`;

const FONDS: [string, string | null][] = process.env.TUILES_REELLES
  ? [['tuiles OSM réelles', 'reelles']]
  : [
      ['fond sombre (sans tuile)', null],
      ['tuile terre', OSM_TILE_FILLS.terre],
      ['tuile mer', OSM_TILE_FILLS.mer],
      ['tuile forêt', OSM_TILE_FILLS.foret],
    ];

/** Ouvre /map à cette taille, tuiles servies sur ce fond (null : aucune, « reelles » : OSM), et relève carte et légende. */
async function releverCarte(largeur: number, hauteur: number, tuile: string | null) {
  const page = await navigateur.newPage({ viewport: { width: largeur, height: hauteur }, timezoneId: 'Europe/Paris', locale: 'fr-FR' });
  // Heure qui avance (pas setFixedTime) : le fondu d'entrée des tuiles de Leaflet suit l'horloge, figée il reste à 0.
  await page.clock.install({ time: new Date('2026-11-18T13:10:00+01:00') });
  await page.clock.resume();
  await page.route('**/api/**', (route) => {
    const u = new URL(route.request().url());
    const r = API[u.pathname + u.search];
    return r ? route.fulfill({ status: r.status, json: r.body }) : route.fulfill({ status: 404, json: {} });
  });
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => {
    const estTuile = /tile\.openstreetmap\.org/.test(route.request().url());
    if (estTuile && tuile === 'reelles') return route.continue();
    if (estTuile && tuile) return route.fulfill({ status: 200, contentType: 'image/svg+xml', body: tuileSvg(tuile) });
    return route.abort();
  });
  await page.goto(`${url}/map`);
  await page.waitForSelector('.leaflet-marker-icon');
  if (tuile) await page.waitForFunction(() => document.querySelectorAll('.leaflet-tile-loaded').length > 4 && !document.querySelector('.leaflet-tile:not(.leaflet-tile-loaded)'));
  await page.waitForTimeout(800);
  const carte = await relever(page, '.leaflet-marker-icon');
  const legende = await relever(page, '[aria-label="Légende des marqueurs"] span[aria-hidden]');
  const surface = await page.$eval('[aria-label="Légende des marqueurs"]', (e) => getComputedStyle(e).backgroundColor);
  const dossier = process.env.CAPTURES_L275;
  if (dossier) {
    const nom = (tuile === null ? 'sombre' : tuile === 'reelles' ? 'osm' : Object.entries(OSM_TILE_FILLS).find(([, c]) => c === tuile)![0]);
    await page.screenshot({ path: join(dossier, `carte-${largeur}-${nom}.png`), fullPage: true });
    // La carte et sa légende seules (capture d'élément : défilée dans la vue, sans la jointure de la capture pleine page).
    await page.locator('[aria-label="Légende des marqueurs"]').locator('..').screenshot({ path: join(dossier, `carte-seule-${largeur}-${nom}.png`) });
  }
  await page.close();
  return { carte, legende, surface };

}

/** Contour et moitiés de chaque marqueur contre sa tuile voisine ; rend la couleur relevée de chaque résultat. */
function verifierCarte(carte: Releve[], fond: string, largeur: number): Map<MapResult, Px> {
  expect(carte).toHaveLength(18);
  const lignes: string[] = [];
  const vus = new Map<MapResult, Px>();
  for (const m of carte) {
    // Contour : sur chaque rayon qui traverse le bord, un pixel du rond se détache de la tuile à ≥ 3:1.
    const pireRayon = Math.min(...m.rayons.map((profil) => Math.max(...profil.map((p) => contrastRatio(rgb(p), rgb(m.tuile))))));
    const moities = m.moities.map(({ source, pixel }) => {
      const resultat = resultatDe(source)!;
      expect(resultat, `${m.nom} : couleur ${source} hors de RESULT_COLORS`).toBeDefined();
      // Le pixel est bien la teinte de la source (pas un mélange avec le motif ou le contour).
      expect(ecart(pixel, parseHsl(source).map((c) => Math.round(c * 255)) as Px), `${m.nom} ${resultat}`).toBeLessThanOrEqual(3);
      vus.set(resultat, pixel);
      return { resultat, ratio: contrastRatio(rgb(pixel), rgb(m.tuile)) };
    });
    lignes.push(`${m.nom} tuile rgb(${m.tuile}) contour ${pireRayon.toFixed(2)} ${moities.map((h) => `${h.resultat} ${h.ratio.toFixed(2)}`).join(' ')}`);
    expect(pireRayon, `${m.nom} : contour sur ${fond}`).toBeGreaterThanOrEqual(3);
    for (const h of moities) {
      // « Pas encore joué » est sombre par nature : sur le fond sombre, seul le contour le détache (anneau clair).
      if (h.resultat !== 'FUTURE') expect(h.ratio, `${m.nom} ${h.resultat} sur ${fond}`).toBeGreaterThanOrEqual(3);
    }
  }
  console.log(`L275 ${largeur} px, ${fond} :\n  ${lignes.join('\n  ')}`);

  return vus;
}

/** Pastilles de la légende sur son fond, et chaque moitié de la couleur que la carte dessine pour ce résultat. */
function verifierLegende(legende: Releve[], surface: string, vus: Map<MapResult, Px>) {
  // Légende : 4 pastilles de club + l'OL, sur le fond de la légende (surface sombre) ; chaque moitié a la couleur
  // que la carte dessine pour le même résultat.
  expect(legende).toHaveLength(5);
  const fondLegende = (surface.match(/\d+/g) ?? []).slice(0, 3).map(Number) as Px;
  for (const p of legende) {
    const pireRayon = Math.min(...p.rayons.map((profil) => Math.max(...profil.map((q) => contrastRatio(rgb(q), rgb(fondLegende))))));
    expect(pireRayon, `légende ${p.nom}`).toBeGreaterThanOrEqual(3);
    for (const { source, pixel } of p.moities) {
      const resultat = resultatDe(source)!;
      expect(resultat, `légende ${p.nom}`).toBeDefined();
      const surCarte = vus.get(resultat);
      if (surCarte) expect(ecart(pixel, surCarte), `légende ${p.nom} = carte ${resultat}`).toBeLessThanOrEqual(3);
    }
  }
}

describe.each([[1440, 900], [390, 844]])('Carte L1 à %i×%i : contraste des marqueurs (L275)', (largeur, hauteur) => {
  it.each(FONDS)('%s : contour et moitiés V, N, D à ≥ 3:1 de la tuile voisine, légende de la couleur du rendu', async (fond, tuile) => {
    const { carte, legende, surface } = await releverCarte(largeur, hauteur, tuile);
    const vus = verifierCarte(carte, fond, largeur);
    verifierLegende(legende, surface, vus);
    expect([...vus.keys()].sort(), 'résultats présents sur la carte du 18-11').toEqual(['D', 'FUTURE', 'L', 'W']);
    // Le fond sombre mesuré est bien celui de la carte.
    if (tuile === null) {
      const attendu = [1, 3, 5].map((i) => parseInt(MAP_DARK_BACKGROUND.slice(i, i + 2), 16)) as Px;
      for (const m of carte) expect(ecart(m.tuile, attendu), m.nom).toBeLessThanOrEqual(2);
    }
  });
});
