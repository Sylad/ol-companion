// L260 — cibles d'au moins 24 × 24 px (WCAG 2.5.8) sur le calendrier, les coupes et /news (mineur de la revue UX L255).
// La cible mesurée est la zone qui reçoit vraiment le toucher : la boîte de l'élément, ou, pour un « lien étiré »
// (`::after` absolu en `inset-0`, cartes du calendrier, des coupes et des articles), la boîte de l'ancêtre positionné
// que le pseudo-élément recouvre. Le point central de cette zone doit toucher l'élément (rien ne le recouvre).
// Exceptions de 2.5.8 appliquées : lien dans une phrase (`display: inline` dans un texte plus long), lien
// d'évitement masqué (`sr-only`, 1 × 1 px hors focus).
// Données : réponses réelles de l'API de prod enregistrées le 18-11 (même jeu que plancher-12px-L261).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { chromium, type Browser, type Page } from 'playwright';
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

async function ouvrir(largeur: number, chemin: string): Promise<Page> {
  const page = await navigateur.newPage({ viewport: { width: largeur, height: 800 }, timezoneId: 'Europe/Paris', locale: 'fr-FR' });
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
  await page.waitForTimeout(300);
  return page;
}

/** Cibles de moins de 24 px dans `main`, ou dont le centre ne touche pas l'élément : « texte (l × h) ». */
const ciblesFautives = (page: Page) => page.evaluate(async () => {
  const fautes: string[] = [];
  const cibles = [...document.querySelectorAll('main a[href], main button, main summary, main [role="tab"], main input, main select')]
    .filter((e) => (e as HTMLElement).checkVisibility({ visibilityProperty: true }) && e.getBoundingClientRect().width > 1);
  for (const e of cibles) {
    const cs = getComputedStyle(e);
    // Exception « en ligne » : un lien dans une phrase.
    if (cs.display === 'inline' && (e.parentElement?.textContent ?? '').trim().length > (e.textContent ?? '').trim().length + 1) {
      const apres = getComputedStyle(e, '::after');
      if (apres.position !== 'absolute') continue;
    }
    let zone: Element = e;
    const apres = getComputedStyle(e, '::after');
    if (apres.position === 'absolute' && apres.content !== 'none') {
      let p = e.parentElement;
      while (p && getComputedStyle(p).position === 'static') p = p.parentElement;
      if (p) zone = p;
    }
    zone.scrollIntoView({ block: 'center' });
    await new Promise(requestAnimationFrame);
    const r = zone.getBoundingClientRect();
    const nom = `${(e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 40)} (${Math.round(r.width)} × ${Math.round(r.height)})`;
    if (r.width < 24 || r.height < 24) { fautes.push(nom); continue; }
    const touche = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    if (!touche || !(touche === e || e.contains(touche) || (zone !== e && touche === zone))) {
      // Le centre d'une carte étirée peut tomber sur le pseudo-élément : elementFromPoint rend alors le lien lui-même.
      fautes.push(`${nom} : centre recouvert par ${touche?.tagName.toLowerCase()}`);
    }
  }
  return fautes;
});

describe.each([320, 390, 1440])('L260 — cibles ≥ 24 px à %i px', (largeur) => {
  it.each(['/fixtures', '/cups', '/news'])('%s', async (chemin) => {
    const page = await ouvrir(largeur, chemin);
    try {
      const n = await page.evaluate(() => document.querySelectorAll('main a[href], main button, main summary').length);
      expect(n, 'la page a rendu ses liens').toBeGreaterThan(5);
      expect(await ciblesFautives(page)).toEqual([]);
    } finally { await page.close(); }
  });
});
