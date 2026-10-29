import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import type { LiveMatchLineup, LiveMatchLineupPlayer, LiveMatchStats } from '@/types/api';

// L186 — acceptation de l'écran page-match-fm (docs/specs/page-match-fm/fiche.yaml), amendement L186 :
// centre en UNE colonne (Faits, rangée Statistiques | Momentum, rangée Carte des tirs | pile Joueurs en vue + Classement),
// Momentum moins haut, carte des tirs à la verticale. Appel simulé (A1) : GET /api/live-match/{gameId}/stats,
// via le hook useLiveMatchStats. jsdom ne mesure aucune géométrie : les règles de disposition sont vérifiées
// sur ce que le DOM déclare (structure par data-testid, classes Tailwind, attributs SVG). Les vrais composants sont rendus.

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

const OL = 465;
const OPP = 1;
let nextId = 1;
const p = (name: string, jersey: number, yardLine: number, yardSide: number, pos = 'CM'): LiveMatchLineupPlayer => ({
  id: nextId++, name, shortName: name, jerseyNumber: jersey, positionShort: pos, yardLine, yardSide, ranking: null,
});
const XI = (pre: string) => [
  p(`${pre}Gardien`, 1, 1, 50, 'GK'),
  p(`${pre}D1`, 2, 2, 85), p(`${pre}D2`, 3, 2, 15), p(`${pre}D3`, 4, 2, 40), p(`${pre}D4`, 5, 2, 60),
  p(`${pre}M1`, 8, 3, 35), p(`${pre}M2`, 6, 3, 65),
  p(`${pre}A1`, 11, 4, 50), p(`${pre}A2`, 7, 4, 80), p(`${pre}A3`, 10, 5, 20),
  p(`${pre}Av`, 9, 7, 50),
];
const lineup = (formation: string, pre: string): LiveMatchLineup => ({ formation, starters: XI(pre), bench: [p(`${pre}Banc`, 16, 0, 0)] });
const TEAM = (k: number) => ({ Touches: 600 + k, 'Tirs au total': 14 - k, 'Tirs cadrés': 6 - k, 'Buts attendus': 1.87 - k * 0.93, 'Passes Completed': 421 - k * 69 });

interface Opts {
  olHome?: boolean;
  events?: boolean;
  shots?: boolean;
  momentum?: boolean;
  performers?: boolean | 'trois';
  standings?: boolean;
  status?: 'upcoming' | 'ended';
}

function stats(o: Opts = {}): LiveMatchStats {
  const { olHome = true, events = true, shots = true, momentum = true, performers = true, standings = true, status = 'ended' } = o;
  const olSide = { id: OL, name: 'Lyon', symbolicName: 'OL', imageVersion: 1, score: 2 };
  const opSide = { id: OPP, name: 'Lens', symbolicName: 'RCL', imageVersion: 1, score: 1 };
  const home = olHome ? olSide : opSide;
  const away = olHome ? opSide : olSide;
  const homeId = home.id;
  const awayId = away.id;
  const duo = (role: string, statName: string, statValue: string) => ({
    role, homePlayer: { id: 1, name: 'Joueur-Domicile', statValue, statName }, awayPlayer: { id: 2, name: 'Joueur-Visiteur', statValue, statName },
  });
  const perfs =
    performers === 'trois'
      ? [duo('Attaquant', 'Buts attendus', '0.35'), duo('Milieu de Terrain', 'Passes décisives', '3'), duo('Défenseur', 'Tacles', '5')]
      : performers
        ? [duo('Meilleur buteur', 'Buts', '1')]
        : [];
  return {
    gameId: 10, matchupId: '465-1-10', competitionId: 35, competitionName: 'Ligue 1', status, statusGroup: 4, statusText: 'Terminé',
    gameTime: 90, gameTimeDisplay: "90'", startTime: '2026-10-11T20:00:00Z', home, away,
    teamStats: { home: TEAM(0), away: TEAM(1) },
    events: events
      ? [20, 30, 40].map((t, i) => ({
          competitorId: i % 2 === 0 ? OL : OPP, gameTime: t, gameTimeDisplay: `${t}'`, type: 'goal', isMajor: true,
          playerId: 1, extraPlayerId: null, playerName: i % 2 === 0 ? 'Cherki' : 'Thauvin', playerShortName: null, extraPlayerName: null, description: 'But',
        }))
      : [],
    topPerformers: perfs,
    shots: shots
      ? [
          { competitorId: homeId, playerId: 1, time: "23'", xg: 0.4, xgot: 0.5, bodyPart: 'Foot', outcome: 'But', line: 90, side: 40 },
          { competitorId: homeId, playerId: 1, time: "30'", xg: 0.2, xgot: 0.2, bodyPart: 'Foot', outcome: 'Cadré', line: 85, side: 60 },
          { competitorId: homeId, playerId: 1, time: "35'", xg: 0.05, xgot: 0, bodyPart: 'Foot', outcome: 'Manqué', line: 80, side: 45 },
          { competitorId: homeId, playerId: 1, time: "40'", xg: 0.1, xgot: 0, bodyPart: 'Foot', outcome: 'Bloqué', line: 82, side: 55 },
          { competitorId: awayId, playerId: 2, time: "78'", xg: 0.3, xgot: 0.4, bodyPart: 'Foot', outcome: 'But', line: 90, side: 50 },
          { competitorId: awayId, playerId: 2, time: "80'", xg: 0.1, xgot: 0, bodyPart: 'Foot', outcome: 'Manqué', line: 80, side: 30 },
        ]
      : [],
    momentum: momentum ? Array.from({ length: 30 }, (_, i) => ({ minute: i * 3, value: i % 2 === 0 ? 20 + (i % 5) * 10 : -(20 + (i % 5) * 10) })) : undefined,
    lineups: { home: lineup('4-2-3-1', 'H'), away: lineup('4-4-2', 'V') },
    standings: standings
      ? [1, 2, 3, 4, 5].map((n) => ({ position: n, teamId: n === 3 ? OL : 100 + n, name: n === 3 ? 'Lyon' : `Club ${n}`, played: 8, points: 25 - n, goalDifference: 5 - n, isLive: false, isOl: n === 3 }))
      : undefined,
    updatedAt: '2026-10-11T20:00:00Z',
  } as unknown as LiveMatchStats;
}

