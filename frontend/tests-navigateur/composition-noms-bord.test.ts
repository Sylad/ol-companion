// L76 — sur /players, le nom d'un joueur excentré (Tolisso, Nuamah, Athekame) n'est plus coupé par le bord du terrain :
// mesuré dans Chromium (jsdom ne mesure aucune largeur). API simulée, ressources externes refusées, serveur Vite démarré par le test.
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

const joueur = (n: number, shortName: string, yardLine: number, yardSide: number) => ({
  id: n, athleteId: 100 + n, name: shortName, shortName, jerseyNumber: n, position: 'Milieu', positionShort: 'M',
  yardLine, yardSide, ranking: n % 2 ? 7.4 : null, isStarting: true,
});

// Noms longs aux deux bords, plus un joueur au centre ; yardSide hors [4 ; 96] pour couvrir le clamp.
const lineup = {
  gameId: 1, date: '2026-10-10T19:00:00Z', competition: 'Ligue 1', matchday: 8, opponent: 'Lens', opponentId: 7,
  isHome: true, homeScore: 2, awayScore: 1, formation: '4-3-3',
  starters: [
    joueur(1, 'Lucas Perri', 1, 50),
    joueur(2, 'Athekame', 2, 3), joueur(3, 'Niakhaté', 2, 38), joueur(4, 'Tagliafico', 2, 62), joueur(5, 'Tolisso Corentin', 2, 99),
    joueur(6, 'Tolisso', 3, 2), joueur(7, 'Caqueret', 3, 50), joueur(8, 'Nuamah-Longnom', 3, 98),
    joueur(9, 'Nuamah', 5, 4), joueur(10, 'Lacazette', 5, 50), joueur(11, 'Cherki', 5, 96),
  ],
  bench: [], injured: [],
};

// L76 R5 — cas réel : Bacher (yardSide 66) et Z. Athekame (100) sur la même ligne ; le recalage d'Athekame dans le terrain
// le collait à Bacher (3,4 px de chevauchement à 390 px, nom de Bacher masqué à 320 px).
const lineupBacher = {
  ...lineup,
  starters: [
    joueur(1, 'Lucas Perri', 1, 50),
    joueur(2, 'Niakhaté', 2, 30), joueur(3, 'Bacher', 2, 66), joueur(4, 'Z. Athekame', 2, 100),
    joueur(5, 'Tolisso', 3, 20), joueur(6, 'Caqueret', 3, 50), joueur(7, 'Nuamah', 3, 80),
    joueur(8, 'Fofana', 5, 20), joueur(9, 'Lacazette', 5, 50), joueur(10, 'Cherki', 5, 80),
  ],
};

// L76 R5 — ligne à 5 défenseurs : le voisin (75 ou 80) est si près du bord que la place restante est plus étroite que le rond.
const lineupVoisinProche = (voisin: string, yardSide: number) => ({
  ...lineup,
  starters: [
    joueur(1, 'Lucas Perri', 1, 50),
    joueur(2, 'Diop', 2, 12), joueur(3, 'Mata', 2, 40), joueur(4, voisin, 2, yardSide), joueur(5, 'Z. Athekame', 2, 100),
    joueur(6, 'Tolisso', 3, 20), joueur(7, 'Nuamah', 3, 50), joueur(8, 'Fofana', 5, 20), joueur(9, 'Lacazette', 5, 50),
  ],
});

async function ouvrir(largeur: number, composition: typeof lineup): Promise<Page> {
  const page = await navigateur.newPage({ viewport: { width: largeur, height: 900 }, timezoneId: 'Europe/Paris', locale: 'fr-FR' });
  await page.route('**/api/**', (route) => route.fulfill({ status: 404, json: {} }));
  await page.route('**/api/lineup*', (route) => route.fulfill({ status: 200, json: composition }));
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());
  await page.goto(`${url}/players`);
  await page.locator('[data-testid="terrain"]').waitFor();
  return page;
}

/** Écart (px) entre les noms voisins d'une même ligne, et nom entier dans le terrain. */
async function ecartsDeLigne(page: Page) {
  return page.evaluate(() => {
    const lignes = new Map<string, { nom: string; gauche: number; droite: number }[]>();
    for (const j of document.querySelectorAll('[data-testid="terrain"] [data-testid="joueur"]')) {
      const r = j.querySelector('[data-testid="nom-joueur"]')!.getBoundingClientRect();
      const l = j.getAttribute('data-ligne')!;
      if (r.width === 0) continue; // nom masqué (largeur nulle) : plus rien à recouvrir
      lignes.set(l, [...(lignes.get(l) ?? []), { nom: j.querySelector('[data-testid="nom-joueur"]')!.textContent ?? '', gauche: r.left, droite: r.right }]);
    }
    return [...lignes.values()].flatMap((l) => {
      const t = [...l].sort((a, b) => a.gauche - b.gauche);
      return t.slice(1).map((n, i) => ({ paire: `${t[i].nom} / ${n.nom}`, ecart: n.gauche - t[i].droite }));
    });
  });
}

