// L272/t1 — les zones de toucher de la carte L1 suivent le zoom (ClubMarkers, écouteurs `zoomanim` et `zoomend`) :
// après trois zooms avant puis trois zooms arrière (boutons + et −), à 390 et 1440 px, la zone de chaque club vaut
// `hitSizesAtZoom` du zoom courant, jamais moins de 24 px, et deux zones ne se coupent jamais, pendant l'animation
// (mesure à chaque image tant que le panneau de la carte porte `leaflet-zoom-anim`) comme après.
// Le zoom de la carte n'est pas lu dans le code de l'app : il est retrouvé à partir des positions des 18 marqueurs
// (`markerCentre`, pas de 0,25), puis comparé au zoom attendu (ouverture ± le nombre de crans).
// Contre-épreuve faite le 27-11 (ligue1-map.tsx, `map.on` commentés) : sans `zoomend` (ou sans les deux), les zones gardent
// leur taille d'ouverture (1440 : Lens 38 au lieu de 44 au zoom 7) ; sans `zoomanim`, pendant un zoom arrière les zones
// gardent la taille du zoom de départ et se coupent (1440 : Paris FC / PSG, 1,2 px ; 390 : Monaco / Nice, 3,3 px).
// Les deux largeurs échouent dans les trois cas.
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

interface Zone {
  club: string;
  x: number;
  y: number;
  /** Côté de la zone en px CSS (`offsetWidth` : sans les fractions de pixel du déplacement animé). */
  cote: number;
  hauteur: number;
}

/** Une photo des 18 zones : le zoom retrouvé par les positions et la taille attendue de chaque club à ce zoom. */
interface Photo {
  zones: Zone[];
  zoom: number;
  /** Écart moyen (px) entre les positions mesurées et celles de `markerCentre` au zoom retrouvé. */
  ecartPositions: number;
  /** Taille attendue de chaque club (par nom) pour chaque zoom demandé. */
  attendues: Record<string, Record<string, number>>;
}

/** Mesure les zones, retrouve le zoom (positions relatives à Lyon, qui ne bouge jamais) et calcule les tailles attendues. */
async function photo(page: Page, zoomsAttendus: number[]): Promise<Photo> {
  return page.evaluate(async (zooms) => {
    // Modules de l'app servis par Vite (même instance que la page) ; `new Function` : Vitest réécrirait un import() écrit ici.
    const importer = new Function('u', 'return import(u)') as (u: string) => Promise<Record<string, never>>;
    const hit = (await importer('/src/lib/ligue1-map-hit.ts')) as unknown as typeof import('../src/lib/ligue1-map-hit');
    const { LIGUE1_CLUBS_COORDS } = (await importer('/src/lib/ligue1-clubs-coords.ts')) as unknown as typeof import('../src/lib/ligue1-clubs-coords');
    const zones = [...document.querySelectorAll<HTMLElement>('.leaflet-marker-icon')].map((el) => {
      const r = el.getBoundingClientRect();
      return { club: el.title, x: r.left + r.width / 2, y: r.top + r.height / 2, cote: el.offsetWidth, hauteur: el.offsetHeight };
    });
    const parNom = new Map(LIGUE1_CLUBS_COORDS.map((c) => [c.name, c]));
    const lyon = zones.find((z) => z.club === 'Lyon')!;
    let meilleur = { zoom: NaN, ecart: Infinity };
    for (let z = 3; z <= 15; z += 0.25) {
      const o = hit.markerCentre(parNom.get('Lyon')!, z);
      let somme = 0;
      for (const zone of zones) {
        const c = hit.markerCentre(parNom.get(zone.club)!, z);
        somme += Math.hypot(zone.x - lyon.x - (c.x - o.x), zone.y - lyon.y - (c.y - o.y));
      }
      if (somme / zones.length < meilleur.ecart) meilleur = { zoom: z, ecart: somme / zones.length };
    }
    const attendues: Record<string, Record<string, number>> = {};
    for (const z of zooms) {
      const tailles = hit.hitSizesAtZoom(z);
      attendues[String(z)] = Object.fromEntries(zones.map((zone) => [zone.club, tailles.get(parNom.get(zone.club)!.id365)!]));
    }
    return { zones, zoom: meilleur.zoom, ecartPositions: meilleur.ecart, attendues };
  }, zoomsAttendus);
}

/** Clique un bouton de zoom et mesure les zones à chaque image tant que la carte anime (`leaflet-zoom-anim` sur `.leaflet-map-pane`). */
async function zoomerEnMesurant(page: Page, bouton: 'in' | 'out'): Promise<Zone[][]> {
  return page.evaluate(async (sens) => {
    // Leaflet pose `leaflet-zoom-anim` sur le panneau de la carte le temps de l'animation.
    const panneau = document.querySelector('.leaflet-map-pane')!;
    const mesurer = () =>
      [...document.querySelectorAll<HTMLElement>('.leaflet-marker-icon')].map((el) => {
        const r = el.getBoundingClientRect();
        return { club: el.title, x: r.left + r.width / 2, y: r.top + r.height / 2, cote: el.offsetWidth, hauteur: el.offsetHeight };
      });
    const image = () => new Promise((fin) => requestAnimationFrame(fin));
    document.querySelector<HTMLElement>(`.leaflet-control-zoom-${sens}`)!.click();
    const images: ReturnType<typeof mesurer>[] = [];
    for (let i = 0; i < 120; i++) {
      await image();
      if (!panneau.classList.contains('leaflet-zoom-anim')) break;
      images.push(mesurer());
    }
    // Fin du zoom : laisser React poser les zones de `zoomend`.
    await image();
    await image();
    return images;
  }, bouton);
}

