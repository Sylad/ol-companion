// L121 — « Mes carrières » (/fcnoobz/carrieres) et tuiles de /fcnoobz mesurées dans Chromium : pas de défilement
// horizontal de 320 à 1440 px ni en paysage, liens d'au moins 44 px de haut, saison / division / place d'une ligne
// sans chevauchement, et la même chose avec le texte à 200 % (WCAG 1.4.4, 1.4.10). Données d'exemple fabriquées.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright';
import { createServer, type ViteDevServer } from 'vite';

const CAPTURES = process.env.CAPTURES_DIR;

const DEMO = {
  releveLe: '2026-11-25',
  editions: [
    {
      edition: 26,
      clubs: [
        {
          club: 'Club d’exemple au nom assez long pour tester',
          saisons: [
            { saison: '2025-2026', division: 'Division d’exemple 1', place: 3, titres: ['Coupe d’exemple'], provenance: 'sauvegarde' },
            { saison: '2026-2027', division: 'Division d’exemple 1', place: 1, enCours: true, provenance: 'sauvegarde' },
          ],
        },
        { club: 'Autre club', saisons: [{ saison: '2025-2026', division: 'Division d’exemple 3 au nom très long', place: null, provenance: 'sauvegarde' }] },
      ],
    },
    {
      edition: 21,
      clubs: [
        {
          club: 'Troisième club',
          saisons: [
            { saison: '2020-2021', division: 'Division d’exemple 2', place: 1, titres: ['Champion de Division d’exemple 2', 'Coupe d’exemple'], provenance: 'saisie' },
            { saison: '2021-2022', division: 'Division d’exemple 1', place: 12, provenance: 'saisie' },
          ],
        },
      ],
    },
  ],
};

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

async function ouvrir(largeur: number, hauteur: number, chemin: string, donnees: unknown, zoom200 = false): Promise<Page> {
  const page = await navigateur.newPage({ viewport: { width: largeur, height: hauteur }, locale: 'fr-FR' });
  await page.route('**/api/**', (route) => route.fulfill({ status: 404, json: {} }));
  await page.route('**/fcnoobz-data/carrieres.json', (route) => route.fulfill({ status: 200, json: donnees }));
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());
  await page.goto(`${url}${chemin}`);
  await page.locator('h1').first().waitFor();
  if (zoom200) await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(200);
  return page;
}

const debordement = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

/** Lignes de saison dont deux morceaux (saison, marque, division, place) se chevauchent. */
const chevauchements = (page: Page) => page.evaluate(() => {
  const fautes: string[] = [];
  for (const ligne of document.querySelectorAll('[data-testid="saison-ligne"]')) {
    const boites = ['saison-annee', 'saison-en-cours', 'saison-division', 'saison-place']
      .map((id) => ligne.querySelector(`[data-testid="${id}"]`))
      .filter((e): e is Element => !!e)
      .map((e) => ({ t: e.textContent, r: e.getBoundingClientRect() }));
    for (let i = 0; i < boites.length; i++) for (let j = i + 1; j < boites.length; j++) {
      const a = boites[i].r, b = boites[j].r;
      if (a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5) fautes.push(`${boites[i].t} / ${boites[j].t}`);
    }
  }
  return fautes;
});

const VUES: [string, number, number][] = [['320', 320, 800], ['390', 390, 844], ['600', 600, 900], ['840', 840, 900], ['1280', 1280, 900], ['1440', 1440, 900], ['paysage 844×390', 844, 390]];

describe.each(VUES)('L121 — /fcnoobz/carrieres à %s', (nom, largeur, hauteur) => {
  it('pas de défilement horizontal, lignes de saison sans chevauchement, retour ≥ 44 px', async () => {
    const page = await ouvrir(largeur, hauteur, '/fcnoobz/carrieres', DEMO);
    try {
      await page.getByTestId('edition').first().waitFor();
      expect(await debordement(page)).toBeLessThanOrEqual(0);
      expect(await chevauchements(page)).toEqual([]);
      const retour = await page.getByTestId('lien-retour').boundingBox();
      expect(retour!.height).toBeGreaterThanOrEqual(44);
      if (CAPTURES && (largeur === 390 || largeur === 1440) && hauteur > 400) {
        await page.screenshot({ path: `${CAPTURES}/L121-carrieres-${largeur}.png`, fullPage: true });
      }
    } finally { await page.close(); }
  });
});

