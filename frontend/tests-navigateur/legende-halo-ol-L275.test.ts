// L275 (revue UX, constat 1) — le halo plein de la pastille de l'OL dans la légende de la Carte L1 ne recouvre ni son
// libellé « Lyon (OL) » ni la rangée voisine. Avec 2 px d'anneau sombre + 5 px d'anneau rosé (7 px pleins), il couvrait
// 1 px du libellé (écart 6 px) et débordait de 3 px dans la rangée « Pas encore joué » à 390 (écart 4 px).
// Mesure dans Chromium : boîte de la pastille élargie de l'étendue pleine de son ombre (ombres sans flou : leur
// `spread`, lu sur le style calculé), comparée aux boîtes du libellé et des autres rubriques de la légende.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
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

interface Boite { g: number; h: number; d: number; b: number }
interface MesureLegende {
  pastille: Boite;
  ombre: string;
  libelle: Boite;
  autres: { nom: string; boite: Boite }[];
}

/** Étendue pleine d'un `box-shadow` calculé : le plus grand `spread` des ombres sans flou ni décalage. */
function etenduePleine(ombre: string): number {
  const ombres = [...ombre.matchAll(/(-?[\d.]+)px (-?[\d.]+)px ([\d.]+)px (-?[\d.]+)px/g)];
  return Math.max(0, ...ombres.filter((o) => Number(o[3]) === 0).map((o) => Math.max(Math.abs(Number(o[1])), Math.abs(Number(o[2]))) + Number(o[4])));
}

const coupe = (a: Boite, b: Boite) => a.g < b.d && b.g < a.d && a.h < b.b && b.h < a.b;

describe.each([[1440, 900], [390, 844], [320, 700]])('Légende de la Carte L1 à %i×%i (L275)', (largeur, hauteur) => {
  it('le halo plein de la pastille de l\'OL ne recouvre ni « Lyon (OL) » ni une autre rubrique', async () => {
    const page = await navigateur.newPage({ viewport: { width: largeur, height: hauteur }, timezoneId: 'Europe/Paris', locale: 'fr-FR' });
    await page.clock.setFixedTime(new Date('2026-11-18T13:10:00+01:00'));
    await page.route('**/api/**', (route) => {
      const u = new URL(route.request().url());
      const r = API[u.pathname + u.search];
      return r ? route.fulfill({ status: r.status, json: r.body }) : route.fulfill({ status: 404, json: {} });
    });
    await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());
    await page.goto(`${url}/map`);
    await page.waitForSelector('[aria-label="Légende des marqueurs"]');
    const m: MesureLegende = await page.evaluate(() => {
      const boite = (el: Element) => { const r = el.getBoundingClientRect(); return { g: r.left, h: r.top, d: r.right, b: r.bottom }; };
      const legende = document.querySelector('[aria-label="Légende des marqueurs"]')!;
      const rubriques = [...legende.querySelectorAll(':scope > div:last-child > div')];
      const ol = rubriques.find((r) => r.textContent?.includes('Lyon (OL)'))!;
      const dessin = ol.querySelector('span[aria-hidden] > span')!;
      const libelle = [...ol.querySelectorAll(':scope > span')].find((s) => !s.hasAttribute('aria-hidden'))!;
      return {
        pastille: boite(dessin),
        ombre: getComputedStyle(dessin).boxShadow,
        libelle: boite(libelle),
        autres: rubriques.filter((r) => r !== ol).map((r) => ({ nom: r.textContent ?? '', boite: boite(r) })),
      };
    });
    await page.close();

    const e = etenduePleine(m.ombre);
    const halo: Boite = { g: m.pastille.g - e, h: m.pastille.h - e, d: m.pastille.d + e, b: m.pastille.b + e };
    console.log(`L275 légende ${largeur} px : halo plein ${e} px, écart au libellé ${(m.libelle.g - m.pastille.d).toFixed(1)} px`);
    expect(m.autres).toHaveLength(4);
    expect(e, 'l\'anneau sombre (2 px) reste autour de la pastille').toBeGreaterThanOrEqual(2);
    expect(coupe(halo, m.libelle), `halo de ${e} px sur « Lyon (OL) »`).toBe(false);
    for (const a of m.autres) expect(coupe(halo, a.boite), `halo de ${e} px sur « ${a.nom} »`).toBe(false);
  });
});