/** Aucune zone sous 24 px, carrées, et aucune paire de zones qui se coupent (boîtes ouvertes, au demi-pixel près). */
function verifierDisjointes(zones: Zone[], contexte: string) {
  expect(zones, contexte).toHaveLength(18);
  for (const z of zones) {
    expect(z.cote, `${contexte} ${z.club}`).toBeGreaterThanOrEqual(24);
    expect(z.hauteur, `${contexte} ${z.club}`).toBe(z.cote);
  }
  for (let i = 0; i < zones.length; i++) {
    for (let j = i + 1; j < zones.length; j++) {
      const a = zones[i];
      const b = zones[j];
      const libre = Math.max(Math.abs(a.x - b.x) - (a.cote + b.cote) / 2, Math.abs(a.y - b.y) - (a.hauteur + b.hauteur) / 2);
      expect(libre, `${contexte} ${a.club} / ${b.club} se coupent`).toBeGreaterThanOrEqual(-0.5);
    }
  }
}

/** Chaque zone vaut la taille attendue de son club. */
function verifierTailles(zones: Zone[], attendues: Record<string, number>, contexte: string) {
  for (const z of zones) expect(z.cote, `${contexte}, ${z.club}`).toBe(attendues[z.club]);
}

/** Un cran de zoom (+1 ou −1) depuis `avant` : mesuré pendant l'animation et après, rend le zoom d'arrivée et un résumé. */
async function cranVerifie(page: Page, avant: number, cran: number, etape: string): Promise<{ zoom: number; resume: string }> {
  const apres = avant + cran;
  const images = await zoomerEnMesurant(page, cran > 0 ? 'in' : 'out');
  const fin = await photo(page, [apres, Math.min(avant, apres)]);
  const contexte = `${etape} (${cran > 0 ? '+' : '−'}, ${avant} → ${apres})`;

  // Le cran a bien eu lieu et a été animé : sans cela, « pendant l'animation » ne serait pas mesuré.
  expect(fin.zoom, `${contexte} : zoom retrouvé`).toBe(apres);
  expect(fin.ecartPositions, `${contexte} : positions`).toBeLessThan(1.5);
  expect(images.length, `${contexte} : images pendant l'animation`).toBeGreaterThan(0);

  // Pendant : zones ≥ 24 px et disjointes à chaque image ; à partir de la deuxième image (React a reçu
  // `zoomanim`), chaque zone vaut celle du plus bas des deux zooms.
  for (const [i, zones] of images.entries()) {
    verifierDisjointes(zones, `${contexte}, image ${i + 1}`);
    if (i >= 1) verifierTailles(zones, fin.attendues[String(Math.min(avant, apres))], `${contexte}, image ${i + 1}`);
  }

  // Après : zones disjointes et égales à hitSizesAtZoom du zoom d'arrivée.
  verifierDisjointes(fin.zones, `${contexte}, après`);
  verifierTailles(fin.zones, fin.attendues[String(apres)], `${contexte}, après`);
  return { zoom: apres, resume: `${cran > 0 ? '+' : '−'} ${avant}→${apres} (${images.length} images animées)` };
}

describe.each([[1440, 900], [390, 844]])('Carte L1 à %i×%i (L272/t1)', (largeur, hauteur) => {
  it('trois zooms avant puis trois zooms arrière : zones = hitSizesAtZoom du zoom courant, ≥ 24 px, jamais sécantes, pendant et après l’animation', async () => {
    const page = await navigateur.newPage({ viewport: { width: largeur, height: hauteur }, timezoneId: 'Europe/Paris', locale: 'fr-FR' });
    await page.route('**/api/**', (route) => route.fulfill({ status: 503, json: {} }));
    await page.route('**/api/season-matches*', (route) => route.fulfill({ status: 200, json: [] }));
    await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());
    await page.goto(`${url}/map`);
    await page.waitForSelector('.leaflet-marker-icon');
    await page.waitForTimeout(600);

    const ouverture = await photo(page, []);
    expect(ouverture.ecartPositions, 'positions conformes à markerCentre à l’ouverture').toBeLessThan(1.5);
    let zoom = ouverture.zoom;
    const parcours: string[] = [];
    for (const [n, cran] of [1, 1, 1, -1, -1, -1].entries()) {
      const { zoom: arrivee, resume } = await cranVerifie(page, zoom, cran, `${largeur} px, cran ${n + 1}`);
      parcours.push(resume);
      zoom = arrivee;
    }
    console.log(`L272/t1 ${largeur} px :`, parcours.join(' ; '));
    await page.close();
  });
});
