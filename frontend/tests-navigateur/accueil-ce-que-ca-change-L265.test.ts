// L265, revue UX r2 (M1) — « Ce que ça change » dans la carte « Dernier résultat » de l'accueil : la place réservée
// pendant le chargement couvre le bloc chargé, avec ou sans « Provisoire », et en panne (503). Avant le correctif, la
// réserve de deux lignes (90 px) laissait le bloc passer à 146 px à 390 et 165 à 375 quand la journée est provisoire :
// le pied de la carte et « OL en chiffres » descendaient de 56 / 75 px. Mesure dans Chromium (jsdom ne calcule rien),
// réponses réelles de la prod du 18-11 (`donnees/`), `/api/match-impact` retenue puis libérée.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { chromium, type Browser, type Page } from 'playwright';
import { createServer, type ViteDevServer } from 'vite';

type Reponses = Record<string, { status: number; body: unknown }>;
const lire = (nom: string) => JSON.parse(readFileSync(new URL(`./donnees/${nom}`, import.meta.url), 'utf8')) as Reponses;
const API = lire('api-prod-2026-11-18.json');
const IMPACT_ACCUEIL = lire('match-impact-L265.json')['/api/match-impact?at=2026-11-08T16%3A15%3A00.000Z'].body as Record<string, unknown>;

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

/** Cas de la réponse : [nom, statut, corps, élément attendu une fois la réponse arrivée]. */
const CAS = [
  ['provisoire', 200, { ...IMPACT_ACCUEIL, remaining: 1, remainingInMatchday: 1 }, 'ce-que-ca-change-provisoire'],
  ['journée complète', 200, IMPACT_ACCUEIL, 'ce-que-ca-change-phrase'],
  // La phrase la plus longue que forme `ceQueCaChange`, journée incomplète (le gabarit du composant).
  ['phrase la plus longue', 200, {
    ...IMPACT_ACCUEIL, before: null, after: { position: 12, points: 0 }, remaining: 12, remainingInMatchday: 1,
    above: { place: 3, gap: 10 }, below: { place: 15, margin: 10 },
  }, 'ce-que-ca-change-provisoire'],
  ['503', 503, {}, 'ce-que-ca-change-erreur'],
] as const;

/** Positions (page) du bloc et de ce qui le suit : pied de la carte « Dernier résultat », carte « OL en chiffres ». */
const mesurer = (page: Page) => page.evaluate(() => {
  const y = (el: Element | null | undefined) => (el ? el.getBoundingClientRect().top + window.scrollY : NaN);
  const bloc = document.querySelector('[data-testid="ce-que-ca-change"]')!;
  const carte = document.querySelector('[data-testid="dernier-resultat"]')!;
  const chiffres = [...document.querySelectorAll('h2')].find((h) => h.textContent?.includes('OL en chiffres'))?.closest('section');
  return {
    haut: y(bloc), hauteur: bloc.getBoundingClientRect().height,
    pied: y(carte.querySelector(':scope > footer')),
    chiffres: y(chiffres),
  };
});

describe.each([375, 390, 1440])('accueil à %i px : « Ce que ça change » ne fait rien sauter', (largeur) => {
  it.each(CAS)('%s', async (_cas, statut, corps, attendu) => {
    const page = await navigateur.newPage({ viewport: { width: largeur, height: 844 }, timezoneId: 'Europe/Paris', locale: 'fr-FR' });
    try {
      await page.clock.setFixedTime(new Date('2026-11-18T13:10:00+01:00'));
      let liberer!: () => void;
      const libererImpact = new Promise<void>((r) => { liberer = r; });
      await page.route('**/api/**', async (route) => {
        const u = new URL(route.request().url());
        if (u.pathname === '/api/match-impact') {
          await libererImpact;
          return route.fulfill({ status: statut, json: corps });
        }
        const r = API[u.pathname + u.search];
        return r ? route.fulfill({ status: r.status, json: r.body }) : route.fulfill({ status: 404, json: {} });
      });
      await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());
      await page.goto(`${url}/`);
      await page.getByTestId('ce-que-ca-change-chargement').waitFor();
      await page.getByRole('heading', { name: /OL en chiffres/ }).waitFor();
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(1000); // le reste de l'accueil se pose ; la requête retenue empêche « networkidle »
      const pendant = await mesurer(page);
      liberer();
      await page.getByTestId(attendu).waitFor({ timeout: 10_000 });
      await page.waitForTimeout(100);
      const apres = await mesurer(page);
      console.info(`L265 accueil ${largeur} ${_cas} : bloc ${pendant.hauteur.toFixed(1)} → ${apres.hauteur.toFixed(1)} px, « OL en chiffres » ${pendant.chiffres.toFixed(1)} → ${apres.chiffres.toFixed(1)}`);
      if (process.env.CAPTURES_DIR && _cas === 'provisoire') {
        await page.getByTestId('dernier-resultat').screenshot({ path: `${process.env.CAPTURES_DIR}/L265-accueil-${largeur}-provisoire.png` });
      }
      expect(Number.isFinite(pendant.chiffres)).toBe(true);
      expect(Math.abs(apres.haut - pendant.haut)).toBeLessThanOrEqual(4);
      expect(Math.abs(apres.hauteur - pendant.hauteur)).toBeLessThanOrEqual(4);
      expect(Math.abs(apres.pied - pendant.pied)).toBeLessThanOrEqual(4);
      expect(Math.abs(apres.chiffres - pendant.chiffres)).toBeLessThanOrEqual(4);
    } finally { await page.close(); }
  });
});