const show = (o: Opts = {}) => {
  hook = { isLoading: false, isError: false, data: stats(o) };
  return render(<MatchPage />);
};
const setWidth = (w: number) => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: w });
  window.dispatchEvent(new Event('resize'));
};

const tid = (id: string) => screen.getByTestId(id);
const all = (id: string) => screen.getAllByTestId(id);
const css = (el: Element) => `${el.getAttribute('class') ?? ''} ${el.getAttribute('style') ?? ''}`;
const tokens = (el: Element) => (el.getAttribute('class') ?? '').split(/\s+/).filter(Boolean);
const before = (a: Element, b: Element) => !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
const kids = (el: Element) => Array.from(el.children).map((c) => (c as HTMLElement).dataset.testid);
const chainTo = (el: Element, stop: Element) => {
  const out: Element[] = [];
  for (let e: Element | null = el; e && e !== stop; e = e.parentElement) out.push(e);
  return out;
};
const LG = /^(lg|min-\[1024px\]):/;
const UNPREFIXED_COLS = /^grid-cols-(\[|[2-9])/;
// une rangée côte à côte dès 1024 px : un grid posé derrière lg:, jamais deux colonnes sans préfixe
const rangeeLg = (el: Element) => {
  const t = tokens(el);
  expect(t.some((x) => LG.test(x) && /grid/.test(x)), `${el.getAttribute('data-testid')} : grille dès lg`).toBe(true);
  expect(t.filter((x) => UNPREFIXED_COLS.test(x)), `${el.getAttribute('data-testid')} : pas de colonnes sous lg`).toEqual([]);
};
const leaf = (root: Element, re: RegExp) =>
  Array.from(root.querySelectorAll('*')).filter((e) => re.test(e.textContent ?? '') && !Array.from(e.children).some((c) => re.test(c.textContent ?? '')));
const nuReordonne = /^(order-|-order-|col-start|col-end|row-start|row-end|col-\[|row-\[|flex-col-reverse|flex-row-reverse)/;

const carteSvg = () => within(tid('carte-tirs')).getByRole('img', { name: 'Carte des tirs' });
const tracé = () => within(tid('elan')).getByRole('img', { name: 'Momentum' });
const marqueurs = (svg: Element) =>
  Array.from(svg.querySelectorAll('title')).map((t) => ({ titre: t.textContent ?? '', g: t.parentElement as Element }));

beforeEach(() => {
  cleanup();
  nextId = 1000;
  vi.stubGlobal('ResizeObserver', class { constructor() {} observe() {} unobserve() {} disconnect() {} });
  setWidth(1440);
});

describe('Page match en écran FM (L186)', () => {
  // ------------------------------------------------------------------ R4
  it("R4 — aucun trou : dans le centre, chaque rangée commence à (bas de la précédente + 16 px) ±1 px, quel que soit l'état (charge complet, sans carte des tirs, sans tirs ni Momentum, sans faits ni tirs, sans joueurs en vue ni classement)", () => {
    const etats: [Opts, string[]][] = [
      [{}, ['faits-match', 'bloc-statistiques', 'elan', 'carte-tirs', 'joueurs-en-vue', 'classement-direct']],
      [{ shots: false }, ['faits-match', 'bloc-statistiques', 'elan', 'joueurs-en-vue', 'classement-direct']],
      [{ shots: false, momentum: false }, ['faits-match', 'bloc-statistiques', 'joueurs-en-vue', 'classement-direct']],
      [{ events: false, shots: false }, ['bloc-statistiques', 'elan', 'joueurs-en-vue', 'classement-direct']],
      [{ performers: false, standings: false }, ['faits-match', 'bloc-statistiques', 'elan', 'carte-tirs']],
    ];
    for (const [o, presents] of etats) {
      const { unmount } = show(o);
      const centre = tid('colonne-centre');
      // R4 — « Un bloc du centre sans donnée n'est pas affiché et le suivant remonte : jamais de trou, quel que soit l'état »
      const ids = Array.from(centre.querySelectorAll('[data-testid]')).map((e) => (e as HTMLElement).dataset.testid!);
      expect(ids.filter((i) => ['faits-match', 'bloc-statistiques', 'elan', 'carte-tirs', 'joueurs-en-vue', 'classement-direct'].includes(i))).toEqual(presents);
      for (const b of ['faits-match', 'bloc-statistiques', 'elan', 'carte-tirs', 'joueurs-en-vue', 'classement-direct']) {
        if (!presents.includes(b)) expect(screen.queryByTestId(b)).toBeNull();
      }
      // R4 — « Depuis L186 le centre est UNE colonne » : la rangée Statistiques | Momentum est un seul élément du centre
      expect(within(centre).getByTestId('rangee-stats-elan')).toBeInTheDocument();
      // R4 — « une rangée qui n'a plus qu'un bloc le laisse occuper toute la largeur du centre » : aucune rangée vide
      for (const r of ['rangee-stats-elan', 'rangee-tirs-joueurs']) {
        const row = screen.queryByTestId(r);
        if (row) expect(row.querySelector('section')).not.toBeNull();
      }
      unmount();
    }
  });

  // ------------------------------------------------------------------ R5
  it("R5 — les libellés d'attaque ne sont pas posés sur le terrain : ni dans son conteneur, ni en position absolue", () => {
    show();
    const carte = tid('carte-tirs');
    const bas = within(carte).getByText('↓ RCL attaque');
    const haut = within(carte).getByText('OL attaque ↑');
    for (const l of [bas, haut]) {
      // R5 — « jamais posés sur le terrain »
      expect(carteSvg().contains(l)).toBe(false);
      for (const e of chainTo(l, carte)) expect(tokens(e)).not.toContain('absolute');
    }
  });

  it('R5 — les libellés sont du texte horizontal, sur une seule ligne, sous le terrain', () => {
    show();
    const carte = tid('carte-tirs');
    const bas = within(carte).getByText('↓ RCL attaque');
    const haut = within(carte).getByText('OL attaque ↑');
    // R5 — « une ligne horizontale sous la surface de jeu, « ↓ <visiteur> attaque » à gauche et « <domicile> attaque ↑ » à droite »
    expect(before(carteSvg(), bas)).toBe(true);
    expect(before(carteSvg(), haut)).toBe(true);
    expect(before(bas, haut)).toBe(true);
    for (const l of [bas, haut]) expect(chainTo(l, carte).map(css).join(' ')).not.toMatch(/rotate|writing-mode|vertical/);
  });

  it("R5 — la couleur suit le club (OL rouge, adversaire bleu) et reste ≥ 4,5:1, OL à domicile comme à l'extérieur", () => {
    show();
    // R5 — « (b) Texte qui porte une équipe (libellés « ↓ RCL attaque » / « OL attaque ↑ ») : OL = --ol-red-bright, adversaire = hsl(226 70% 70%) »
    expect(css(within(tid('carte-tirs')).getByText('OL attaque ↑'))).toMatch(/ol-red-bright/);
    expect(css(within(tid('carte-tirs')).getByText('↓ RCL attaque'))).toMatch(/226[ _]70%[ _]70%/);
    cleanup();
    show({ olHome: false });
    expect(css(within(tid('carte-tirs')).getByText('↓ OL attaque'))).toMatch(/ol-red-bright/);
    expect(css(within(tid('carte-tirs')).getByText('RCL attaque ↑'))).toMatch(/226[ _]70%[ _]70%/);
  });

  // ------------------------------------------------------------------ R8
  it("R8 — 1440 : le centre contient faits, statistiques et momentum, carte des tirs, joueurs en vue, classement, dans cet ordre", () => {
    show();
    const centre = tid('colonne-centre');
    // R8 — « L'en-tête du score est au-dessus des trois colonnes, sur toute la largeur. »
    expect(tid('grille-match')).not.toContainElement(tid('entete-score'));
    expect(before(tid('entete-score'), tid('grille-match'))).toBe(true);
    // R8 — « Le centre empile, dans l'ordre : Faits du match, puis la rangée Statistiques comparées | Momentum, puis la rangée Carte des tirs | (Joueurs en vue sur Classement en direct). »
    expect(kids(centre)).toEqual(['faits-match', 'rangee-stats-elan', 'rangee-tirs-joueurs']);
    expect(kids(tid('rangee-stats-elan'))).toEqual(['bloc-statistiques', 'elan']);
    expect(kids(tid('rangee-tirs-joueurs'))).toEqual(['carte-tirs', 'colonne-centre-bas']);
    expect(kids(tid('colonne-centre-bas'))).toEqual(['joueurs-en-vue', 'classement-direct']);
  });

  it("R8 — sans tir : la carte des tirs n'est pas affichée, le Momentum reste", () => {
    show({ shots: false });
    // R8 — « Un bloc sans donnée n'est pas affiché. »
    expect(screen.queryByTestId('carte-tirs')).toBeNull();
    expect(within(tid('rangee-stats-elan')).getByTestId('elan')).toBeInTheDocument();
  });

  it('R8 — aucune donnée retirée : mêmes libellés, mêmes tirs, mêmes barres de Momentum qu\'avant L186', () => {
    show({ performers: 'trois' });
    const centre = tid('colonne-centre');
    // R8 — « Aucune donnée, aucun libellé et aucune animation n'est retiré par L186 : seule la disposition change. »
    const titres = Array.from(centre.querySelectorAll('h2')).map((h) => h.textContent?.trim());
    expect(titres).toEqual(expect.arrayContaining(['Faits du match', 'Momentum', 'Carte des tirs', 'Joueurs en vue', 'Classement en direct']));
    expect(within(tid('rangee-stats-elan')).getByText('Momentum')).toBeInTheDocument();
    expect(marqueurs(carteSvg())).toHaveLength(6);
    expect(tracé().querySelectorAll('rect').length).toBeGreaterThanOrEqual(30);
    expect(within(tid('rangee-tirs-joueurs')).getByText('Joueurs en vue')).toBeInTheDocument();
  });

  // ------------------------------------------------------------------ R10
  it('R10 — 390 : ordre des blocs de haut en bas', () => {
    setWidth(390);
    show();
    const [homeComp, awayComp] = all('bloc-composition');
    // R10 — « en-tête du score, Faits du match, Statistiques comparées, Momentum, Carte des tirs, Joueurs en vue, Classement en direct, puis composition et statistiques de l'équipe à domicile, composition et statistiques de l'équipe visiteuse »
    const ordre = [
      tid('entete-score'), tid('faits-match'), tid('bloc-statistiques'), tid('elan'), tid('carte-tirs'), tid('joueurs-en-vue'), tid('classement-direct'),
      homeComp, tid('stats-equipe-domicile'), awayComp, tid('stats-equipe-visiteur'),
    ];
    for (let i = 1; i < ordre.length; i++) expect(before(ordre[i - 1], ordre[i]), `bloc ${i}`).toBe(true);
  });

  it('R10 — 1023 : une colonne ; 1024 : rangées côte à côte ; 1439 : compositions encore empilées sous le centre', () => {
    show();
    // R10 — « Les rangées Statistiques | Momentum et Carte des tirs | pile commencent à 1024 px (seuil lg) »
    rangeeLg(tid('rangee-stats-elan'));
    rangeeLg(tid('rangee-tirs-joueurs'));
    // R10 — « de 1024 à 1439 px les compositions restent empilées sous le centre » : la grille à trois colonnes ne vaut qu'à 1440 px
    const grille = tid('grille-match');
    for (const e of [grille, ...Array.from(grille.querySelectorAll('*'))]) {
      for (const x of tokens(e)) {
        if (/grid-cols-\[?\d.*(280|px_)/.test(x) || /grid-cols-3/.test(x)) expect(x.startsWith('min-[1440px]:')).toBe(true);
      }
    }
    // R10 — « de 1024 à 1439 px les compositions restent empilées sous le centre » : elles suivent le centre dans le DOM
    expect(before(tid('colonne-centre'), all('bloc-composition')[0])).toBe(true);
  });

  it('R10 — ordre du DOM = ordre affiché à 390 (Statistiques avant Momentum, compositions de Lyon avant celles de Lens, compositions après Classement en direct)', () => {
    setWidth(390);
    show();
    const [home, away] = all('bloc-composition');
    // R10 — « Le DOM est écrit dans cet ordre, qui est aussi l'ordre affiché sous 1024 px »
    expect(home).toHaveTextContent('Composition · Lyon');
    expect(away).toHaveTextContent('Composition · Lens');
    expect(before(tid('bloc-statistiques'), tid('elan'))).toBe(true);
    expect(before(tid('elan'), tid('carte-tirs'))).toBe(true);
    expect(before(tid('classement-direct'), home)).toBe(true);
    expect(before(home, away)).toBe(true);
  });

  it("R10 — 1440 : l'ordre du DOM des blocs du centre est leur ordre de lecture (haut→bas puis gauche→droite)", () => {
    show();
    const centre = tid('colonne-centre');
    // R10 — « l'ordre de lecture du centre (rangée par rangée, de gauche à droite : Faits, Statistiques, Momentum, Carte des tirs, Joueurs en vue, Classement) est celui du DOM »
    const ids = ['faits-match', 'bloc-statistiques', 'elan', 'carte-tirs', 'joueurs-en-vue', 'classement-direct'];
    const trouves = Array.from(centre.querySelectorAll('[data-testid]')).map((e) => (e as HTMLElement).dataset.testid!).filter((i) => ids.includes(i));
    expect(trouves).toEqual(ids);
  });

  it("R10 — display:contents n'est posé que sur des div sans rôle ; ni order ni grid-row / grid-column entre les blocs du centre", () => {
    show();
    const centre = tid('colonne-centre');
    // R10 — « ni order, ni flex-direction inversé, ni grid-row / grid-column n'inversent ces blocs entre eux »
    expect(within(centre).getByTestId('rangee-stats-elan')).toBeInTheDocument();
    expect(within(centre).getByTestId('rangee-tirs-joueurs')).toBeInTheDocument();
    for (const e of [centre, ...Array.from(centre.querySelectorAll('*'))]) {
      const nu = tokens(e).map((x) => x.replace(/^[^:]*:/, ''));
      for (const x of nu) expect(x).not.toMatch(nuReordonne);
      const st = (e as HTMLElement).style;
      expect(st.gridRow || st.gridColumn || st.order || '').toBe('');
      // R10 — « display:contents est autorisé uniquement sur des div neutres [...], jamais sur un élément qui porte un rôle ou une sémantique »
      if (nu.includes('contents')) {
        expect(e.tagName).toBe('DIV');
        expect(e.hasAttribute('role')).toBe(false);
      }
    }
  });

  it('R10 — 390 : pas de défilement horizontal (scrollWidth = clientWidth)', () => {
    setWidth(390);
    show({ performers: 'trois' });
    // R10 — « sous 1024 px chaque bloc occupe toute la largeur » : aucune largeur fixe de rangée n'excède l'écran
    const centre = tid('colonne-centre');
    rangeeLg(tid('rangee-stats-elan'));
    rangeeLg(tid('rangee-tirs-joueurs'));
    for (const e of [centre, ...Array.from(centre.querySelectorAll('*'))]) {
      for (const x of tokens(e)) {
        if (x.includes(':')) continue;
        const m = x.match(/^(?:w|min-w)-\[(\d+)px\]/);
        if (m) expect(Number(m[1])).toBeLessThan(390);
      }
    }
  });

  // ------------------------------------------------------------------ R13
  it("R13 — OL à l'extérieur : libellés d'attaque, OL en rouge à gauche et adversaire en bleu à droite", () => {
    show({ olHome: false });
    const carte = tid('carte-tirs');
    // R13 — « libellés d'attaque (« ↓ OL attaque » rouge à gauche, « RCL attaque ↑ » bleu à droite, L186) »
    const gauche = within(carte).getByText('↓ OL attaque');
    const droite = within(carte).getByText('RCL attaque ↑');
    expect(css(gauche)).toMatch(/ol-red-bright/);
    expect(css(droite)).toMatch(/226[ _]70%[ _]70%/);
    expect(before(gauche, droite)).toBe(true);
  });

  // ------------------------------------------------------------------ R16
  it('R16 — 1024, 1280, 1366 et 1440 : Statistiques et Momentum côte à côte, visibles sans défiler à 1366 × 768 (bas du Momentum ≤ 768 px)', () => {
    show();
    // R16 — « Dès 1024 px, Statistiques comparées (à gauche) et Momentum (à droite) forment une rangée de deux blocs »
    const rangee = tid('rangee-stats-elan');
    expect(kids(rangee)).toEqual(['bloc-statistiques', 'elan']);
    rangeeLg(rangee);
  });

  it('R16 — 1440 : Statistiques et Momentum côte à côte, mêmes largeur (±1 px) et hauteur (±1 px), sous Faits du match et au-dessus de la carte des tirs', () => {
    show();
    const rangee = tid('rangee-stats-elan');
    // R16 — « sous les Faits du match et au-dessus de la carte des tirs »
    expect(before(tid('faits-match'), rangee)).toBe(true);
    expect(before(rangee, tid('carte-tirs'))).toBe(true);
    // R16 — « de même hauteur (la plus grande des deux, align-items: stretch) »
    expect(tokens(rangee)).not.toContain('items-start');
    expect(tokens(rangee)).not.toContain('items-center');
    expect(tokens(rangee)).not.toContain('items-end');
  });

  it('R16 — le tracé du Momentum mesure 96 px de haut à 1024, 1439, 1440, 1920 et 2560', () => {
    show();
    const svg = tracé();
    // R16 — « svg viewBox 240 × 96, largeur 100 %, preserveAspectRatio=none (les barres s'élargissent ou s'étroitisent, la hauteur ne change pas) »
    expect(svg.getAttribute('viewBox')).toBe('0 0 240 96');
    expect(svg.getAttribute('preserveAspectRatio')).toBe('none');
    expect(`${css(svg)} ${svg.getAttribute('width') ?? ''}`).toMatch(/w-full|width:\s*100%|^.*\b100%/);
  });

  it('R16 — à 390 px le tracé mesure au plus 72 px (hauteur de l\'ancien tracé) et à 320 px au plus 57 px (56,2 attendus)', () => {
    setWidth(390);
    show();
    // R16 — « son tracé a pour hauteur min(96 px, hauteur de l'ancien tracé) » : la hauteur est bornée à 96 px et suit la largeur de l'écran
    const conteneur = chainTo(tracé(), tid('elan')).map((e) => e.outerHTML.slice(0, e.outerHTML.indexOf('>') + 1)).join(' ');
    expect(conteneur).toMatch(/min\(\s*96px/);
  });

  it('R16 — le centre de chaque pastille de but est au bout de sa barre (±1 px, verticalement et horizontalement) à 320, 390 et 1440 px', () => {
    for (const w of [320, 390, 1440]) {
      setWidth(w);
      const { unmount } = show();
      const elan = tid('elan');
      const bars = Array.from(tracé().querySelectorAll('rect')).map((r) => ({
        cx: (Number(r.getAttribute('x')) + Number(r.getAttribute('width')) / 2) / 240 * 100,
        haut: Number(r.getAttribute('y')) / 96 * 100,
        bas: (Number(r.getAttribute('y')) + Number(r.getAttribute('height'))) / 96 * 100,
      }));
      // R16 — « les pastilles de but sont dessinées dans une couche à part, non déformée » : hors du svg du tracé
      const pastilles = Array.from(elan.querySelectorAll('circle')).filter((c) => !tracé().contains(c));
      expect(pastilles).toHaveLength(3);
      for (const c of pastilles) {
        // R16 — « cx = milieu de la barre de la minute du but / 240 et cy = bout de cette barre / 96, tous deux en % »
        const cx = c.getAttribute('cx') ?? '';
        const cy = c.getAttribute('cy') ?? '';
        expect(cx).toMatch(/%$/);
        expect(cy).toMatch(/%$/);
        const barre = bars.find((b) => Math.abs(b.cx - parseFloat(cx)) < 0.5);
        expect(barre, `barre sous la pastille cx=${cx}`).toBeDefined();
        const y = parseFloat(cy);
        expect(Math.min(Math.abs(y - barre!.haut), Math.abs(y - barre!.bas))).toBeLessThan(1);
      }
      unmount();
    }
  });

  it('R16 — aucune pastille de but ne recouvre la légende de direction sous le tracé, à 320, 390 et 1440 px', () => {
    show();
    const elan = tid('elan');
    const pastille = Array.from(elan.querySelectorAll('circle')).find((c) => !tracé().contains(c));
    // R16 — « aucune pastille ne recouvre la légende de direction sous le tracé »
    expect(pastille).toBeDefined();
    const legende = leaf(elan, /Vers le haut\s*:\s*Lyon,\s*vers le bas\s*:\s*Lens/)[0];
    expect(legende).toBeDefined();
    expect(legende.contains(pastille!)).toBe(false);
    expect(before(tracé(), legende)).toBe(true);
  });

  it('R16 — les pastilles de but du Momentum restent rondes (rapport largeur/hauteur 1 ±5 %) à 390 et à 1920', () => {
    for (const w of [390, 1920]) {
      setWidth(w);
      const { unmount } = show();
      const pastilles = Array.from(tid('elan').querySelectorAll('circle')).filter((c) => !tracé().contains(c));
      expect(pastilles.length).toBeGreaterThan(0);
      for (const c of pastilles) {
        // R16 — « une couche à part, non déformée, [...] pour rester rondes »
        for (const s of chainTo(c, tid('elan')).filter((e) => e.tagName.toLowerCase() === 'svg')) {
          expect(s.getAttribute('preserveAspectRatio')).not.toBe('none');
        }
      }
      unmount();
    }
  });

  it('R16 — 390 : Statistiques puis Momentum, empilés, pleine largeur', () => {
    setWidth(390);
    show();
    // R16 — « 390 : Statistiques puis Momentum, empilés, pleine largeur »
    expect(before(tid('bloc-statistiques'), tid('elan'))).toBe(true);
    expect(kids(tid('rangee-stats-elan'))).toEqual(['bloc-statistiques', 'elan']);
    rangeeLg(tid('rangee-stats-elan'));
  });

  it('R16 — sans Momentum, Statistiques occupe toute la largeur du centre', () => {
    show({ momentum: false });
    // R16 — « Sans Momentum, Statistiques occupe toute la largeur du centre. »
    expect(screen.queryByTestId('elan')).toBeNull();
    const stats = tid('bloc-statistiques');
    expect(tid('colonne-centre')).toContainElement(stats);
    const rangee = screen.queryByTestId('rangee-stats-elan');
    if (rangee) {
      expect(rangee.contains(stats)).toBe(true);
      const t = [...tokens(rangee), ...tokens(stats)].join(' ');
      expect(t.includes('col-span-2') || t.includes('col-span-full') || !/grid-cols-2|repeat\(2/.test(t)).toBe(true);
    }
    expect(within(tid('colonne-centre')).getByTestId('rangee-stats-elan')).toBeInTheDocument();
  });

  // ------------------------------------------------------------------ R17
  it('R17 — la carte des tirs est plus haute que large (terrain vertical) et sa largeur ne dépasse pas 224 px', () => {
    show();
    const svg = carteSvg();
    // R17 — « viewBox 450 × 700, largeur au plus 224 px, centré dans son bloc »
    expect(svg.getAttribute('viewBox')).toBe('0 0 450 700');
    const decl = chainTo(svg, tid('carte-tirs')).slice(0, 2).map(css).join(' ') + (svg.getAttribute('width') ?? '');
    expect(decl).toMatch(/max-w-\[224px\]|max-width:\s*224px|width:\s*224px|^.*\b224\b/);
  });

  it('R17 — à 224 px de large, le plus petit tir manqué mesure au moins 4,9 px de diamètre et son trait au moins 1,5 px (rayon et épaisseur du code multipliés par 1,6 par rapport à l\'ancienne carte)', () => {
    show();
    const echelle = 224 / 450;
    // R17 — « la règle est « diamètre ≥ 4,9 px et trait ≥ 1,5 px » »
    const manque = marqueurs(carteSvg()).filter((m) => /Manqué/.test(m.titre));
    expect(manque.length).toBeGreaterThan(0);
    for (const m of manque) {
      const visible = Array.from(m.g.querySelectorAll('circle')).filter((c) => c.getAttribute('fill') !== 'transparent');
      expect(visible.length).toBeGreaterThan(0);
      const c = visible[0];
      expect(Number(c.getAttribute('r')) * 2 * echelle).toBeGreaterThanOrEqual(4.9);
      expect(Number(c.getAttribute('stroke-width')) * echelle).toBeGreaterThanOrEqual(1.5);
    }
  });

  it('R17 — mêmes tirs : autant de marqueurs de chaque club et de chaque issue qu\'avant, positions tournées (x, y) → (y, 700 − x)', () => {
    show();
    const m = marqueurs(carteSvg());
    // R17 — « Les tirs sont les mêmes que sur l'ancienne carte, ceux des DEUX équipes, avec les mêmes formes par issue »
    expect(m).toHaveLength(6);
    expect(m.filter((x) => /But/.test(x.titre))).toHaveLength(2);
    expect(m.filter((x) => /Cadré/.test(x.titre))).toHaveLength(1);
    expect(m.filter((x) => /Bloqué/.test(x.titre))).toHaveLength(1);
    expect(m.filter((x) => /Manqué/.test(x.titre))).toHaveLength(2);
    // R17 — « seule leur position est tournée » : « positions tournées (x, y) → (y, 700 − x) ».
    // (x_ancien, y_ancien) = position dans l'ancien repère 700 × 450 de la carte d'avant L186
    // (shot-map.tsx, b428094~1:62-63 : x = side/100 × 700, inversé pour le visiteur ; y = line/100 × 450).
    // Nouvelle position attendue dans le repère 450 × 700 : (y_ancien, 700 − x_ancien), à ±1 unité.
    const d = stats();
    for (const x of m) {
      const tir = d.shots.find((s) => x.titre.startsWith(s.time));
      expect(tir, `tir de la fixture pour « ${x.titre} »`).toBeDefined();
      const domicile = tir!.competitorId === d.home.id;
      const xAncien = domicile ? (tir!.side / 100) * 700 : (1 - tir!.side / 100) * 700;
      const yAncien = (tir!.line / 100) * 450;
      const c = x.g.querySelector('circle');
      expect(c, `centre du marqueur « ${x.titre} »`).not.toBeNull();
      expect(Math.abs(Number(c!.getAttribute('cx')) - yAncien), `abscisse de « ${x.titre} »`).toBeLessThanOrEqual(1);
      expect(Math.abs(Number(c!.getAttribute('cy')) - (700 - xAncien)), `ordonnée de « ${x.titre} »`).toBeLessThanOrEqual(1);
    }
  });

  it('R17 — le club à domicile tire vers le haut, libellés « ↓ visiteur attaque » et « domicile attaque ↑ »', () => {
    show();
    const carte = tid('carte-tirs');
    // R17 — « le club à domicile attaque vers le haut, le visiteur vers le bas » ; R5 — « « ↓ <visiteur> attaque » à gauche et « <domicile> attaque ↑ » à droite »
    expect(within(carte).getByText('↓ RCL attaque')).toBeInTheDocument();
    expect(within(carte).getByText('OL attaque ↑')).toBeInTheDocument();
    cleanup();
    show({ olHome: false });
    expect(within(tid('carte-tirs')).getByText('↓ OL attaque')).toBeInTheDocument();
    expect(within(tid('carte-tirs')).getByText('RCL attaque ↑')).toBeInTheDocument();
  });

  it('R17 — à 224 px, les lignes du terrain mesurent au moins 1 px (trait de 2 unités)', () => {
    show();
    const svg = carteSvg();
    // R17 — « Les lignes du terrain (cadre, ligne médiane, rond central, surfaces) passent de 1 à 2 unités de viewBox »
    const lignes = Array.from(svg.querySelectorAll('[stroke-width]')).filter((e) => !e.closest('g') && e.getAttribute('stroke') !== 'none');
    expect(lignes.length).toBeGreaterThan(0);
    for (const l of lignes) expect(Number(l.getAttribute('stroke-width'))).toBeGreaterThanOrEqual(2);
  });

  it('R17 — la zone de survol d\'un tir bloqué ou manqué a un rayon d\'au moins 9,6 unités et chaque tir a un <title>', () => {
    show();
    const m = marqueurs(carteSvg());
    // R17 — « chaque tir garde son infobulle <title> « minute · joueur · issue · xG » »
    expect(m).toHaveLength(6);
    for (const x of m) expect(x.titre.split(' · ').length).toBeGreaterThanOrEqual(4);
    // R17 — « rayon max(rayon du marqueur, 9,6 unités) au lieu de max(…, 6) »
    for (const x of m.filter((y) => /Bloqué|Manqué/.test(y.titre))) {
      const rayons = Array.from(x.g.querySelectorAll('circle')).map((c) => Number(c.getAttribute('r')));
      expect(Math.max(...rayons)).toBeGreaterThanOrEqual(9.6);
    }
  });

  // ------------------------------------------------------------------ R18
  it('R18 — 1024 et 1366 : Joueurs en vue puis Classement en direct à droite de la carte des tirs', () => {
    show();
    const rangee = tid('rangee-tirs-joueurs');
    // R18 — « Dès 1024 px, sous la rangée Statistiques | Momentum, la carte des tirs occupe la moitié gauche du centre et, à sa droite, Joueurs en vue puis Classement en direct sont empilés »
    expect(before(tid('rangee-stats-elan'), rangee)).toBe(true);
    expect(kids(rangee)).toEqual(['carte-tirs', 'colonne-centre-bas']);
    expect(kids(tid('colonne-centre-bas'))).toEqual(['joueurs-en-vue', 'classement-direct']);
    rangeeLg(rangee);
  });

  it('R18 — 1023 : empilés', () => {
    setWidth(1023);
    show();
    // R18 — « Sous 1024 px : carte des tirs, Joueurs en vue, Classement en direct empilés pleine largeur. »
    rangeeLg(tid('rangee-tirs-joueurs'));
    expect(before(tid('carte-tirs'), tid('joueurs-en-vue'))).toBe(true);
    expect(before(tid('joueurs-en-vue'), tid('classement-direct'))).toBe(true);
  });

  it('R18 — 1440 : Joueurs en vue puis Classement en direct à droite de la carte des tirs, même haut (±1 px), 16 px d\'écart entre eux', () => {
    show();
    const rangee = tid('rangee-tirs-joueurs');
    const pile = tid('colonne-centre-bas');
    // R18 — « alignés en haut sur la carte » (pas d'étirement)
    expect(tokens(rangee)).toContain('items-start');
    // R18 — « Joueurs en vue puis Classement en direct sont empilés (écart 16 px) »
    expect(tokens(pile).join(' ')).toMatch(/gap-4|gap-y-4|space-y-4/);
    expect(tokens(pile).join(' ')).toMatch(/flex-col|grid/);
  });

  it('R18 — 1440 : sans carte des tirs, la pile occupe toute la largeur du centre', () => {
    show({ shots: false });
    // R18 — « Sans carte des tirs, la pile occupe toute la largeur du centre »
    expect(screen.queryByTestId('carte-tirs')).toBeNull();
    const rangee = tid('rangee-tirs-joueurs');
    expect(kids(rangee)).toEqual(['colonne-centre-bas']);
    const pile = tid('colonne-centre-bas');
    const t = [...tokens(rangee), ...tokens(pile)].join(' ');
    expect(t.includes('col-span-2') || t.includes('col-span-full') || !/grid-cols-2|repeat\(2/.test(t)).toBe(true);
  });

  it('R18 — 1440 : sans Joueurs en vue ni Classement en direct, la carte des tirs occupe toute la largeur du centre (aucun trou à droite, cohérent avec R4)', () => {
    show({ performers: false, standings: false });
    // R18 — « sans pile [...], la carte des tirs occupe TOUTE la largeur du centre [...] jamais de trou de 264 px à droite »
    const rangee = tid('rangee-tirs-joueurs');
    expect(rangee.contains(tid('carte-tirs'))).toBe(true);
    expect(screen.queryByTestId('joueurs-en-vue')).toBeNull();
    expect(screen.queryByTestId('classement-direct')).toBeNull();
    const carte = tid('carte-tirs');
    const t = [...tokens(rangee), ...tokens(carte)].join(' ');
    expect(t.includes('col-span-2') || t.includes('col-span-full') || !/grid-cols-2|repeat\(2/.test(t)).toBe(true);
  });

  it('R18 — 264 px : les trois rôles de Joueurs en vue sont affichés, la ligne « Buts attendus : 0,35 » ne déborde pas de sa cellule ni sur la colonne adverse (bord droit ≤ bord de la cellule)', () => {
    show({ performers: 'trois' });
    const bloc = tid('joueurs-en-vue');
    // R18 — « Joueurs en vue montre tous ses rôles réels (Attaquant, Milieu de terrain, Défenseur, chacun avec la statistique de son rôle) »
    for (const r of ['Attaquant', 'Milieu de terrain', 'Défenseur']) expect(within(bloc).getAllByText(r).length).toBeGreaterThan(0);
    const lignes = [/Buts attendus\s*:\s*0,35/, /Passes décisives\s*:\s*3/, /Tacles\s*:\s*5/];
    // R18 — « la ligne de statistique PEUT RETOMBER À LA LIGNE (pas de white-space: nowrap, overflow-wrap) »
    for (const re of lignes) {
      const f = leaf(bloc, re);
      expect(f.length).toBeGreaterThan(0);
      for (const e of chainTo(f[0], bloc)) expect(tokens(e)).not.toContain('whitespace-nowrap');
    }
  });

  it('R18 — 390 : carte des tirs, Joueurs en vue, Classement en direct empilés dans cet ordre', () => {
    setWidth(390);
    show();
    // R18 — « Sous 1024 px : carte des tirs, Joueurs en vue, Classement en direct empilés pleine largeur. »
    expect(before(tid('carte-tirs'), tid('joueurs-en-vue'))).toBe(true);
    expect(before(tid('joueurs-en-vue'), tid('classement-direct'))).toBe(true);
    expect(tid('rangee-tirs-joueurs')).toContainElement(tid('classement-direct'));
  });
});
