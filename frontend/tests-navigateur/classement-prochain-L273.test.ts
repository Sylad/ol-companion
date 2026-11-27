// L273 — /standings, colonne « Prochain » (prochain adversaire en Ligue 1, football-data.org). Mesure dans Chromium,
// sur le classement réel de la prod du 27-11-2026 et les adversaires de la J12 (`donnees/classement-prochain-L273.json`) :
//  - aucun défilement horizontal (page ni tableau) à 320, 390, 768, 1024 et 1440 px, dans les deux vues du téléphone ;
//  - au téléphone, vue « Prochain » : la colonne est entière dans le tableau, G, N, P masqués ;
//  - au bureau : 18 cases, écusson nommé de 20 px et libellé Dom./Ext. de 12 px au moins, dans la cellule ;
//  - trois lignes contre le calendrier réel : Lyon – Monaco (Dom.), Monaco (Ext.), Paris FC à Brest (Ext.) ;
//  - journée jouée en direct (revue de code) : « Direct » dans chaque case, entier, à 12 px, sans débord ;
//  - revue UX : bulle du match au toucher et au clavier (Échap la ferme), entière à l'écran ; nom de l'adversaire à côté
//    de l'écusson dès 1024 px ; vue « Prochain » à 360 et 390 px : lignes de la hauteur de la vue « Bilan » ; à 320 × 568,
//    Lyon au premier écran ; bouton pressé de la bascule à 3:1 au moins contre la carte ; en 503, message près de la bascule.
// Avec CAPTURES_DIR, enregistre les écrans (CAPTURES_NOM : « avant » / « apres »).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { chromium, type Browser, type Page } from 'playwright';
import { createServer, type ViteDevServer } from 'vite';

type Reponses = Record<string, { status: number; body: unknown }>;
const DONNEES = JSON.parse(readFileSync(new URL('./donnees/classement-prochain-L273.json', import.meta.url), 'utf8')) as Reponses;

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

