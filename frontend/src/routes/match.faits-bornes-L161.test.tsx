import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import type { LiveMatchStats } from '@/types/api';

// L161 — acceptation de l'écran page-match-faits-bornes (docs/specs/page-match-faits-bornes/fiche.yaml).
// Appel simulé (A1) : GET /api/live-match/{gameId}/stats, via le hook useLiveMatchStats.
// jsdom ne fait aucune mise en page : une géométrie simulée (lignes de fait de 44 px, 60 px sous 390 px)
// remplace clientHeight / scrollHeight / getBoundingClientRect de la liste (convention column-reverse de la
// maquette : scrollTop vaut 0 en bas et devient négatif en remontant). Un test qui s'appuie sur cette
// géométrie le dit dans son titre : ce n'est pas une mesure.
// Les règles de feuille de style (hauteur de ligne, borne, barre de défilement, repère, néon) sont vérifiées
// en ANALYSANT frontend/src/index.css par déclarations (sélecteur, @media, @supports, cascade), pas par
// regex libre ; les contrastes sont calculés (WCAG) depuis les jetons de :root.
// Ce que jsdom ne peut pas vérifier : un y en pixels (Momentum, carte des tirs), la hauteur réellement rendue
// d'une ligne, la troncature réelle, le défilement de la page à la molette, le défilement natif au clavier,
// la barre de défilement dessinée. Ces mesures se font dans un navigateur.

type HookResult = { isLoading: boolean; isError: boolean; data: LiveMatchStats | undefined };
let hook: HookResult;

vi.mock('@tanstack/react-router', () => ({
  useParams: () => ({ gameId: '10' }),
  useSearch: () => ({ matchupId: '465-1-10' }),
  Link: ({ children }: { children: React.ReactNode }) => <a href="/">{children}</a>,
}));
vi.mock('@/hooks/use-match-event-burst', () => ({ useMatchEventBurst: () => null }));
// Par défaut le hook est simulé (`hook`) ; le test « un seul appel » (R6) prend le vrai hook et compte les appels d'apiGet.
const reel = vi.hoisted(() => ({ actif: false, apiGet: vi.fn() }));
vi.mock('@/hooks/use-live-match', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks/use-live-match')>();
  return { ...actual, useLiveMatchStats: (gameId: number | null, matchupId: string | null) => (reel.actif ? actual.useLiveMatchStats(gameId, matchupId) : hook) };
});
vi.mock('@/lib/api', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/api')>()), apiGet: reel.apiGet }));
vi.mock('@/components/match-event-burst', () => ({ MatchEventBurst: () => null }));

import { MatchPage } from './match';

// ---------- sources de style ----------
function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const f = path.join(dir, name);
    if (statSync(f).isDirectory()) walk(f, out);
    else if (/\.(css|tsx?)$/.test(name) && !/\.(test|spec)\./.test(name)) out.push(f);
  }
  return out;
}
const SRC = walk(path.resolve(__dirname, '..'))
  .map((f) => readFileSync(f, 'utf8'))
  .join('\n')
  .replace(/_/g, ' ');

// ---------- géométrie simulée ----------
const LIST = '[data-testid="liste-faits"]';
const scrollTops = new WeakMap<Element, number>();
const ligne = () => (window.innerWidth < 390 ? 60 : 44);
const inList = (el: Element) => el.closest(LIST) !== null;
const nbFaits = (list: Element) => list.querySelectorAll('.ev').length;
const hauteurs = (list: Element) => {
  const sh = nbFaits(list) * ligne();
  return { sh, ch: Math.min(sh, 5 * ligne()) };
};
const proto = HTMLElement.prototype;
const defineOn = (name: string, get: (this: HTMLElement) => unknown, set?: (this: HTMLElement, v: number) => void) =>
  Object.defineProperty(Element.prototype, name, { configurable: true, get, ...(set ? { set } : {}) });
defineOn('clientHeight', function (this: HTMLElement) { return this.matches(LIST) ? hauteurs(this).ch : 0; });
defineOn('scrollHeight', function (this: HTMLElement) { return this.matches(LIST) ? hauteurs(this).sh : 0; });
defineOn(
  'scrollTop',
  function (this: HTMLElement) { return scrollTops.get(this) ?? 0; },
  function (this: HTMLElement, v: number) { if (this.matches(LIST)) { const { sh, ch } = hauteurs(this); scrollTops.set(this, Math.max(-(sh - ch), Math.min(0, v))); } },
);
Object.defineProperty(proto, 'offsetTop', { configurable: true, get(this: HTMLElement) { return this.classList.contains('ev') && inList(this) ? [...this.parentElement!.querySelectorAll('.ev')].indexOf(this) * ligne() : 0; } });
Object.defineProperty(proto, 'offsetHeight', { configurable: true, get(this: HTMLElement) { return this.classList.contains('ev') && inList(this) ? ligne() : 0; } });
const rect = (top: number, h: number) => ({ top, bottom: top + h, height: h, left: 0, right: 0, width: 0, x: 0, y: top, toJSON: () => ({}) }) as DOMRect;
Element.prototype.getBoundingClientRect = function (this: Element) {
  if (this.matches(LIST)) return rect(0, hauteurs(this).ch);
  if (this.classList.contains('ev') && inList(this)) {
    const list = this.closest(LIST)!;
    const { sh, ch } = hauteurs(list);
    const visTop = sh - ch + (scrollTops.get(list) ?? 0);
    const i = [...list.querySelectorAll('.ev')].indexOf(this);
    return rect(i * ligne() - visTop, ligne());
  }
  return rect(0, 0);
};
(Element.prototype as unknown as { scrollBy: unknown }).scrollBy = function (this: HTMLElement, a: ScrollToOptions | number, b?: number) {
  this.scrollTop += typeof a === 'number' ? (b ?? 0) : (a.top ?? 0);
};
(Element.prototype as unknown as { scrollTo: unknown }).scrollTo = function (this: HTMLElement, a: ScrollToOptions | number, b?: number) {
  this.scrollTop = typeof a === 'number' ? (b ?? 0) : (a.top ?? this.scrollTop);
};
(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };

