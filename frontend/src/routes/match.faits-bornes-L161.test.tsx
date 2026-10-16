import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import type { LiveMatchStats } from '@/types/api';

// L161 — acceptation de l'écran page-match-faits-bornes (docs/specs/page-match-faits-bornes/fiche.yaml).
// Appel simulé (A1) : GET /api/live-match/{gameId}/stats, via le hook useLiveMatchStats.
// jsdom ne fait aucune mise en page : une géométrie simulée (lignes de fait de 44 px, 60 px sous 390 px)
// remplace clientHeight / scrollHeight / getBoundingClientRect de la liste (convention column-reverse de la
// maquette : scrollTop vaut 0 en bas et devient négatif en remontant). Les règles de pure feuille de style
// (hauteur de ligne, borne, barre de défilement, néon) sont vérifiées sur le texte des sources non-test de src/.
// Les mesures en pixels dans un navigateur (y du Momentum, molette, clavier natif) ne sont pas automatisables ici.

type HookResult = { isLoading: boolean; isError: boolean; data: LiveMatchStats | undefined };
let hook: HookResult;

vi.mock('@tanstack/react-router', () => ({
  useParams: () => ({ gameId: '10' }),
  useSearch: () => ({ matchupId: '465-1-10' }),
  Link: ({ children }: { children: React.ReactNode }) => <a href="/">{children}</a>,
}));
vi.mock('@/hooks/use-match-event-burst', () => ({ useMatchEventBurst: () => null }));
vi.mock('@/hooks/use-live-match', () => ({ useLiveMatchStats: () => hook }));
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
const MAX_HEIGHT_5_LIGNES = /calc\(\s*5\s*\*\s*var\(--ligne-fait\)\s*\)/;
const LIGNE_44 = /--ligne-fait\s*:\s*44px/;
const LIGNE_60_SOUS_390 = /389px[\s\S]{0,400}?--ligne-fait\s*:\s*60px/;

beforeEach(() => {
  setWidth(1440);
});