describe.each([['390', 390], ['1440', 1440]] as const)('L121 — texte à 200 %% à %s px', (_, largeur) => {
  it('/fcnoobz/carrieres : pas de défilement horizontal ni de chevauchement', async () => {
    const page = await ouvrir(largeur, 900, '/fcnoobz/carrieres', DEMO, true);
    try {
      await page.getByTestId('edition').first().waitFor();
      expect(await debordement(page)).toBeLessThanOrEqual(0);
      expect(await chevauchements(page)).toEqual([]);
      if (CAPTURES) await page.screenshot({ path: `${CAPTURES}/L121-carrieres-200pc-${largeur}.png`, fullPage: true });
    } finally { await page.close(); }
  });
});

describe.each([['320', 320], ['390', 390], ['1440', 1440]] as const)('L121 — /fcnoobz à %s px', (_, largeur) => {
  it('les deux tuiles liens tiennent, sans défilement horizontal ; état vide de la page', async () => {
    const page = await ouvrir(largeur, 900, '/fcnoobz', DEMO);
    try {
      const tuile = page.getByTestId('tuile-carrieres');
      await tuile.waitFor();
      expect(await debordement(page)).toBeLessThanOrEqual(0);
      const [jv, mc] = [await page.getByTestId('tuile-jeux-video').boundingBox(), await tuile.boundingBox()];
      expect(mc!.height).toBeGreaterThanOrEqual(44);
      // Côte à côte dès 768 px (md), empilées au téléphone.
      if (largeur >= 768) expect(Math.abs(jv!.y - mc!.y)).toBeLessThan(1);
      else expect(mc!.y).toBeGreaterThanOrEqual(jv!.y + jv!.height);
      if (CAPTURES) await page.screenshot({ path: `${CAPTURES}/L121-fcnoobz-${largeur}.png`, fullPage: true });
    } finally { await page.close(); }
    const vide = await ouvrir(largeur, 900, '/fcnoobz/carrieres', { releveLe: null, editions: [] });
    try {
      await vide.getByTestId('message-vide').waitFor();
      expect(await debordement(vide)).toBeLessThanOrEqual(0);
      if (CAPTURES && largeur !== 320) await vide.screenshot({ path: `${CAPTURES}/L121-carrieres-vide-${largeur}.png`, fullPage: true });
    } finally { await vide.close(); }
  });
});

// R4 (fiche) : « Les cartes des clubs sont sur deux colonnes à 1440 px, empilées au téléphone. » Deux colonnes dès
// lg (1024 px) ; mesuré sur les deux clubs de Football Manager 26 (même ligne, l'un à côté de l'autre / l'un sous l'autre).
describe.each([
  ['1440', 1440, 'colonnes'],
  ['1024', 1024, 'colonnes'],
  ['840', 840, 'empilées'],
  ['390', 390, 'empilées'],
  ['320', 320, 'empilées'],
] as const)('L121 — R4 cartes des clubs à %s px', (_, largeur, attendu) => {
  it(`cartes ${attendu}`, async () => {
    const page = await ouvrir(largeur, 900, '/fcnoobz/carrieres', DEMO);
    try {
      const fm26 = page.getByTestId('edition').first();
      await fm26.waitFor();
      const clubs = fm26.getByTestId('club');
      expect(await clubs.count()).toBe(2);
      const [a, b] = [await clubs.nth(0).boundingBox(), await clubs.nth(1).boundingBox()];
      if (attendu === 'colonnes') {
        expect(Math.abs(a!.y - b!.y)).toBeLessThan(1);
        expect(b!.x).toBeGreaterThanOrEqual(a!.x + a!.width);
        // Deux colonnes de même largeur.
        expect(Math.abs(a!.width - b!.width)).toBeLessThan(1);
      } else {
        expect(b!.y).toBeGreaterThanOrEqual(a!.y + a!.height);
        expect(Math.abs(a!.x - b!.x)).toBeLessThan(1);
        expect(Math.abs(a!.width - b!.width)).toBeLessThan(1);
      }
    } finally { await page.close(); }
  });
});

// Revue UX L121 (m4) : une place longue (« Place non relevée », « 12e pour l'instant ») ne coupe plus la division.
// Carte étroite (390, 320, deux colonnes à 1024) : saison et place sur la première ligne, la division seule dessous,
// sur une ligne. Carte large (1440) : une seule ligne, comme la maquette.
const LONGUES = {
  releveLe: '2026-11-25',
  editions: [
    {
      edition: 26,
      clubs: [
        {
          club: 'Club d’exemple',
          saisons: [
            { saison: '2025-2026', division: 'National 2', place: null, provenance: 'saisie' },
            { saison: '2026-2027', division: 'National 2', place: 12, enCours: true, provenance: 'saisie' },
          ],
        },
        { club: 'Autre club', saisons: [{ saison: '2024-2025', division: 'National 3', place: 4, provenance: 'saisie' }] },
      ],
    },
  ],
};