describe.each([320, 390])('R5 — écart entre les noms d\'une même ligne à %i px', (largeur) => {
  it('cas Bacher / Z. Athekame : au moins 4 px', async () => {
    const page = await ouvrir(largeur, lineupBacher);
    try {
      const ecarts = await ecartsDeLigne(page);
      expect(ecarts.length).toBeGreaterThan(0); // dont la paire Bacher / Z. Athekame
      for (const e of ecarts) expect(e.ecart, e.paire).toBeGreaterThanOrEqual(4 - 0.01);
    } finally { await page.close(); }
  });

  it.each([['Bacher', 75], ['Tagliafico', 80]] as const)('voisin %s à yardSide %i : au moins 4 px, et le rond du bord reste dans le terrain', async (voisin, yardSide) => {
    const page = await ouvrir(largeur, lineupVoisinProche(voisin, yardSide));
    try {
      for (const e of await ecartsDeLigne(page)) expect(e.ecart, e.paire).toBeGreaterThanOrEqual(4 - 0.01);
      const dehors = await page.evaluate(() => {
        const t = document.querySelector('[data-testid="terrain"]')!.getBoundingClientRect();
        return [...document.querySelectorAll('[data-testid="terrain"] [data-testid="rond-joueur"]')]
          .filter((r) => { const b = r.getBoundingClientRect(); return b.left < t.left - 0.5 || b.right > t.right + 0.5; }).length;
      });
      expect(dehors).toBe(0);
    } finally { await page.close(); }
  });

  it('un nom de bord tronqué garde son nom complet dans le title et dans le nom accessible du lien', async () => {
    const page = await ouvrir(largeur, lineupBacher);
    try {
      const m = await page.evaluate(() => {
        const nom = [...document.querySelectorAll('[data-testid="nom-joueur"]')].find((e) => e.scrollWidth > e.clientWidth + 0.5);
        return nom ? { title: nom.getAttribute('title'), lien: nom.closest('a')!.getAttribute('aria-label'), ellipse: getComputedStyle(nom).textOverflow } : null;
      });
      // À 320 px les deux noms ne tiennent pas côte à côte : celui du bord est tronqué ; à 390 px l'écart tient sans tronquer.
      if (largeur === 320) expect(m, 'nom tronqué à 320 px').not.toBeNull();
      if (m) {
        expect(m.ellipse).toBe('ellipsis');
        expect(m.title).toBe('Z. Athekame');
        expect(m.lien).toBe('Fiche de Z. Athekame');
      }
    } finally { await page.close(); }
  });
});

describe.each([390, 1440])('noms des joueurs du terrain à %i px', (largeur) => {
  let page: Page;
  beforeAll(async () => { page = await ouvrir(largeur, lineup); });
  afterAll(async () => { await page?.close(); });

  it('R1 — le nom de chaque titulaire est entièrement dans le terrain (aucun bord coupé)', async () => {
    const m = await page.evaluate(() => {
      const t = document.querySelector('[data-testid="terrain"]')!.getBoundingClientRect();
      return [...document.querySelectorAll('[data-testid="terrain"] [data-testid="nom-joueur"]')].map((el) => {
        const r = el.getBoundingClientRect();
        return { nom: el.textContent, gauche: r.left - t.left, droite: t.right - r.right };
      });
    });
    expect(m).toHaveLength(11);
    for (const n of m) {
      expect(n.gauche, `${n.nom} à gauche`).toBeGreaterThanOrEqual(0);
      expect(n.droite, `${n.nom} à droite`).toBeGreaterThanOrEqual(0);
    }
  });

  it('R2 — le rond du numéro reste dans le terrain et un joueur central n\'est pas déplacé', async () => {
    const m = await page.evaluate(() => {
      const t = document.querySelector('[data-testid="terrain"]')!.getBoundingClientRect();
      const rond = (nom: string) => {
        const a = [...document.querySelectorAll('[data-testid="terrain"] a')].find((x) => x.textContent!.includes(nom))!;
        return a.querySelector('div')!.getBoundingClientRect();
      };
      const c = rond('Lacazette');
      return { gaucheT: rond('Tolisso').left - t.left, droiteN: t.right - rond('Nuamah-Longnom').right, centre: (c.left + c.right) / 2 - (t.left + t.right) / 2 };
    });
    expect(m.gaucheT).toBeGreaterThanOrEqual(0);
    expect(m.droiteN).toBeGreaterThanOrEqual(0);
    expect(Math.abs(m.centre)).toBeLessThan(1);
  });

  it('R4 — la pastille de note d\'un joueur de touche est entière dans le terrain', async () => {
    const m = await page.evaluate(() => {
      const t = document.querySelector('[data-testid="terrain"]')!.getBoundingClientRect();
      return [...document.querySelectorAll('[data-testid="terrain"] a [title^="Note"]')].map((el) => {
        const r = el.getBoundingClientRect();
        return { note: el.textContent, gauche: r.left - t.left, droite: t.right - r.right };
      });
    });
    expect(m.length).toBeGreaterThan(0);
    for (const n of m) {
      expect(n.gauche, `note ${n.note} à gauche`).toBeGreaterThanOrEqual(0);
      expect(n.droite, `note ${n.note} à droite`).toBeGreaterThanOrEqual(0);
    }
  });
});
