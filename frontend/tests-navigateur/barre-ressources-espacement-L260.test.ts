// L260/t2 (revue de code de L260, m3) — « Olympique et Lyonnais » dans les Ressources de la barre latérale (240 px) :
// avec l'espacement de texte de WCAG 1.4.12 (lettres 0,12 em, mots 0,16 em, lignes 1,5, paragraphes 2 em), le nom
// dépassait les 143 px qui lui restent et finissait en ellipse. Il passe désormais à la ligne : chaque nom est lu
// en entier, sans débordement du lien ni de la barre. Mesuré dans Chromium (jsdom ne met rien en page).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser } from 'playwright';
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

const ESPACEMENT_WCAG = `* { letter-spacing: 0.12em !important; word-spacing: 0.16em !important; line-height: 1.5 !important; }
p { margin-bottom: 2em !important; }`;

describe.each([
  ['100 %, espacement WCAG 1.4.12', ESPACEMENT_WCAG, 1],
  ['200 % (police de la racine doublée)', '', 2],
])('Ressources de la barre latérale à 1440 px, %s', (_nom, css, echelle) => {
  it('chaque nom est entier (ni ellipse ni débordement), le lien reste dans la barre', async () => {
    const page = await navigateur.newPage({ viewport: { width: 1440, height: 900 }, locale: 'fr-FR' });
    await page.route('**/api/**', (route) => route.fulfill({ status: 503, json: {} }));
    await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());
    await page.goto(`${url}/`);
    await page.waitForSelector('[data-testid="nom-ressource"]');
    if (css) await page.addStyleTag({ content: css });
    if (echelle !== 1) await page.addStyleTag({ content: `html { font-size: ${100 * echelle}% !important; }` });
    const mesures = await page.evaluate(() => {
      const aside = document.querySelector('aside')!.getBoundingClientRect();
      return [...document.querySelectorAll<HTMLElement>('[data-testid="nom-ressource"]')].map((nom) => {
        const lien = nom.closest('a')!.getBoundingClientRect();
        return {
          nom: nom.textContent,
          coupe: nom.scrollWidth > nom.clientWidth + 0.5,
          dansLeLien: nom.getBoundingClientRect().right <= lien.right + 0.5,
          dansLaBarre: lien.left >= aside.left - 0.5 && lien.right <= aside.right + 0.5,
        };
      });
    });
    await page.close();
    expect(mesures.map((m) => m.nom)).toContain('Olympique et Lyonnais');
    expect(mesures.filter((m) => m.coupe || !m.dansLeLien || !m.dansLaBarre)).toEqual([]);
  });
});