const lignes = (page: Page) => page.evaluate(() => [...document.querySelectorAll('[data-testid="saison-ligne"]')].map((l) => {
  const r = (id: string) => l.querySelector(`[data-testid="${id}"]`)!.getBoundingClientRect();
  const d = l.querySelector('[data-testid="saison-division"]')!;
  const hauteurLigne = parseFloat(getComputedStyle(d).lineHeight);
  return { annee: r('saison-annee'), place: r('saison-place'), division: r('saison-division'), hauteurLigne };
}));

describe.each([['320', 320, 'étroite'], ['390', 390, 'étroite'], ['1024', 1024, 'étroite'], ['1440', 1440, 'large']] as const)(
  'L121 m4 — ligne de saison à %s px',
  (_, largeur, carte) => {
    it(`division d'une ligne, ${carte === 'étroite' ? 'sous saison et place' : 'à côté de la place'}`, async () => {
      const page = await ouvrir(largeur, 900, '/fcnoobz/carrieres', LONGUES);
      try {
        await page.getByTestId('edition').first().waitFor();
        expect(await chevauchements(page)).toEqual([]);
        for (const l of await lignes(page)) {
          // La division tient sur une ligne : jamais « National » / « 2 ».
          expect(l.division.height).toBeLessThan(l.hauteurLigne * 1.5);
          if (carte === 'étroite') {
            // Saison et place sur la même ligne quand elles y tiennent ; sinon (320 px, « 12e pour l'instant ») la place
            // passe dessous, à droite. La division vient toujours après, seule.
            const tiennent = l.annee.width + 12 + l.place.width <= l.division.width;
            if (tiennent) expect(Math.abs(l.place.top - l.annee.top)).toBeLessThan(4);
            else expect(l.place.top).toBeGreaterThanOrEqual(l.annee.bottom - 0.5);
            expect(Math.abs(l.place.right - l.division.right)).toBeLessThan(1);
            expect(l.division.top).toBeGreaterThanOrEqual(l.place.bottom - 0.5);
          } else {
            expect(Math.abs(l.division.top - l.annee.top)).toBeLessThan(4);
            expect(l.place.left).toBeGreaterThanOrEqual(l.division.right - 0.5);
          }
        }
        if (CAPTURES && (largeur === 390 || largeur === 1440)) await page.screenshot({ path: `${CAPTURES}/L121-m4-${largeur}.png`, fullPage: true });
      } finally { await page.close(); }
    });
  },
);

// Revue UX L121 (M1, WCAG 2.4.3) : après « Réessayer », le focus ne tombe jamais sur body, dans le vrai navigateur,
// sur Mes carrières comme sur Jeux vidéo (même gabarit). m1 (WCAG 2.3.3) : en mouvement réduit, l'indicateur ne tourne pas.
describe.each([
  ['Mes carrières', '/fcnoobz/carrieres', '**/fcnoobz-data/carrieres.json'],
  ['Jeux vidéo', '/fcnoobz/jeux-video', '**/jeux-video-data/**'],
] as const)('L121 M1 — %s : focus après « Réessayer »', (_, chemin, motif) => {
  it("main pendant la relecture, puis « Réessayer » quand l'erreur revient ; jamais body", async () => {
    const page = await navigateur.newPage({ viewport: { width: 1440, height: 900 }, locale: 'fr-FR', reducedMotion: 'reduce' });
    try {
      await page.route('**/api/**', (route) => route.fulfill({ status: 404, json: {} }));
      // Les relances automatiques de l'app répondent 500 tout de suite ; une fois « Réessayer » affiché, la relecture
      // est retenue jusqu'à `liberer()` pour mesurer le focus pendant le chargement.
      let liberer: () => void = () => {};
      let retenir = false;
      await page.route(motif, async (route) => {
        if (retenir) await new Promise<void>((r) => { liberer = r; });
        await route.fulfill({ status: 500, body: '' });
      });
      await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());
      await page.goto(`${url}${chemin}`);
      const bouton = page.getByTestId('bouton-reessayer');
      await bouton.waitFor({ timeout: 60_000 });
      retenir = true;
      await bouton.focus();
      await page.keyboard.press('Enter');
      await page.getByTestId('message-chargement').waitFor();
      expect(await page.evaluate(() => document.activeElement?.id)).toBe('contenu');
      // Mouvement réduit : aucune rotation de l'indicateur.
      expect(await page.getByTestId('indicateur-chargement').evaluate((e) => getComputedStyle(e).animationName)).toBe('none');
      retenir = false;
      liberer();
      await bouton.waitFor();
      await page.waitForFunction(() => document.activeElement?.getAttribute('data-testid') === 'bouton-reessayer');
      expect(await page.evaluate(() => document.activeElement === document.body)).toBe(false);
    } finally { await page.close(); }
  });
});
