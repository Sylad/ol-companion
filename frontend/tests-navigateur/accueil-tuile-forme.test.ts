// L257 — tuile « Bilan championnat » de l'accueil (revue UX L255, M2) : le bilan de saison (« 5V », « 2N · 3D en 10 matchs »)
// et la bande « Forme · 5 derniers matchs » (D V D V D) tiennent entiers dans la tuile, sans se recouvrir, de 320 à 1440 px.
// jsdom ne mesure rien : mesure dans Chromium. Avec CAPTURES_DIR, enregistre la tuile et le haut de l'accueil.
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

// Le cas de la revue L255 : 5V 2N 3D en 10 matchs, 5 derniers D V D V D.
const CLASSEMENT = {
  currentMatchday: 10,
  table: [{
    position: 5, team: 'Olympique Lyonnais', teamId: 523, played: 10, won: 5, draw: 2, lost: 3,
    goalsFor: 14, goalsAgainst: 11, goalDifference: 3, points: 17, recentForm: ['L', 'W', 'L', 'W', 'L'],
  }],
};

describe.each([320, 390, 1440])('tuile Bilan championnat à %i px', (largeur) => {
  it('L257 — libellé, bilan et bande de forme entiers dans la tuile, sans recouvrement', async () => {
    const page = await navigateur.newPage({ viewport: { width: largeur, height: 900 }, timezoneId: 'Europe/Paris', locale: 'fr-FR' });
    try {
      await page.route('**/api/**', (route) => {
        const u = route.request().url();
        if (/\/api\/standings(\?|$)/.test(u)) return route.fulfill({ status: 200, json: CLASSEMENT });
        if (u.includes('/api/season-matches/team-stats')) return route.fulfill({ status: 404, json: {} });
        if (u.includes('/api/season-matches')) return route.fulfill({ status: 200, json: [] });
        return route.fulfill({ status: 404, json: {} });
      });
      await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());
      await page.goto(`${url}/`);
      const tuile = page.getByTestId('stat-forme');
      // Pastille, pas l'icône Lucide de la tuile (un svg, rôle img implicite, présent avant les données).
      await tuile.locator('span[role="img"]').first().waitFor();
      const dossier = process.env.CAPTURES_DIR;
      if (dossier) {
        const nom = process.env.CAPTURES_NOM ?? 'apres';
        await tuile.screenshot({ path: `${dossier}/L257-tuile-${nom}-${largeur}.png` });
        await page.getByTestId('tuiles-stats').scrollIntoViewIfNeeded();
        await page.screenshot({ path: `${dossier}/L257-accueil-${nom}-${largeur}.png` });
      }
      const mesure = await tuile.evaluate((el) => {
        const boite = el.getBoundingClientRect();
        const r = (n: Element) => { const b = n.getBoundingClientRect(); return { texte: n.textContent, g: b.left, d: b.right, h: b.top, b: b.bottom }; };
        const feuilles = Array.from(el.querySelectorAll('span, div')).filter((n) => n.children.length === 0 && n.textContent!.trim());
        return { boite: { g: boite.left, d: boite.right }, feuilles: feuilles.map(r), debord: el.scrollWidth > el.clientWidth };
      });
      expect(mesure.debord).toBe(false);
      for (const f of mesure.feuilles) {
        expect(f.g, `« ${f.texte} » sort à gauche`).toBeGreaterThanOrEqual(mesure.boite.g);
        expect(f.d, `« ${f.texte} » sort à droite`).toBeLessThanOrEqual(mesure.boite.d);
      }
      // Aucun texte n'en recouvre un autre (les pastilles comptent).
      for (let i = 0; i < mesure.feuilles.length; i++)
        for (let j = i + 1; j < mesure.feuilles.length; j++) {
          const a = mesure.feuilles[i], b = mesure.feuilles[j];
          const recouvre = a.g < b.d - 0.5 && b.g < a.d - 0.5 && a.h < b.b - 0.5 && b.h < a.b - 0.5;
          expect(recouvre, `« ${a.texte} » recouvre « ${b.texte} »`).toBe(false);
        }
      // Le libellé de la bande est au-dessus des pastilles.
      // Une seule lecture : le reste de l'accueil se charge et déplace la tuile entre deux appels.
      const { basLibelle, hautPastille } = await tuile.evaluate((el) => ({
        basLibelle: el.querySelector('[data-testid="libelle-forme-recente"]')!.getBoundingClientRect().bottom,
        hautPastille: el.querySelector('[role="img"]')!.getBoundingClientRect().top,
      }));
      expect(basLibelle).toBeLessThanOrEqual(hautPastille + 0.5);
    } finally {
      await page.close();
    }
  });
});