// ---------- données ----------
const OL = 465;
const OPP = 1;
const MINUTES = ["9'", "14'", "23'", "31'", "41'", "46'", "52'", "58'", "61'", "64'", "67'", "70'", "78'", "81'", "84'", "86'", "90+2'", "90+4'"];
const FULL_TEAM = (k: number) => ({ Touches: 600 + k, 'Tirs au total': 14 - k, 'Tirs cadrés': 6 - k, 'Buts attendus': 1.87 - k });

function stats(nEvents: number): LiveMatchStats {
  const events = MINUTES.slice(MINUTES.length - nEvents).map((m, i) => ({
    competitorId: i % 2 === 0 ? OL : OPP, gameTime: 20 + i, gameTimeDisplay: m, type: 'yellowCard', isMajor: false,
    playerId: 1, extraPlayerId: null, playerName: `Joueur${i}`, playerShortName: null, extraPlayerName: null, description: 'Carton jaune',
  }));
  return {
    gameId: 10, matchupId: '465-1-10', competitionId: 35, competitionName: 'Ligue 1', status: 'ended', statusGroup: 4, statusText: 'Terminé',
    gameTime: 90, gameTimeDisplay: "90'", startTime: '2026-10-11T20:00:00Z',
    home: { id: OL, name: 'Lyon', symbolicName: 'OL', imageVersion: 1, score: 2 },
    away: { id: OPP, name: 'Lens', symbolicName: 'RCL', imageVersion: 1, score: 1 },
    teamStats: { home: FULL_TEAM(0), away: FULL_TEAM(1) },
    events, topPerformers: [], shots: [], momentum: undefined, lineups: undefined, standings: undefined,
    updatedAt: '2026-10-11T20:00:00Z',
  } as unknown as LiveMatchStats;
}

const setWidth = (w: number) => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: w });
  window.dispatchEvent(new Event('resize'));
};
const show = (n: number, width = 1440) => {
  setWidth(width);
  hook = { isLoading: false, isError: false, data: stats(n) };
  return render(<MatchPage />);
};
const liste = () => screen.getByTestId('liste-faits');
const repere = () => screen.getByTestId('repere-faits-anciens');
const norm = (s: string | null) => (s ?? '').replace(/\s+/g, ' ').trim();
const enButee = (list: HTMLElement) => {
  const { sh, ch } = hauteurs(list);
  list.scrollTop = -(sh - ch);
  fireEvent.scroll(list);
};

// ---------- feuille de style analysée par déclarations ----------
type Regle = { at: string[]; sel: string; decls: Record<string, string> };
const espaces = (v: string) => v.replace(/\s+/g, ' ').trim();

