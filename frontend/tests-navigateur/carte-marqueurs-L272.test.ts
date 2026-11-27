// L272 (D-2) — marqueurs de la carte L1 plus gros : « je plissais les yeux pour bien voir » (Sylvain, 27-11).
// Mesuré dans Chromium sur la saison réelle (`donnees/api-prod-2026-11-18.json`) à 390 et 1440 px :
// taille DESSINÉE de chaque rond (pas la boîte de la zone cliquable), aucun rond qui en recouvre un autre, zone de
// toucher de 24 px au moins partout et de 44 px dès que les voisins le permettent, légende à la taille des marqueurs.
// `CAPTURES_L272=<dossier>` enregistre une capture de la carte et de sa légende par largeur.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, type Browser } from 'playwright';
import { createServer, type ViteDevServer } from 'vite';

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

interface Mesure {
  club: string;
  /** Rond dessiné (svg du club, pastille de l'OL), en px. */
  rond: { x: number; y: number; l: number; h: number };
  /** Zone qui reçoit le toucher (l'élément du marqueur), en px. */
  zone: { l: number; h: number };
}

describe.each([[1440, 900], [390, 844]])('Carte L1 à %i×%i (L272)', (largeur, hauteur) => {
  it('ronds de 22 px (OL 26 px), jamais superposés, zone de toucher ≥ 24 px et 44 px là où la place le permet, légende à la même taille', async () => {
    const page = await navigateur.newPage({ viewport: { width: largeur, height: hauteur }, timezoneId: 'Europe/Paris', locale: 'fr-FR' });
    await page.clock.setFixedTime(new Date('2026-11-18T13:10:00+01:00'));
    await page.route('**/api/**', (route) => {
      const u = new URL(route.request().url());
      const r = API[u.pathname + u.search];
      return r ? route.fulfill({ status: r.status, json: r.body }) : route.fulfill({ status: 404, json: {} });
    });
    await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());
    await page.goto(`${url}/map`);
    await page.waitForSelector('.leaflet-marker-icon');
    await page.waitForTimeout(600);
    const mesures: Mesure[] = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('.leaflet-marker-icon')].map((el) => {
        const dessin = el.querySelector('svg') ?? el.querySelector('span > span')!;
        const r = dessin.getBoundingClientRect();
        const z = el.getBoundingClientRect();
        return { club: el.title, rond: { x: r.left + r.width / 2, y: r.top + r.height / 2, l: r.width, h: r.height }, zone: { l: z.width, h: z.height } };
      }),
    );
    const legende = await page.$$eval('[aria-label="Légende des marqueurs"] span[aria-hidden] > *', (dessins) => dessins.map((d) => d.getBoundingClientRect().width));
    const dossier = process.env.CAPTURES_L272;
    if (dossier) {
      await page.screenshot({ path: join(dossier, `carte-${largeur}.png`), fullPage: true });
    }
    await page.close();

    console.log(`L272 ${largeur} px :`, JSON.stringify(mesures.map((m) => `${m.club} rond ${m.rond.l}×${m.rond.h} zone ${m.zone.l}×${m.zone.h}`)), 'légende', JSON.stringify(legende));
    expect(mesures).toHaveLength(18);
    for (const m of mesures) {
      const attendu = m.club === 'Lyon' ? 26 : 22;
      expect(m.rond.l, m.club).toBeCloseTo(attendu, 0);
      expect(m.rond.h, m.club).toBeCloseTo(attendu, 0);
      expect(m.zone.l, m.club).toBeGreaterThanOrEqual(24);
      expect(m.zone.l, m.club).toBeLessThanOrEqual(44);
      expect(m.zone.h, m.club).toBe(m.zone.l);
      // La zone ne coupe jamais le rond : tout le rond se touche.
      expect(m.zone.l, m.club).toBeGreaterThanOrEqual(m.club === 'Lyon' ? 24 : m.rond.l);
    }
    // Aucun rond n'en recouvre un autre : écart des centres ≥ somme des rayons.
    for (let i = 0; i < mesures.length; i++) {
      for (let j = i + 1; j < mesures.length; j++) {
        const a = mesures[i].rond;
        const b = mesures[j].rond;
        const ecart = Math.hypot(a.x - b.x, a.y - b.y);
        expect(ecart, `${mesures[i].club} / ${mesures[j].club}`).toBeGreaterThanOrEqual((a.l + b.l) / 2);
      }
    }
    // Les clubs isolés (Lyon, Toulouse, Strasbourg) ont la place d'une zone de 44 px dès l'ouverture.
    for (const club of ['Lyon', 'Toulouse', 'Strasbourg']) {
      expect(mesures.find((m) => m.club === club)!.zone.l, club).toBe(44);
    }
    // Légende : 4 résultats à la taille d'un rond de club, puis l'OL à la taille du sien.
    expect(legende).toEqual([22, 22, 22, 22, 26]);
  });
});
