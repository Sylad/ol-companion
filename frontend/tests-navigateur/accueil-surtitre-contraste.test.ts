// L234 — le sur-titre du bandeau de l'accueil, sur une photo de stade CLAIRE (pire cas), tient 4,5:1 mesuré sur les pixels
// réels : on rend le texte transparent, on photographie le fond du libellé et on compare chaque pixel à la couleur du texte.
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

const photoClaire = `data:image/svg+xml;utf8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="400"><rect width="800" height="400" fill="#ffffff"/></svg>')}`;
const lum = (c: number[]) => {
  const [r, g, b] = c.map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const rapport = (a: number[], b: number[]) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

function match(date: string) {
  return { id: 1, date, homeTeam: 'Olympique Lyonnais', homeTeamId: 523, awayTeam: 'OGC Nice', awayTeamId: 470, homeScore: null, awayScore: null,
    competition: 'Ligue 1', status: 'SCHEDULED', matchday: 7, timeConfirmed: true, competitionCode: 'L1', competitionId: 35 };
}
const direct = {
  gameId: 4321, matchupId: '481-465-35', competitionId: 35, competitionName: 'France, Ligue 1', status: 'live', statusGroup: 3,
  statusText: '2e mi-temps', gameTime: 56, gameTimeDisplay: "56'", startTime: new Date(Date.now() - 3600_000).toISOString(),
  home: { id: 481, name: 'Lens', symbolicName: 'LEN', imageVersion: 1, score: 1 }, away: { id: 465, name: 'Lyon', symbolicName: 'LYO', imageVersion: 1, score: 0 },
};

async function pireContraste(page: Page, libelle: string): Promise<number> {
  const label = page.getByText(libelle, { exact: true }).first();
  await label.waitFor();
  // Pire cas voulu : la photo, d'ordinaire à 30-40 % d'opacité sous deux dégradés sombres, est portée à 100 % de blanc
  // et les dégradés sont ôtés — seul le fond du libellé s'interpose alors entre le texte et le blanc.
  await page.evaluate(() => {
    document.querySelectorAll<HTMLElement>('main [style*="background-image"]').forEach((el) => {
      el.style.opacity = '1';
      el.parentElement!.querySelectorAll<HTMLElement>(':scope > .bg-gradient-to-r, :scope > .bg-gradient-to-t').forEach((g) => { g.style.display = 'none'; });
    });
  });
  const couleur = await label.evaluate((el) => getComputedStyle(el).color.match(/\d+/g)!.slice(0, 3).map(Number));
  await label.evaluate((el) => { (el as HTMLElement).style.color = 'transparent'; (el as HTMLElement).style.animation = 'none'; });
  const b64 = (await label.screenshot()).toString('base64');
  // Décodage du PNG dans la page (canvas) : pas de dépendance de plus.
  const pixels = await page.evaluate(async (data) => {
    const img = new Image();
    img.src = `data:image/png;base64,${data}`;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    return { w: c.width, h: c.height, data: Array.from(ctx.getImageData(0, 0, c.width, c.height).data) };
  }, b64);
  // Hors les 2 px de bord : l'angle arrondi du libellé (rounded-sm) laisse voir la photo, loin de tout glyphe.
  let pire = Infinity;
  for (let y = 2; y < pixels.h - 2; y++) {
    for (let x = 2; x < pixels.w - 2; x++) {
      const i = (y * pixels.w + x) * 4;
      pire = Math.min(pire, rapport(couleur, [pixels.data[i], pixels.data[i + 1], pixels.data[i + 2]]));
    }
  }
  return pire;
}

describe.each([1440, 390])('sur-titre du bandeau à %i px', (largeur) => {
  it.each([
    ['Prochain rendez-vous', null, 8 * 86400_000],
    ['Jour de match', null, 3600_000],
    ['Match en direct', direct, 8 * 86400_000],
  ])('L234 R1 — « %s » ≥ 4,5:1 sur les pixels réels, photo blanche à pleine opacité derrière', async (libelle, live, dans) => {
    const page = await navigateur.newPage({ viewport: { width: largeur, height: 900 }, timezoneId: 'Europe/Paris', locale: 'fr-FR' });
    try {
      const matches = [match(new Date(Date.now() + dans).toISOString())];
      await page.route('**/api/**', (route) => {
        const u = route.request().url();
        if (u.includes('/api/season-matches')) return route.fulfill({ status: 200, json: matches });
        if (u.includes('/api/live-match/current')) return route.fulfill({ status: 200, json: live });
        if (u.includes('/api/wiki-image')) return route.fulfill({ status: 200, json: { imageUrl: photoClaire } });
        return route.fulfill({ status: 404, json: {} });
      });
      await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());
      await page.goto(`${url}/`);
      expect(await pireContraste(page, libelle)).toBeGreaterThanOrEqual(4.5);
    } finally {
      await page.close();
    }
  });
});