/** Découpe une feuille en règles (une par sélecteur) ; @media / @supports gardés dans `at`, @layer transparent, @keyframes ignoré. */
function analyserCss(css: string): Regle[] {
  const out: Regle[] = [];
  const lire = (txt: string, at: string[]) => {
    let i = 0;
    while (i < txt.length) {
      const o = txt.indexOf('{', i);
      if (o < 0) break;
      let depth = 1;
      let c = o + 1;
      while (c < txt.length && depth > 0) {
        if (txt[c] === '{') depth++;
        else if (txt[c] === '}') depth--;
        c++;
      }
      const prelude = espaces(txt.slice(i, o).replace(/@(?:tailwind|import|charset)[^;]*;/g, ''));
      const corps = txt.slice(o + 1, c - 1);
      i = c;
      if (prelude.startsWith('@media') || prelude.startsWith('@supports')) lire(corps, [...at, prelude]);
      else if (prelude.startsWith('@layer')) lire(corps, at);
      else if (prelude.startsWith('@')) continue;
      else {
        const decls: Record<string, string> = {};
        for (const d of corps.split(';')) {
          const k = d.indexOf(':');
          if (k > 0 && !d.trim().startsWith('@')) decls[d.slice(0, k).trim().toLowerCase()] = espaces(d.slice(k + 1));
        }
        for (const sel of prelude.split(',')) out.push({ at, sel: espaces(sel), decls });
      }
    }
  };
  lire(css.replace(/\/\*[\s\S]*?\*\//g, ''), []);
  return out;
}
const CSS = analyserCss(readFileSync(path.resolve(__dirname, '..', 'index.css'), 'utf8'));

/** Une condition d'@media largeur ou l'@supports « not selector(::-webkit-scrollbar) » (vrai seulement pour Firefox) tient-elle ? Toute autre condition (forced-colors…) : non. */
const condition = (at: string, largeur: number, firefox: boolean) => {
  const m = at.match(/^@media \(\s*(max|min)-width\s*:\s*(\d+)px\s*\)$/);
  if (m) return m[1] === 'max' ? largeur <= +m[2] : largeur >= +m[2];
  return firefox && /^@supports not selector\(\s*::-webkit-scrollbar\s*\)$/.test(at);
};
/** Valeur d'une propriété pour un sélecteur exact à une largeur : la dernière déclaration applicable de la feuille (ordre des sources). */
const valeur = (sel: string, prop: string, largeur = 1440, firefox = false): string | undefined => {
  let v: string | undefined;
  for (const r of CSS) if (r.sel === sel && prop in r.decls && r.at.every((a) => condition(a, largeur, firefox))) v = r.decls[prop];
  return v;
};
const ligneFait = (largeur: number) => valeur(':root', '--ligne-fait', largeur);

type Hsl = [number, number, number];
const jeton = (nom: string): Hsl => {
  const m = valeur(':root', `--${nom}`)?.match(/^(\d+) (\d+)% (\d+)%$/);
  if (!m) throw new Error(`jeton --${nom} introuvable dans index.css`);
  return [+m[1], +m[2], +m[3]];
};
/** Premier hsl(...) d'une valeur : jeton `hsl(var(--x) [/ a])` ou littéral `hsl(H S% L% [/ a])`. */
const hslDe = (v: string | undefined, depuis = 0): { c: Hsl; a: number } | undefined => {
  const m = v?.slice(depuis).match(/hsl\(\s*(?:var\(--([a-z0-9-]+)\)|(\d+) (\d+)% (\d+)%)\s*(?:\/\s*([\d.]+)\s*)?\)/);
  if (!m) return undefined;
  return { c: m[1] ? jeton(m[1]) : [+m[2], +m[3], +m[4]], a: m[5] ? +m[5] : 1 };
};
const rgbDe = ([h, s, l]: Hsl): number[] => {
  s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => { const k = (n + h / 30) % 12; return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
  return [f(0), f(8), f(4)];
};
const luminance = (rgb: number[]) => {
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]);
};
const contrasteRgb = (x: number[], y: number[]) => {
  const [p, q] = [luminance(x), luminance(y)];
  return (Math.max(p, q) + 0.05) / (Math.min(p, q) + 0.05);
};
const contrasteHsl = (x: Hsl, y: Hsl) => contrasteRgb(rgbDe(x), rgbDe(y));
/** Couleur `fg` d'opacité `a` posée sur `bg` (mélange sRGB, comme un navigateur). */
const fondu = (fg: number[], a: number, bg: number[]) => fg.map((c, i) => c * a + bg[i] * (1 - a));

/** La borne et la hauteur de ligne de la feuille de style à une largeur : 5 lignes de `--ligne-fait`, défilement vertical, départ en bas. */
const verifierBorneFeuille = (largeur: number, ligne: string) => {
  expect(ligneFait(largeur)).toBe(ligne);
  expect(valeur('.faits-liste', 'max-height', largeur)).toBe('calc(5 * var(--ligne-fait))');
  expect(valeur('.faits-liste', 'overflow-y', largeur)).toBe('auto');
  expect(valeur('.faits-liste', 'display', largeur)).toBe('flex');
  expect(valeur('.faits-liste', 'flex-direction', largeur)).toBe('column-reverse');
  expect(valeur('.faits-liste .ev', 'height', largeur)).toBe('var(--ligne-fait)');
  // aucune autre règle ne redéfinit la borne ni la hauteur d'une ligne
  for (const r of CSS.filter((x) => x.sel === '.faits-liste' && 'max-height' in x.decls)) expect(r.decls['max-height']).toBe('calc(5 * var(--ligne-fait))');
  for (const r of CSS.filter((x) => x.sel === '.faits-liste .ev')) {
    if ('height' in r.decls) expect(r.decls.height).toBe('var(--ligne-fait)');
    expect(r.decls).not.toHaveProperty('max-height');
    expect(r.decls).not.toHaveProperty('min-height');
  }
};

beforeEach(() => {
  setWidth(1440);
  reel.actif = false;
  reel.apiGet.mockReset();
});

describe('page-match-faits-bornes (L161)', () => {
  it('R1 — feuille de style à 1440 px : --ligne-fait 44 px, borne max-height calc(5 * var(--ligne-fait)) soit 220 px, overflow-y auto, column-reverse ; 18 faits dans le DOM (aucune hauteur mesurée)', () => {
    show(18, 1440);
    // R1 — « La liste des faits (...) est bornée à CINQ lignes de faits » ; « au-delà, elle défile verticalement dans le bloc »
    expect(liste().querySelectorAll('.ev').length).toBe(18);
    // R1 — « La borne s'écrit dans les deux cas max-height: calc(5 * var(--ligne-fait)) » ; « 44 px » : déclarations de .faits-liste lues dans index.css
    verifierBorneFeuille(1440, '44px');
    expect(5 * parseInt(ligneFait(1440)!, 10)).toBe(220);
  });

  it('R1 — feuille de style à 390 px : même borne que 1440 px (--ligne-fait 44 px, soit 220 px) ; 18 faits dans le DOM (aucune hauteur mesurée)', () => {
    show(18, 390);
    // R1 — « De 390 px à 1440 px (et au-delà) : 44 px » ; « max-height: calc(5 * var(--ligne-fait)) »
    expect(liste().querySelectorAll('.ev').length).toBe(18);
    verifierBorneFeuille(390, '44px');
    expect(5 * parseInt(ligneFait(390)!, 10)).toBe(220);
  });

  it('R1 — 320 px : feuille de style à 60 px (borne 300 px) et libellé sans troncature (line-clamp annulé), « minute · équipe » dans le DOM, borne simulée à 300 px ; la troncature réelle n\'est pas mesurée', () => {
    show(18, 320);
    // R1 — « Sous 390 px (...) : 60 px, sans aucune troncature » ; « le texte entier restant dans le DOM »
    verifierBorneFeuille(320, '60px');
    expect(5 * parseInt(ligneFait(320)!, 10)).toBe(300);
    for (const cell of ['.faits-liste .evl .fw', '.faits-liste .evr .fw']) {
      // au-dessus de 390 px : deux lignes au plus, ellipse ; en dessous : aucune troncature
      expect(valeur(cell, '-webkit-line-clamp', 390)).toBe('2');
      expect(valeur(cell, 'overflow', 390)).toBe('hidden');
      expect(valeur(cell, '-webkit-line-clamp', 320)).toBe('unset');
      expect(valeur(cell, 'overflow', 320)).toBe('visible');
      expect(valeur(cell, 'display', 320)).toBe('block');
    }
    // R1 — « minute · équipe (12 px, ex. « 81' · OL ») au-dessus du libellé » : la minute et l'équipe sont lues dans la ligne
    const ligne81 = [...liste().querySelectorAll('.ev')].find((e) => e.textContent?.includes("81'"));
    // le sigle attendu est celui de l'équipe de CE fait selon la fixture (competitorId vs home/away), pas un « OL » fixe
    const fx = stats(18);
    const fait81 = fx.events.find((e) => e.gameTimeDisplay === "81'");
    const sigle81 = fait81?.competitorId === fx.home.id ? fx.home.symbolicName : fx.away.symbolicName;
    expect(ligne81?.textContent).toMatch(new RegExp(`81'[\\s\\S]*${sigle81}`));
    // R1 — « la liste s'ouvre sur les 5 faits les plus récents » : borne de 5 lignes de 60 px (géométrie simulée du test)
    expect(hauteurs(liste()).ch).toBe(300);
  });

  it('R1 — feuille de style : la cascade donne --ligne-fait 60 px à 389, 360 et 320 px et 44 px à 390 et 391 px, borne de 5 lignes à chaque largeur (aucune hauteur mesurée)', () => {
    show(18, 389);
    // R1 — « Sous 390 px (390 exclu : 389 px et moins ...) : 60 px » ; « De 390 px à 1440 px (et au-delà) : 44 px »
    expect(liste()).toBeInTheDocument();
    for (const w of [389, 360, 320]) verifierBorneFeuille(w, '60px');
    for (const w of [390, 391]) verifierBorneFeuille(w, '44px');
    expect(5 * parseInt(ligneFait(389)!, 10)).toBe(300);
    expect(5 * parseInt(ligneFait(390)!, 10)).toBe(220);
  });

  it('R1 — positions simulées par le test : les 5 dernières lignes sont dans la vue à l\'ouverture, la sixième est hors de la vue', () => {
    show(18, 1440);
    const ch = hauteurs(liste()).ch;
    const lignes = [...liste().querySelectorAll('.ev')];
    const visibles = lignes.filter((e) => {
      const r = e.getBoundingClientRect();
      return r.top >= 0 && r.bottom <= ch;
    });
    // R1 — « la liste s'ouvre sur les 5 faits les plus récents (R2) »
    expect(visibles).toHaveLength(5);
    expect(visibles).toEqual(lignes.slice(-5));
    // R1 — « Avec 18 faits (...) la sixième hors de la vue » : la sixième à partir du bas n'est pas visible
    const r6 = lignes[lignes.length - 6].getBoundingClientRect();
    expect(r6.top >= 0 && r6.bottom <= ch).toBe(false);
  });

  it('R2 — 18 faits, positions simulées par le test : le dernier fait (90+4\') est dans la vue à l\'ouverture, les 5 derniers faits sont les 5 lignes dans la vue', () => {
    show(18, 1440);
    const list = liste();
    const ch = hauteurs(list).ch;
    const lignes = [...list.querySelectorAll('.ev')];
    const visibles = lignes.filter((e) => e.getBoundingClientRect().top >= 0 && e.getBoundingClientRect().bottom <= ch);
    // R2 — « les 5 derniers faits (ici 81' à 90+4') sont visibles à l'ouverture »
    expect(visibles.map((e) => e.textContent)).toEqual(lignes.slice(-5).map((e) => e.textContent));
    expect(visibles[visibles.length - 1].textContent).toContain("90+4'");
    expect(visibles[0].textContent).toContain("81'");
  });

  it('R2 — l\'ordre du DOM reste chronologique', () => {
    show(18, 1440);
    const texte = liste().textContent ?? '';
    // R2 — « l'ordre chronologique reste (plus ancien en haut, plus récent en bas) »
    const positions = MINUTES.map((m) => texte.indexOf(m + (m === "9'" ? '' : '')));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect(positions.slice(1).every((p, i) => p > positions[i])).toBe(true);
  });

  it('R3 — le compteur de l\'en-tête affiche le nombre d\'événements', () => {
    show(18);
    // R3 — « L'en-tête du bloc porte le nombre de faits (« 18 faits »). »
    expect(norm(screen.getByTestId('compte-faits').textContent)).toBe('18 faits');
  });

  it('R3 — 18 faits : le repère dit « 13 faits plus anciens » ; 6 faits : « 1 fait plus ancien »', () => {
    const a = show(18);
    // R3 — « une ligne de repère (...) « ↑ 13 faits plus anciens » »
    expect(norm(repere().textContent)).toContain('13 faits plus anciens');
    // R3 — « flèche masquée aux lecteurs d'écran »
    expect(repere().querySelector('[aria-hidden="true"]')?.textContent).toContain('↑');
    a.unmount();
    show(6);
    // R3 — « « 1 fait plus ancien » au singulier »
    expect(norm(repere().textContent)).toContain('1 fait plus ancien');
    expect(norm(repere().textContent)).not.toContain('faits plus anciens');
  });

  it('R3 — liste remontée tout en haut : le repère dit « Début du match », garde la même hauteur, porte aria-disabled="true" et un clic ne fait pas défiler', () => {
    show(18);
    const list = liste();
    enButee(list);
    // R3 — « N = 0 (liste tout en haut) donne « Début du match » sans flèche »
    expect(norm(repere().textContent)).toContain('Début du match');
    expect(repere().querySelector('[aria-hidden="true"]')).toBeNull();
    // R3 — « le bouton devient inactif : aria-disabled="true » ; « Il reste un bouton focusable »
    expect(repere()).toHaveAttribute('aria-disabled', 'true');
    expect(repere().tagName).toBe('BUTTON');
    expect(repere()).not.toBeDisabled();
    const avant = list.scrollTop;
    fireEvent.click(repere());
    // R3 — « un clic ou Entrée ne fait rien »
    expect(list.scrollTop).toBe(avant);
  });

  it('R3 — un clic sur le repère remonte la liste de 5 faits', () => {
    show(18, 1440);
    const list = liste();
    const avant = list.scrollTop;
    fireEvent.click(repere());
    // R3 — « un clic ou Entrée sur le bouton remonte la liste d'une hauteur de liste (5 faits ; (...) 220 px au-delà) »
    expect(list.scrollTop).toBe(avant - 220);
    fireEvent.scroll(list);
    // R3 — « N = nombre de faits entièrement au-dessus du bord haut de la liste, recalculé à chaque défilement »
    expect(norm(repere().textContent)).toContain('8 faits plus anciens');
  });

  it('R3 — le repère est un bouton hors de la zone défilante, de 32 px de haut (feuille de style) et de contraste texte >= 4,5:1 (calculé depuis les jetons, repos et survol)', () => {
    show(18);
    // R3 — « une ligne de repère de 32 px, qui est un bouton »
    expect(repere().tagName).toBe('BUTTON');
    // R3 — « Sous l'en-tête, (...) hors de la zone défilante » : le repère n'est pas dans la liste, mais dans le bloc Faits
    expect(liste().contains(repere())).toBe(false);
    expect(screen.getByTestId('faits-match').contains(repere())).toBe(true);
    // R3 — « une ligne de repère de 32 px » : hauteur déclarée sur .faits-repere (largeurs 1440 et 320 : aucune règle ne la change)
    for (const w of [1440, 320]) expect(valeur('.faits-repere', 'height', w) ?? valeur('.faits-repere', 'min-height', w)).toBe('32px');
    // R3 — « Texte --fg-muted sur le fond du repère : 7,11:1 mesuré (WCAG 1.4.3 exige 4,5:1) »
    // fond = --surface-2 à son opacité posé sur le fond du bloc (le padding-box de .faits-bloc est --surface)
    expect(valeur('.faits-bloc', 'background')).toMatch(/^linear-gradient\(hsl\(var\(--surface\)\), hsl\(var\(--surface\)\)\) padding-box/);
    const fondRepere = hslDe(valeur('.faits-repere', 'background'))!;
    expect(fondRepere.c).toEqual(jeton('surface-2'));
    const fond = fondu(rgbDe(fondRepere.c), fondRepere.a, rgbDe(jeton('surface')));
    const texte = hslDe(valeur('.faits-repere', 'color'))!;
    expect(texte.c).toEqual(jeton('fg-muted'));
    expect(contrasteRgb(rgbDe(texte.c), fond)).toBeGreaterThanOrEqual(4.5);
    // survol (actif) : --fg ; survol d'un repère inactif : --fg-muted
    expect(contrasteRgb(rgbDe(hslDe(valeur('.faits-repere:hover', 'color'))!.c), fond)).toBeGreaterThanOrEqual(4.5);
    expect(contrasteRgb(rgbDe(hslDe(valeur(".faits-repere[aria-disabled='true']:hover", 'color'))!.c), fond)).toBeGreaterThanOrEqual(4.5);
  });

  it('R4 — 5 faits (géométrie simulée) : hauteur de la liste = 5 lignes, scrollHeight = clientHeight, pas de repère', () => {
    show(5);
    // R4 — « la liste tient dans la borne de 5 lignes : le bloc garde sa hauteur naturelle, sans barre de défilement »
    expect(liste().querySelectorAll('.ev')).toHaveLength(5);
    expect(liste().scrollHeight).toBe(liste().clientHeight);
    // R4 — « sans ligne de repère » ; « le compteur dit « 5 faits » »
    expect(screen.queryByTestId('repere-faits-anciens')).toBeNull();
    expect(norm(screen.getByTestId('compte-faits').textContent)).toBe('5 faits');
  });

  it('R4 — 5 faits : la liste n\'a ni tabindex ni role region', () => {
    show(5);
    // R4 — « la liste est alors ni focusable ni une région (pas de tabindex, pas de role, pas d'aria-label) »
    expect(liste()).not.toHaveAttribute('tabindex');
    expect(liste()).not.toHaveAttribute('role');
    expect(liste()).not.toHaveAttribute('aria-label');
  });

  it('R4 — 6 faits (géométrie simulée) : la liste déborde, le repère dit « 1 fait plus ancien » et la liste a tabindex 0', () => {
    show(6);
    // R4 — « Dès 6 faits la liste défile, le repère dit « 1 fait plus ancien » et le tabindex apparaît. »
    expect(liste().scrollHeight).toBeGreaterThan(liste().clientHeight);
    expect(norm(repere().textContent)).toContain('1 fait plus ancien');
    expect(liste()).toHaveAttribute('tabindex', '0');
  });

  it('R5 — feuille de style : --ligne-fait vaut 44 px à 1440 et à 390 et 60 px à 389, 360 et 320 par la cascade, la max-height de la liste reste calc(5 * var(--ligne-fait)) (ni hauteur en px)', () => {
    // R5 — « hauteur de ligne fixe, 44 px de 390 px à 1440 px et 60 px sous 390 px (R1) »
    for (const w of [1440, 390]) expect(ligneFait(w)).toBe('44px');
    for (const w of [389, 360, 320]) expect(ligneFait(w)).toBe('60px');
    // R5 — « la borne reste exprimée en lignes (calc(5 * var(--ligne-fait))) » : à chaque largeur, la borne vaut 5 fois la ligne
    for (const w of [1440, 390, 389, 360, 320]) {
      expect(valeur('.faits-liste', 'max-height', w)).toBe('calc(5 * var(--ligne-fait))');
      expect(valeur('.faits-liste', 'height', w)).toBeUndefined();
    }
  });

  // R10 — « Le défilement de la liste ne piège ni la molette ni le balayage ». jsdom ne défile pas : on ne mesure pas scrollY,
  // on vérifie ce qui piègerait le geste (overscroll-behavior contain/none, gestionnaire wheel qui annule l'événement).
  const SANS_PIEGE = /^(?!.*\b(contain|none)\b)/;
  const ancetres = (el: Element) => { const l: Element[] = []; for (let e: Element | null = el; e; e = e.parentElement) l.push(e); return l; };
  const molette = (cible: Element, deltaY: number) => {
    const evt = new WheelEvent('wheel', { deltaY, bubbles: true, cancelable: true });
    cible.dispatchEvent(evt);
    return evt.defaultPrevented;
  };
  const fichiersDeLaListe = walk(path.resolve(__dirname, '..'))
    .filter((f) => /\.tsx?$/.test(f))
    .map((f) => ({ f, texte: readFileSync(f, 'utf8') }))
    .filter(({ texte }) => texte.includes('faits-liste'));

  it('R10 — overscroll-behavior ni contain ni none sur .faits-liste et .faits-bloc (feuille de style, classes et style en ligne de la liste et de ses ancêtres)', () => {
    show(18);
    // R10 — « overscroll-behavior garde sa valeur par défaut (auto), jamais contain ni none » : toute règle qui vise .faits-liste ou .faits-bloc, à toute largeur
    const visees = CSS.filter((r) => /\.faits-(liste|bloc)/.test(r.sel));
    expect(visees.length).toBeGreaterThan(5);
    for (const r of visees) for (const [prop, v] of Object.entries(r.decls)) if (prop.startsWith('overscroll-behavior')) expect(v).toMatch(SANS_PIEGE);
    for (const sel of ['.faits-liste', '.faits-bloc']) for (const prop of ['overscroll-behavior', 'overscroll-behavior-y']) {
      for (const w of [1440, 390, 320]) expect(valeur(sel, prop, w) ?? 'auto').toMatch(SANS_PIEGE);
    }
    // classes (Tailwind overscroll-contain / overscroll-y-none…) et style en ligne de la liste, du bloc et de leurs ancêtres
    for (const el of ancetres(liste())) {
      expect(el.getAttribute('class') ?? '').not.toMatch(/overscroll(-[xy])?-(contain|none)/);
      expect(el.getAttribute('style') ?? '').not.toMatch(/overscroll-behavior[^;]*(contain|none)/);
    }
    // R10 — la liste existe bien (le bloc est rendu)
    expect(liste()).toBeInTheDocument();
  });

  it('R11 — la liste qui déborde a tabindex 0, role region et un nom accessible', () => {
    show(18);
    // R11 — « elle est focusable (tabindex 0), porte role region et aria-label « Faits du match, du plus ancien au plus récent » »
    expect(liste()).toHaveAttribute('tabindex', '0');
    expect(liste()).toHaveAttribute('role', 'region');
    expect(liste()).toHaveAttribute('aria-label', 'Faits du match, du plus ancien au plus récent');
  });

  it('R11 — feuille de style : contour au :focus-visible de 2 px en --ol-red-bright décalé de -2 px sur la liste et sur le repère', () => {
    // R11 — « un contour de 2 px en --ol-red-bright (...) décalé de -2 px vers l'intérieur » ; « Le bouton du repère (R3) (...) porte le même anneau »
    for (const sel of ['.faits-liste:focus-visible', '.faits-repere:focus-visible']) {
      expect(valeur(sel, 'outline')).toBe('2px solid hsl(var(--ol-red-bright))');
      expect(valeur(sel, 'outline-offset')).toBe('-2px');
    }
  });

  // R12 — la barre est décrite par la feuille de style : règles `.faits-liste::-webkit-scrollbar*` (Chrome, Safari) et repli Firefox
  // sous @supports not selector(::-webkit-scrollbar). Les couleurs viennent des jetons de :root ; les contrastes sont calculés.
  const L = '.faits-liste';
  const barre = (partie: string, prop: string) => valeur(`${L}::-webkit-scrollbar${partie}`, prop);

  it('R12 — barre fine de 10 px, piste --surface bordée de 1 px --ol-blue-bright avec halo bleu, curseur --ol-blue de rayon 5 px bordé de 1 px --ol-red, sans bouton fléché, halo rouge au survol, repli Firefox sous @supports', () => {
    // R12 — « Largeur 10 px (::-webkit-scrollbar, plage voulue 8 à 10 px) »
    expect(Number(barre('', 'width')?.match(/^(\d+)px$/)?.[1])).toBeGreaterThanOrEqual(8);
    expect(Number(barre('', 'width')?.match(/^(\d+)px$/)?.[1])).toBeLessThanOrEqual(10);
    // R12 — « piste de la couleur de la surface du bloc, --surface (...) cernée d'une bordure de 1 px --ol-blue-bright et d'un léger halo bleu néon »
    expect(hslDe(barre('-track', 'background'))?.c).toEqual(jeton('surface'));
    expect(barre('-track', 'border')).toBe('1px solid hsl(var(--ol-blue-bright))');
    expect(barre('-track', 'box-shadow')).toBe('inset 0 0 6px hsl(var(--ol-blue-bright) / 0.55)');
    // R12 — « curseur arrondi (rayon 5 px) dont l'intérieur est le bleu foncé du site, --ol-blue, cerné d'une bordure de 1 px --ol-red »
    expect(hslDe(barre('-thumb', 'background'))?.c).toEqual(jeton('ol-blue'));
    expect(barre('-thumb', 'border')).toBe('1px solid hsl(var(--ol-red))');
    expect(barre('-thumb', 'border-radius')).toBe('5px');
    // R12 — « AUCUN bouton fléché : ::-webkit-scrollbar-button { display: none } »
    expect(barre('-button', 'display')).toBe('none');
    // R12 — « Au survol du curseur, un halo rouge néon : 0 0 6px 1px hsl(0 95% 60% / 0,7) (...) avec une ombre intérieure de même teinte »
    expect(valeur(`${L}::-webkit-scrollbar-thumb:hover`, 'box-shadow')).toMatch(/^0 0 6px 1px hsl\(0 95% 60% \/ 0?\.7\), inset 0 0 \d+px hsl\(0 95% 60% \/ 0?\.7\)$/);
    // R12 — Firefox : « scrollbar-width: thin et scrollbar-color: hsl(226 56% 51%) hsl(228 21% 8%) » sous @supports not selector(::-webkit-scrollbar)
    expect(valeur(L, 'scrollbar-width', 1440, true)).toBe('thin');
    expect(valeur(L, 'scrollbar-color', 1440, true)).toBe('hsl(var(--ol-blue-bright)) hsl(var(--surface))');
    // R12 — « cette déclaration n'est PAS posée pour Chrome 121+ et Safari 18.2+ » : rien de tel hors du @supports
    expect(valeur(L, 'scrollbar-color', 1440, false)).toBeUndefined();
    expect(valeur(L, 'scrollbar-width', 1440, false)).toBeUndefined();
  });

  it('R12 — contrastes calculés >= 3:1 (WCAG 1.4.11) : bordure du curseur sur la piste, bordure de la piste sur le fond du bloc, repli Firefox', () => {
    const piste = hslDe(barre('-track', 'background'))!.c;
    const bordureCurseur = hslDe(barre('-thumb', 'border'))!.c;
    const bordurePiste = hslDe(barre('-track', 'border'))!.c;
    const fondBloc = jeton('surface');
    // R12 — « bordure rouge du curseur sur la piste --surface 3,85:1 » ; « bordure bleue de la piste sur le fond du bloc --surface 3,20:1 »
    expect(contrasteHsl(bordureCurseur, piste)).toBeGreaterThanOrEqual(3);
    expect(contrasteHsl(bordurePiste, fondBloc)).toBeGreaterThanOrEqual(3);
    // R12 — « Firefox (...) curseur --ol-blue-bright, piste --surface : 3,20:1, soit au moins 3:1 »
    const [curseurFx, pisteFx] = [...(valeur(L, 'scrollbar-color', 1440, true) ?? '').matchAll(/hsl\(var\(--([a-z-]+)\)\)/g)].map((m) => jeton(m[1]));
    expect(contrasteHsl(curseurFx, pisteFx)).toBeGreaterThanOrEqual(3);
  });

  it('R13 — le bloc Faits a une bordure de 1 px et un box-shadow composé des teintes rouge (0) et bleue (224) du néon', () => {
    show(18);
    // R13 — « Bordure de 1 px en dégradé vertical » ; « Le bloc n'est donc plus en overflow: hidden. »
    expect(valeur('.faits-bloc', 'border')).toBe('1px solid transparent');
    expect(screen.getByTestId('faits-match').className).not.toMatch(/overflow-hidden/);
    // R13 — « les trois ombres des bords néon (...) hsl(0 95% 60% / 0,7) (...) et leurs trois équivalents bleus à la teinte 224 »
    // lues sur la déclaration box-shadow de .faits-bloc elle-même (pas dans l'ensemble des sources : la barre latérale porte les mêmes ombres)
    const ombres = valeur('.faits-bloc', 'box-shadow') ?? '';
    expect(ombres).toMatch(/hsl\(0 95% 60%\s*\/\s*0?\.7\)[^;]*hsl\(224 95% 60%\s*\/\s*0?\.7\)|hsl\(224 95% 60%\s*\/\s*0?\.7\)[^;]*hsl\(0 95% 60%\s*\/\s*0?\.7\)/);
    expect(ombres).toMatch(/hsl\(0 95% 55%\s*\/\s*0?\.45\)/);
    expect(ombres).toMatch(/hsl\(224 95% 55%\s*\/\s*0?\.45\)/);
    expect(ombres).toMatch(/hsl\(0 90% 50%\s*\/\s*0?\.2\)/);
    expect(ombres).toMatch(/hsl\(224 90% 50%\s*\/\s*0?\.2\)/);
    // R13 — « Bordure de 1 px en dégradé vertical » : le dégradé rouge (0) vers bleu (224) est posé en border-box sur .faits-bloc
    const fond = valeur('.faits-bloc', 'background') ?? '';
    expect(fond).toMatch(/linear-gradient\(180deg,\s*hsl\(0 [^)]*\)[^;]*hsl\(224 [^)]*\)[^;]*\)\s*border-box/);
  });

  it('R13 — aucune teinte verte dans la bordure ni la barre de défilement', () => {
    show(18);
    // R13 — « Aucun vert. » : ni le bloc ni la liste ne portent de classe verte
    const classes = `${screen.getByTestId('faits-match').className} ${liste().className}`;
    expect(classes).not.toMatch(/green|lime|emerald|teal/);
    // R12 — la barre de défilement (règles ::-webkit-scrollbar*, repli Firefox) n'a aucune teinte entre 80 et 170 : teintes littérales et jetons
    const decl = CSS.filter((r) => r.sel.startsWith(`${L}::-webkit-scrollbar`)).flatMap((r) => Object.values(r.decls)).join(';')
      + `;${valeur(L, 'scrollbar-color', 1440, true) ?? ''}`;
    expect(decl).toMatch(/hsl/);
    const teintes = [...decl.matchAll(/hsl\(\s*(?:var\(--([a-z-]+)\)|(\d+)\s)/g)].map((m) => (m[1] ? jeton(m[1])[0] : +m[2]));
    expect(teintes.length).toBeGreaterThan(5);
    for (const h of teintes) expect(h < 80 || h > 170).toBe(true);
  });

  // ---------- ajouts de la seconde passe ----------
  // Les mesures en pixels (y du Momentum, molette, touches natives) exigent un navigateur : ici, seuls leurs
  // prérequis vérifiables en jsdom sont assertés (bornes de la liste, ordre des blocs, événements non interceptés).
  const complet = (n = 18, width = 1440) => {
    setWidth(width);
    const data = stats(n);
    data.momentum = Array.from({ length: 10 }, (_, i) => ({ minute: i * 10, value: i % 2 ? 40 : -40 }));
    data.shots = [{ competitorId: OL, playerId: 1, time: "12'", xg: 0.2, xgot: 0.1, bodyPart: 'foot', outcome: 'saved', line: 10, side: 30 }];
    hook = { isLoading: false, isError: false, data };
    return render(<MatchPage />);
  };
  const ordreCentre = () => {
    const centre = screen.getByTestId('colonne-centre');
    return ['faits-match', 'elan', 'carte-tirs', 'bloc-statistiques'].map((id) => {
      const el = screen.getByTestId(id);
      return { id, dedans: centre.contains(el), el };
    });
  };
  const precede = (a: Element, b: Element) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

  it('R1 — à 1440 : ordre du DOM Faits, Momentum, carte des tirs et liste de 220 px (borne de la feuille et géométrie simulée) ; les y de 576 à 807 et 823 ne sont pas mesurés ici', () => {
    complet(18, 1440);
    // R1 — « Avec 18 faits le bloc passe de 833 px à 293 px (en-tête, repère de 32 px, liste de 220 px, bordures) » : borne de la feuille = 220 px
    expect(5 * parseInt(ligneFait(1440)!, 10)).toBe(220);
    expect(liste().clientHeight).toBe(220);
    // R1 — « Momentum » puis « carte des tirs » restent présents sous le bloc Faits (leur y exact exige un navigateur)
    const [faits, elan, tirs] = ordreCentre();
    expect(precede(faits.el, elan.el)).toBe(true);
    expect(precede(elan.el, tirs.el)).toBe(true);
  });

  it('R1 — à 390 : ordre du DOM Faits, Momentum, carte des tirs et liste de 220 px (borne de la feuille et géométrie simulée) ; le y de 689 < 786 n\'est pas mesuré ici', () => {
    complet(18, 390);
    // R1 — « Avec 18 faits le bloc passe de 833 px à 293 px » : borne de 5 lignes de 44 px à 390 px
    expect(5 * parseInt(ligneFait(390)!, 10)).toBe(220);
    expect(liste().clientHeight).toBe(220);
    // R1 — « Momentum » puis « carte des tirs » restent sous le bloc Faits (leur y exact exige un navigateur)
    const [faits, elan, tirs] = ordreCentre();
    expect(precede(faits.el, elan.el)).toBe(true);
    expect(precede(elan.el, tirs.el)).toBe(true);
  });

  it('R6 — l\'ordre des blocs du centre est inchangé', () => {
    complet(18, 1440);
    const blocs = ordreCentre();
    // R6 — « ordre des blocs du centre (Faits, Momentum, Carte des tirs, Statistiques) » : le bloc Faits contient sa liste des faits
    expect(screen.getByTestId('faits-match').contains(liste())).toBe(true);
    expect(blocs.every((b) => b.dedans)).toBe(true);
    for (let i = 1; i < blocs.length; i++) expect(precede(blocs[i - 1].el, blocs[i].el)).toBe(true);
  });

  it('R6 — un seul appel /api/live-match/{gameId}/stats : vrai hook, apiGet simulé et compté, la page se rend depuis cette seule réponse', async () => {
    setWidth(1440);
    reel.actif = true;
    const data = stats(18);
    data.momentum = Array.from({ length: 10 }, (_, i) => ({ minute: i * 10, value: i % 2 ? 40 : -40 }));
    data.shots = [{ competitorId: OL, playerId: 1, time: "12'", xg: 0.2, xgot: 0.1, bodyPart: 'foot', outcome: 'saved', line: 10, side: 30 }];
    reel.apiGet.mockResolvedValue(data);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><MatchPage /></QueryClientProvider>);
    // R6 — « appel API (GET /api/live-match/{gameId}/stats, aucun champ ajouté) » : la page se rend depuis cette seule réponse
    expect(await screen.findByTestId('liste-faits')).toBeInTheDocument();
    expect(liste().querySelectorAll('.ev')).toHaveLength(18);
    expect(screen.getByTestId('bloc-statistiques')).toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 50)); // laisse passer un éventuel second appel
    expect(reel.apiGet).toHaveBeenCalledTimes(1);
    expect(reel.apiGet.mock.calls[0][0]).toBe('/live-match/10/stats?matchupId=465-1-10');
  });

  it('R7 — chargement : message, aucun bloc', () => {
    // R7/R8 — contraste de l'état chargé : avec des faits, la liste des faits est affichée
    const charge = show(18, 1440);
    expect(liste()).toBeInTheDocument();
    charge.unmount();
    hook = { isLoading: true, isError: false, data: undefined };
    render(<MatchPage />);
    // R7 — « le message d'attente existant s'affiche, sans grille »
    expect(norm(screen.getByTestId('message-chargement').textContent)).toBe('Chargement du match…');
    expect(screen.queryByTestId('grille-match')).toBeNull();
    expect(screen.queryByTestId('faits-match')).toBeNull();
  });

  it('R8 — erreur : message, aucun bloc', () => {
    // R7/R8 — contraste de l'état chargé : avec des faits, la liste des faits est affichée
    const charge = show(18, 1440);
    expect(liste()).toBeInTheDocument();
    charge.unmount();
    hook = { isLoading: false, isError: true, data: undefined };
    render(<MatchPage />);
    // R8 — « l'erreur existante s'affiche avec un lien de retour »
    expect(norm(screen.getByTestId('message-erreur').textContent)).toContain('Match introuvable');
    expect(screen.getByRole('link')).toBeInTheDocument();
    expect(screen.queryByTestId('faits-match')).toBeNull();
  });

  it('R9 — vide : aucun bloc Faits, message de statistiques', () => {
    // R9 — contraste : avec des faits, le bloc Faits et sa liste sont affichés
    const charge = show(18, 1440);
    expect(liste()).toBeInTheDocument();
    charge.unmount();
    setWidth(1440);
    const data = stats(0);
    data.teamStats = { home: {}, away: {} };
    hook = { isLoading: false, isError: false, data };
    render(<MatchPage />);
    // R9 — « Sans fait, le bloc Faits du match n'est pas affiché »
    expect(screen.getByTestId('grille-match')).toBeInTheDocument();
    expect(screen.queryByTestId('faits-match')).toBeNull();
    expect(screen.queryByTestId('liste-faits')).toBeNull();
    // R9 — « le bloc Statistiques annonce l'absence de chiffres »
    expect(norm(screen.getByTestId('message-stats-vide').textContent)).toBe('Pas encore de statistiques.');
  });

  it('R10 — la molette vers le bas sur la liste ouverte n\'est pas interceptée : aucun gestionnaire wheel dans les sources de la liste, événement non annulé (le défilement de la page n\'est pas mesuré)', () => {
    show(18, 1440);
    // R10 — « un défilement vers le bas commencé sur la liste fait défiler la page tout de suite » : rien n'annule la molette.
    // Un onWheel React est passif (preventDefault sans effet visible sur l'événement) : la lecture des sources complète l'événement envoyé.
    expect(fichiersDeLaListe.map(({ f }) => path.basename(f))).toContain('match.tsx');
    for (const { texte } of fichiersDeLaListe) expect(texte).not.toMatch(/onWheel|addEventListener\(\s*['"`]wheel/);
    expect(molette(liste(), 400)).toBe(false);
    expect(molette(screen.getByTestId('faits-match'), 400)).toBe(false);
  });

  it('R10 — liste en butée haute, la molette vers le haut n\'est pas interceptée (événement non annulé, aucun gestionnaire wheel ; la remontée de la page n\'est pas mesurée)', () => {
    show(18, 1440);
    enButee(liste());
    // R10 — « arrivée en butée haute, un défilement vers le haut passe à la page » : rien n'annule la molette
    expect(molette(liste(), -300)).toBe(false);
    for (const { texte } of fichiersDeLaListe) expect(texte).not.toMatch(/onWheel|addEventListener\(\s*['"`]wheel/);
  });

  it('R11 — liste focusable : Fin et Début ne sont pas interceptés (le défilement natif n\'est pas simulable en jsdom)', () => {
    show(18, 1440);
    const list = liste();
    list.focus();
    // R11 — « elle est focusable (tabindex 0) » : elle peut recevoir Début et Fin
    expect(list).toHaveAttribute('tabindex', '0');
    expect(document.activeElement).toBe(list);
    // R11 — « Début et Fin la font défiler (comportement natif) » : les touches ne sont pas interceptées
    const fin = new KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true });
    list.dispatchEvent(fin);
    expect(fin.defaultPrevented).toBe(false);
    const debut = new KeyboardEvent('keydown', { key: 'Home', bubbles: true, cancelable: true });
    list.dispatchEvent(debut);
    expect(debut.defaultPrevented).toBe(false);
  });
});