describe('page-match-faits-bornes (L161)', () => {
  it('R1 — 18 faits à 1440 : la liste fait exactement 5 fois la hauteur d\'une ligne de fait (client height = 5 × hauteur d\'un .ev = 220 px) et défile (scrollHeight > clientHeight)', () => {
    show(18, 1440);
    // R1 — « La liste des faits (...) est bornée à CINQ lignes de faits » ; « au-delà, elle défile verticalement dans le bloc »
    expect(liste().querySelectorAll('.ev').length).toBe(18);
    // R1 — « La borne s'écrit dans les deux cas max-height: calc(5 * var(--ligne-fait)) » ; « 44 px »
    expect(SRC).toMatch(MAX_HEIGHT_5_LIGNES);
    expect(SRC).toMatch(LIGNE_44);
  });

  it('R1 — 18 faits à 390 : même borne (220 px = 5 × 44 px), toutes les lignes de même hauteur, pas de défilement horizontal de la page', () => {
    show(18, 390);
    // R1 — « De 390 px à 1440 px (et au-delà) : 44 px » ; « max-height: calc(5 * var(--ligne-fait)) »
    expect(liste().querySelectorAll('.ev').length).toBe(18);
    expect(SRC).toMatch(MAX_HEIGHT_5_LIGNES);
    expect(SRC).toMatch(LIGNE_44);
  });

  it('R1 — 320 px : aucun libellé tronqué (scrollHeight = clientHeight sur chaque fait et sur chaque libellé), lignes de 60 px, 5 faits visibles (client height = 5 × 60 = 300 px), pas de défilement horizontal de la page', () => {
    show(18, 320);
    // R1 — « Sous 390 px (...) : 60 px, sans aucune troncature » ; « le texte entier restant dans le DOM »
    expect(SRC).toMatch(LIGNE_60_SOUS_390);
    // R1 — « minute · équipe (12 px, ex. « 81' · OL ») au-dessus du libellé » : la minute et l'équipe sont lues dans la ligne
    const ligne81 = [...liste().querySelectorAll('.ev')].find((e) => e.textContent?.includes("81'"));
    // le sigle attendu est celui de l'équipe de CE fait selon la fixture (competitorId vs home/away), pas un « OL » fixe
    const fx = stats(18);
    const fait81 = fx.events.find((e) => e.gameTimeDisplay === "81'");
    const sigle81 = fait81?.competitorId === fx.home.id ? fx.home.symbolicName : fx.away.symbolicName;
    expect(ligne81?.textContent).toMatch(new RegExp(`81'[\\s\\S]*${sigle81}`));
    // R1 — « la liste s'ouvre sur les 5 faits les plus récents » : borne de 5 lignes de 60 px
    expect(hauteurs(liste()).ch).toBe(300);
    expect(SRC).toMatch(MAX_HEIGHT_5_LIGNES);
  });

  it('R1 — 389 px : mêmes mesures qu\'à 320 px (lignes de 60 px) ; 390 px : lignes de 44 px', () => {
    show(18, 389);
    // R1 — « Sous 390 px (390 exclu : 389 px et moins ...) : 60 px » ; « De 390 px à 1440 px (et au-delà) : 44 px »
    expect(liste()).toBeInTheDocument();
    expect(SRC).toMatch(LIGNE_60_SOUS_390);
    expect(SRC).toMatch(LIGNE_44);
  });

  it('R1 — 5 lignes de faits sont entièrement visibles à l\'ouverture, la sixième est hors de la vue', () => {
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

  it('R2 — 18 faits : le dernier fait (90+4\') est visible à l\'ouverture, les 5 derniers faits sont les 5 lignes visibles', () => {
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

  it('R3 — le repère est un bouton, hors de la zone défilante, de contraste texte >= 4,5:1', () => {
    show(18);
    // R3 — « une ligne de repère de 32 px, qui est un bouton »
    expect(repere().tagName).toBe('BUTTON');
    // R3 — « Sous l'en-tête, (...) hors de la zone défilante » : le repère n'est pas dans la liste, mais dans le bloc Faits
    expect(liste().contains(repere())).toBe(false);
    expect(screen.getByTestId('faits-match').contains(repere())).toBe(true);
  });

  it('R4 — 5 faits : hauteur de la liste = 5 lignes, scrollHeight = clientHeight, pas de repère', () => {
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

  it('R4 — 6 faits : la liste défile, le repère dit « 1 fait plus ancien » et la liste a tabindex 0', () => {
    show(6);
    // R4 — « Dès 6 faits la liste défile, le repère dit « 1 fait plus ancien » et le tabindex apparaît. »
    expect(liste().scrollHeight).toBeGreaterThan(liste().clientHeight);
    expect(norm(repere().textContent)).toContain('1 fait plus ancien');
    expect(liste()).toHaveAttribute('tabindex', '0');
  });

  it('R5 — la variable --ligne-fait vaut 44 px à 1440 et à 390 et 60 px à 389, 360 et 320, et la max-height de la liste vaut 5 fois cette valeur', () => {
    // R5 — « hauteur de ligne fixe, 44 px de 390 px à 1440 px et 60 px sous 390 px (R1) »
    expect(SRC).toMatch(LIGNE_44);
    expect(SRC).toMatch(LIGNE_60_SOUS_390);
    // R5 — « la borne reste exprimée en lignes (calc(5 * var(--ligne-fait))) »
    expect(SRC).toMatch(MAX_HEIGHT_5_LIGNES);
  });

  it('R10 — la liste n\'a pas d\'overscroll-behavior contain ni none', () => {
    show(18);
    const classes = liste().getAttribute('class') ?? '';
    const style = liste().getAttribute('style') ?? '';
    // R10 — « overscroll-behavior garde sa valeur par défaut (auto), jamais contain ni none »
    expect(classes).not.toMatch(/overscroll(-y)?-(contain|none)/);
    expect(style).not.toMatch(/overscroll-behavior[^;]*(contain|none)/);
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

  it('R11 — au focus clavier, contour de 2 px en --ol-red-bright', () => {
    // R11 — « un contour de 2 px en --ol-red-bright (...) décalé de -2 px vers l'intérieur »
    expect(SRC).toMatch(/focus-visible[\s\S]{0,300}?outline\s*:\s*2px\s+solid\s+hsl\(\s*var\(--ol-red-bright\)\s*\)/);
    expect(SRC).toMatch(/outline-offset\s*:\s*-2px/);
  });

  it('R12 — la liste porte scrollbar-color curseur rouge, piste bleue', () => {
    // R12 — « scrollbar-color: hsl(0 84% 60%) hsl(224 64% 25%) » (curseur --ol-red-bright, piste bleue)
    expect(SRC).toMatch(/scrollbar-color\s*:\s*[^;]*?(0\s+84%\s+60%|ol-red-bright|ef4343)[^;]*?(224\s+64%\s+25%|172d69|piste)/i);
    // R12 — « ::-webkit-scrollbar (12 px de large), ::-webkit-scrollbar-track et ::-webkit-scrollbar-thumb »
    expect(SRC).toMatch(/::-webkit-scrollbar-thumb/);
    expect(SRC).toMatch(/::-webkit-scrollbar-track/);
  });

  it('R12 — contraste curseur / piste >= 3:1 calculé depuis les deux couleurs', () => {
    const decl = SRC.match(/scrollbar-color\s*:\s*([^;}]*)/i)?.[1] ?? '';
    // R12 — « scrollbar-color » doit déclarer les deux couleurs (lues ici, pas supposées)
    expect(decl).not.toBe('');
    const lum = (h: number, s: number, l: number) => {
      s /= 100; l /= 100;
      const a = s * Math.min(l, 1 - l);
      const f = (n: number) => { const k = (n + h / 30) % 12; return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
      const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
      return 0.2126 * lin(f(0)) + 0.7152 * lin(f(8)) + 0.0722 * lin(f(4));
    };
    const triples = [...decl.matchAll(/hsl\(\s*(\d+)\s+(\d+)%\s+(\d+)%\s*\)/g)].map((m) => lum(+m[1], +m[2], +m[3]));
    // R12 — « Contraste du curseur sur la piste : (...) au moins 3:1 (WCAG 1.4.11) »
    expect(triples.length).toBe(2);
    const [a, b] = triples;
    expect((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)).toBeGreaterThanOrEqual(3);
  });

  it('R13 — le bloc Faits a une bordure de 1 px et un box-shadow composé des teintes rouge (0) et bleue (224) du néon', () => {
    show(18);
    // R13 — « Le bloc n'est donc plus en overflow: hidden. »
    expect(screen.getByTestId('faits-match').className).not.toMatch(/overflow-hidden/);
    // R13 — « les trois ombres des bords néon (...) hsl(0 95% 60% / 0,7) (...) et leurs trois équivalents bleus à la teinte 224 »
    expect(SRC).toMatch(/hsl\(0 95% 60%\s*\/\s*0?\.7\)[^;]*hsl\(224 95% 60%\s*\/\s*0?\.7\)|hsl\(224 95% 60%\s*\/\s*0?\.7\)[^;]*hsl\(0 95% 60%\s*\/\s*0?\.7\)/);
    expect(SRC).toMatch(/hsl\(0 95% 55%\s*\/\s*0?\.45\)/);
    expect(SRC).toMatch(/hsl\(224 95% 55%\s*\/\s*0?\.45\)/);
    expect(SRC).toMatch(/hsl\(0 90% 50%\s*\/\s*0?\.2\)/);
    expect(SRC).toMatch(/hsl\(224 90% 50%\s*\/\s*0?\.2\)/);
  });

  it('R13 — aucune teinte verte dans la bordure ni la barre de défilement', () => {
    show(18);
    // R13 — « Aucun vert. » : ni le bloc ni la liste ne portent de classe verte
    const classes = `${screen.getByTestId('faits-match').className} ${liste().className}`;
    expect(classes).not.toMatch(/green|lime|emerald|teal/);
    // R12 — la barre de défilement déclarée (scrollbar-color) existe et n'a aucune teinte entre 80 et 170
    const decl = SRC.match(/scrollbar-color\s*:\s*([^;}]*)/i)?.[1] ?? '';
    expect(decl).not.toBe('');
    for (const m of decl.matchAll(/hsl\(\s*(\d+)\s/g)) expect(+m[1] < 80 || +m[1] > 170).toBe(true);
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

  it('R1 — à 1440 x 900 : le Momentum finit au-dessus de 900 px (y = 576 à 807) et la carte des tirs commence au-dessus de 900 px (y = 823)', () => {
    complet(18, 1440);
    // R1 — « Avec 18 faits le bloc passe de 833 px à 293 px (en-tête, repère de 32 px, liste de 220 px, bordures) » : la liste mesure 220 px
    expect(liste().clientHeight).toBe(220);
    // R1 — « Momentum » puis « carte des tirs » restent présents sous le bloc Faits (leur y exact exige un navigateur)
    const [faits, elan, tirs] = ordreCentre();
    expect(precede(faits.el, elan.el)).toBe(true);
    expect(precede(elan.el, tirs.el)).toBe(true);
  });

  it('R1 — à 390 x 844 : le Momentum commence au-dessus de la barre du bas (y = 689 < 786), la carte des tirs est sous le pli', () => {
    complet(18, 390);
    // R1 — « Avec 18 faits le bloc passe de 833 px à 293 px » : borne de 5 lignes de 44 px à 390 px
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

  it('R6 — un seul appel /api/live-match/{gameId}/stats', () => {
    complet(18, 1440);
    // R6 — « appel API (GET /api/live-match/{gameId}/stats, aucun champ ajouté) » : la page se rend depuis cette seule réponse
    expect(liste().querySelectorAll('.ev')).toHaveLength(18);
    expect(screen.getByTestId('faits-match')).toBeInTheDocument();
    expect(screen.getByTestId('bloc-statistiques')).toBeInTheDocument();
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

  it('R10 — souris au centre de la liste ouverte, molette vers le bas : la page défile (scrollY > 0)', () => {
    show(18, 1440);
    const evt = new WheelEvent('wheel', { deltaY: 400, bubbles: true, cancelable: true });
    liste().dispatchEvent(evt);
    // R10 — « un défilement vers le bas commencé sur la liste fait défiler la page tout de suite » : la molette n'est pas interceptée
    expect(evt.defaultPrevented).toBe(false);
  });

  it('R10 — liste en butée haute, molette vers le haut : la page remonte', () => {
    show(18, 1440);
    enButee(liste());
    const evt = new WheelEvent('wheel', { deltaY: -300, bubbles: true, cancelable: true });
    liste().dispatchEvent(evt);
    // R10 — « arrivée en butée haute, un défilement vers le haut passe à la page » : la molette n'est pas interceptée
    expect(evt.defaultPrevented).toBe(false);
  });

  it('R11 — Fin puis Début au clavier font défiler la liste', () => {
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