async function ouvrir(largeur: number, hauteur = 900, donnees: Reponses = DONNEES, attendreLegende = true): Promise<Page> {
  const page = await navigateur.newPage({ viewport: { width: largeur, height: hauteur }, timezoneId: 'Europe/Paris', locale: 'fr-FR' });
  await page.clock.setFixedTime(new Date('2026-11-27T17:00:00+01:00'));
  await page.route('**/api/**', (route) => {
    const u = new URL(route.request().url());
    const r = donnees[u.pathname + u.search];
    return r ? route.fulfill({ status: r.status, json: r.body }) : route.fulfill({ status: 404, json: {} });
  });
  // Écussons du CDN 365scores servis par un carré gris (le test ne sort pas sur le réseau).
  await page.route(/^https:\/\/imagecache\.365scores\.com\//, (route) =>
    route.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="#888"/></svg>' }));
  await page.route(/^https?:\/\/(?!127\.0\.0\.1|imagecache\.365scores\.com)/, (route) => route.abort());
  await page.goto(`${url}/standings`);
  await page.locator('#ligne-ol').waitFor();
  if (attendreLegende) await page.getByTestId('legende-prochain').waitFor();
  await page.evaluate(() => document.fonts.ready);
  return page;
}

const capture = async (page: Page, nom: string, pleine = false) => {
  const dossier = process.env.CAPTURES_DIR;
  if (dossier) await page.screenshot({ path: `${dossier}/L273-${nom}-${process.env.CAPTURES_NOM ?? 'apres'}.png`, fullPage: pleine });
};

/** Débords horizontaux : page, et tableau dans son conteneur. */
const debords = (page: Page) => page.evaluate(() => {
  const table = document.querySelector('table')!;
  const parent = table.parentElement!.getBoundingClientRect();
  const t = table.getBoundingClientRect();
  return {
    page: document.documentElement.scrollWidth - window.innerWidth,
    tableDroite: t.right - parent.right,
    largeurTable: t.width,
  };
});

/** Ce que montre la case « Prochain » d'une ligne : nom de l'écusson, libellé visible, boîte de la case et de son contenu. */
const caseProchain = (page: Page, club: string) => page.locator('tbody tr').filter({ has: page.locator(`[title="${club}"]`) }).first()
  .locator('td:last-child').evaluate((td) => {
    const img = td.querySelector('[role="img"], img') as HTMLElement | null;
    const lib = td.querySelector('[aria-hidden="true"]:not(img):not([data-testid="prochain-nom"])') as HTMLElement | null;
    const c = td.getBoundingClientRect();
    const contenu = (td.querySelector('button, [data-testid="prochain-vide"]') as HTMLElement).getBoundingClientRect();
    return {
      visible: getComputedStyle(td).display !== 'none',
      adversaire: img?.getAttribute('alt') ?? img?.getAttribute('aria-label') ?? null,
      libelle: lib?.textContent ?? null,
      taillePolice: lib ? parseFloat(getComputedStyle(lib.parentElement!).fontSize) : 0,
      tailleLogo: img?.getBoundingClientRect().width ?? 0,
      dedans: contenu.left >= c.left - 0.5 && contenu.right <= c.right + 0.5,
    };
  });

describe.each([320, 360, 390])('/standings au téléphone, %i px (L273)', (largeur) => {
  it('vue « Bilan » : aucun défilement horizontal, colonne « Prochain » repliée', async () => {
    const page = await ouvrir(largeur);
    try {
      await capture(page, `bilan-${largeur}`);
      const d = await debords(page);
      expect(d.page, 'défilement horizontal de la page').toBeLessThanOrEqual(0);
      expect(d.tableDroite, 'tableau plus large que son conteneur').toBeLessThanOrEqual(0.5);
      expect((await caseProchain(page, 'Lyon')).visible).toBe(false);
    } finally {
      await page.close();
    }
  });

  it('vue « Prochain » : G, N, P repliés, colonne entière, aucun défilement horizontal ; trois lignes = calendrier réel', async () => {
    const page = await ouvrir(largeur);
    try {
      await page.getByRole('button', { name: 'Prochain' }).click();
      await page.waitForTimeout(100);
      await capture(page, `prochain-${largeur}`);
      await capture(page, `prochain-${largeur}-page`, true);
      const d = await debords(page);
      expect(d.page).toBeLessThanOrEqual(0);
      expect(d.tableDroite).toBeLessThanOrEqual(0.5);
      const g = await page.locator('thead th', { hasText: /^G$/ }).evaluate((th) => getComputedStyle(th).display);
      expect(g).toBe('none');
      const attendu = [['Lyon', 'Monaco', 'Dom.'], ['Monaco', 'Lyon', 'Ext.'], ['Paris FC', 'Brest', 'Ext.']] as const;
      for (const [club, adv, lib] of attendu) {
        const c = await caseProchain(page, club);
        expect(c, club).toMatchObject({ visible: true, adversaire: adv, libelle: lib, dedans: true });
        expect(c.taillePolice).toBeGreaterThanOrEqual(12);
      }
    } finally {
      await page.close();
    }
  });
});

describe.each([768, 1024, 1440])('/standings à %i px (L273)', (largeur) => {
  it('colonne « Prochain » affichée pour les 18 clubs, sans défilement horizontal ni sélecteur de vue', async () => {
    const page = await ouvrir(largeur);
    try {
      await capture(page, `bureau-${largeur}`, largeur === 1440);
      const d = await debords(page);
      expect(d.page).toBeLessThanOrEqual(0);
      expect(d.tableDroite).toBeLessThanOrEqual(0.5);
      expect(await page.getByRole('group', { name: 'Colonnes du tableau' }).isVisible()).toBe(false);
      expect(await page.getByTestId('prochain-adversaire').count()).toBe(18);
      const lyon = await caseProchain(page, 'Lyon');
      expect(lyon).toMatchObject({ visible: true, adversaire: 'Monaco', libelle: 'Dom.', dedans: true });
      expect(lyon.tailleLogo).toBe(20);
      expect(lyon.taillePolice).toBeGreaterThanOrEqual(12);
    } finally {
      await page.close();
    }
  });
});

/** La J12 entière en cours (dernière journée jouée en direct) : chaque case montre son match « Direct ». */
const DONNEES_DIRECT: Reponses = (() => {
  const prochains = DONNEES['/api/next-opponents'];
  const body = prochains.body as { next: { live: boolean }[] };
  return { ...DONNEES, '/api/next-opponents': { ...prochains, body: { ...body, next: body.next.map((n) => ({ ...n, live: true })) } } };
})();

describe.each([320, 390, 1440])('/standings à %i px, journée en direct (L273)', (largeur) => {
  it('chaque case dit « Direct » (12 px au moins, dans la cellule), aucun défilement horizontal, légende « Journée en cours »', async () => {
    const page = await ouvrir(largeur, 900, DONNEES_DIRECT);
    try {
      if (largeur < 768) await page.getByRole('button', { name: 'Prochain' }).click();
      await page.waitForTimeout(100);
      await capture(page, `direct-${largeur}`);
      const d = await debords(page);
      expect(d.page).toBeLessThanOrEqual(0);
      expect(d.tableDroite).toBeLessThanOrEqual(0.5);
      expect(await page.getByTestId('prochain-direct').count()).toBe(18);
      for (const club of ['Lyon', 'Paris FC', 'Le Havre']) {
        const c = await caseProchain(page, club);
        expect(c, club).toMatchObject({ visible: true, libelle: 'Direct', dedans: true });
        expect(c.taillePolice).toBeGreaterThanOrEqual(12);
      }
      const legende = await page.getByTestId('legende-prochain').textContent();
      expect(legende).toContain('Journée en cours : J12.');
      expect(legende).not.toContain('Saison terminée');
    } finally {
      await page.close();
    }
  });
});

/** Hauteur de la ligne d'un club. */
const hauteurLigne = (page: Page, club: string) =>
  page.locator('tbody tr').filter({ has: page.locator(`[title="${club}"]`) }).first().evaluate((tr) => tr.getBoundingClientRect().height);

/** Rapport de contraste WCAG entre deux couleurs CSS calculées (« rgb(r, g, b) »). */
function contraste(a: string, b: string): number {
  const lum = (c: string) => {
    const [r, g, bl] = (c.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number).map((v) => {
      const x = v / 255;
      return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [h, l] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (h + 0.05) / (l + 0.05);
}

describe.each([360, 390])('revue UX de L273 — vue « Prochain » à %i px : une ligne par case', (largeur) => {
  it('écusson et Dom./Ext. sur une ligne, lignes de la hauteur de la vue « Bilan »', async () => {
    const page = await ouvrir(largeur);
    try {
      const bilan = await hauteurLigne(page, 'Lyon');
      await page.getByRole('button', { name: 'Prochain' }).click();
      await page.waitForTimeout(100);
      const prochain = await hauteurLigne(page, 'Lyon');
      expect(prochain, `ligne de Lyon : ${bilan} px en Bilan, ${prochain} px en Prochain`).toBeLessThanOrEqual(bilan + 0.5);
      const { logo, lib } = await page.locator('tbody tr').filter({ has: page.locator('[title="Lyon"]') }).first()
        .locator('td:last-child button').evaluate((b) => ({
          logo: b.querySelector('img, [role="img"]')!.getBoundingClientRect().toJSON() as DOMRect,
          lib: b.querySelector('span.text-petite')!.getBoundingClientRect().toJSON() as DOMRect,
        }));
      expect(lib.left, 'Dom. à droite de l’écusson').toBeGreaterThanOrEqual(logo.right);
    } finally {
      await page.close();
    }
  });
});

describe('revue UX de L273 — 320 × 568, vue « Prochain »', () => {
  it('Lyon est au premier écran, au-dessus de la barre du bas', async () => {
    const page = await ouvrir(320, 568);
    try {
      await page.getByRole('button', { name: 'Prochain' }).click();
      await page.waitForTimeout(100);
      await capture(page, 'prochain-320x568');
      const { bas, barre } = await page.evaluate(() => {
        const tr = document.getElementById('ligne-ol')!.getBoundingClientRect();
        const nav = document.querySelector('nav[aria-label="Navigation principale"]');
        const b = nav?.getBoundingClientRect();
        return { bas: tr.bottom, barre: b && b.height > 0 && getComputedStyle(nav!).display !== 'none' ? b.top : window.innerHeight };
      });
      expect(bas, `ligne de Lyon finit à ${bas}, barre du bas à ${barre}`).toBeLessThanOrEqual(barre);
    } finally {
      await page.close();
    }
  });
});

describe.each([320, 390, 1440])('revue UX de L273 (M1) — bulle du match à %i px', (largeur) => {
  it('au toucher : la bulle dit adversaire, lieu, journée et date, entière à l’écran ; Échap la ferme', async () => {
    const page = await ouvrir(largeur);
    try {
      if (largeur < 768) await page.getByRole('button', { name: 'Prochain' }).click();
      const bouton = page.getByRole('button', { name: 'Monaco à domicile' });
      const b = await bouton.boundingBox();
      expect(b!.height, 'cible ≥ 24 px de haut').toBeGreaterThanOrEqual(24);
      expect(b!.width, 'cible ≥ 24 px de large').toBeGreaterThanOrEqual(24);
      await bouton.click();
      const bulle = page.locator('tbody tr').filter({ has: page.locator('[title="Lyon"]') }).first().getByRole('tooltip');
      await bulle.waitFor();
      expect(await bulle.textContent()).toBe('Monaco, à domicile — J12, dimanche 29 novembre · 20h45');
      await capture(page, `bulle-${largeur}`);
      const bb = await bulle.boundingBox();
      expect(bb!.x, 'bulle coupée à gauche').toBeGreaterThanOrEqual(0);
      expect(bb!.x + bb!.width, 'bulle coupée à droite').toBeLessThanOrEqual(largeur);
      expect((await debords(page)).page, 'la bulle fait défiler la page').toBeLessThanOrEqual(0);
      await page.keyboard.press('Escape');
      expect(await bulle.isVisible()).toBe(false);
      // Au clavier : le focus ouvre la bulle de la case.
      await page.keyboard.press('Tab');
      expect(await page.locator('[data-testid="prochain-bulle"]:not([hidden])').count()).toBe(1);
    } finally {
      await page.close();
    }
  });
});

describe.each([1024, 1280, 1440])('revue UX de L273 (M1) — nom de l’adversaire à côté de l’écusson à %i px', (largeur) => {
  it('18 noms écrits, dans leur case, sans défilement horizontal', async () => {
    const page = await ouvrir(largeur);
    try {
      const noms = await page.getByTestId('prochain-nom').evaluateAll((els) => els.map((e) => {
        const b = e.getBoundingClientRect();
        const td = e.closest('td')!.getBoundingClientRect();
        return { texte: e.textContent, visible: b.width > 0, dedans: b.left >= td.left - 0.5 && b.right <= td.right + 0.5 };
      }));
      expect(noms).toHaveLength(18);
      expect(noms.every((n) => n.visible && n.dedans)).toBe(true);
      expect(noms.find((n) => n.texte === 'Monaco')).toBeTruthy();
      const d = await debords(page);
      expect(d.page).toBeLessThanOrEqual(0);
      expect(d.tableDroite).toBeLessThanOrEqual(0.5);
    } finally {
      await page.close();
    }
  });
});

describe('revue UX de L273 (m1, m3, m4) — bascule et 503 à 390 px', () => {
  it('bouton pressé : fond à 3:1 au moins contre la carte ; en-tête « Proch. »', async () => {
    const page = await ouvrir(390);
    try {
      const mesure = () => page.evaluate(() => {
        const presse = document.querySelector('[role="group"] button[aria-pressed="true"]')!;
        const carte = presse.closest('section')!;
        return { fond: getComputedStyle(presse).backgroundColor, carte: getComputedStyle(carte).backgroundColor, texte: getComputedStyle(presse).color };
      });
      for (const vue of ['Bilan', 'Prochain']) {
        await page.getByRole('button', { name: vue, exact: true }).click();
        const m = await mesure();
        expect(contraste(m.fond, m.carte), `${vue} : fond ${m.fond} contre ${m.carte}`).toBeGreaterThanOrEqual(3);
        expect(contraste(m.texte, m.fond), `${vue} : texte ${m.texte} sur ${m.fond}`).toBeGreaterThanOrEqual(4.5);
      }
      await capture(page, 'bascule-390');
      const entete = await page.locator('thead th[title="Prochain adversaire en Ligue 1"] span.md\\:hidden').textContent();
      expect(entete).toBe('Proch.');
    } finally {
      await page.close();
    }
  });

  it('503 : en vue « Prochain », le message est juste sous la bascule, avant le tableau', async () => {
    const page = await ouvrir(390, 844, { ...DONNEES, '/api/next-opponents': { status: 503, body: { message: 'indisponible' } } }, false);
    try {
      await page.getByRole('button', { name: 'Prochain' }).click();
      const msg = page.getByTestId('prochain-indisponible-haut');
      await msg.waitFor({ state: 'visible', timeout: 15000 });
      await capture(page, '503-390');
      const ecart = await page.evaluate(() => {
        const g = document.querySelector('[role="group"][aria-label="Colonnes du tableau"]')!.getBoundingClientRect();
        const m = document.querySelector('[data-testid="prochain-indisponible-haut"]')!.getBoundingClientRect();
        const t = document.querySelector('table')!.getBoundingClientRect();
        return { sousBascule: m.top - g.bottom, avantTableau: t.top - m.bottom };
      });
      expect(ecart.sousBascule).toBeGreaterThanOrEqual(0);
      expect(ecart.sousBascule).toBeLessThanOrEqual(16);
      expect(ecart.avantTableau).toBeGreaterThanOrEqual(0);
    } finally {
      await page.close();
    }
  });
});

