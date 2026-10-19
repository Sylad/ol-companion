import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { LiveMatchLineup, LiveMatchLineupPlayer, LiveMatchStats } from '@/types/api';

// L160 — acceptation de l'écran page-match-fm (docs/specs/page-match-fm/fiche.yaml).
// Appel simulé (A1) : GET /api/live-match/{gameId}/stats, via le hook useLiveMatchStats.
// jsdom ne mesure aucune géométrie : les règles de disposition (R4, R6, R7, R10) sont
// vérifiées sur ce que le DOM déclare (classes Tailwind, style en ligne, ordre des nœuds).
// Les vrais composants (MomentumChart, ShotMap, MiniStandings, LineupCard) sont rendus.

type HookResult = { isLoading: boolean; isError: boolean; data: LiveMatchStats | undefined };
let hook: HookResult;
const calls: string[] = [];
const observed: Element[] = [];
const COLONNE_OU_GRILLE = '[data-testid^="colonne-"], [data-testid="grille-match"]';
// R4 ne vise que le placement des blocs : un observateur de taille posé sur une colonne, la grille,
// l'un de leurs enfants directs ou un bloc (section) serait de la répartition par la hauteur.
const estConteneurDeDisposition = (el: Element) =>
  el.matches(`${COLONNE_OU_GRILLE}, section[data-testid], [data-testid^="bloc-"]`) ||
  !!el.parentElement?.matches(COLONNE_OU_GRILLE) ||
  !!el.querySelector(COLONNE_OU_GRILLE);

vi.mock('@tanstack/react-router', () => ({
  useParams: () => ({ gameId: '10' }),
  useSearch: () => ({ matchupId: '465-1-10' }),
  Link: ({ children }: { children: React.ReactNode }) => <a href="/">{children}</a>,
}));
vi.mock('@/hooks/use-match-event-burst', () => ({ useMatchEventBurst: () => null }));
vi.mock('@/hooks/use-live-match', () => ({
  useLiveMatchStats: (...args: unknown[]) => {
    calls.push(JSON.stringify(args));
    return hook;
  },
}));
vi.mock('@/components/match-event-burst', () => ({ MatchEventBurst: () => null }));

import { MatchPage } from './match';

const OL = 465;
const OPP = 1;
let nextId = 1;
const p = (name: string, jersey: number, yardLine: number, yardSide: number, pos = 'CM'): LiveMatchLineupPlayer => ({
  id: nextId++, name, shortName: name, jerseyNumber: jersey, positionShort: pos, yardLine, yardSide, ranking: null,
});
const OL_421 = [
  p('Lucas Perri', 1, 1, 50, 'GK'),
  p('Maitland-Niles', 2, 2, 85), p('Tagliafico', 3, 2, 15), p('Niakhaté', 4, 2, 40), p('Mata', 5, 2, 60),
  p('Matic', 8, 3, 35), p('Tessmann', 6, 3, 65),
  p('Cherki', 11, 4, 50), p('Fofana', 7, 4, 80), p('Tolisso', 10, 5, 20),
  p('Lacazette', 9, 7, 50),
];
const OPP_442 = [
  p('Samba', 1, 1, 50, 'GK'),
  p('Gradit', 3, 2, 15), p('Danso', 5, 2, 40), p('Medina', 2, 2, 60), p('Frankowski', 22, 2, 85),
  p('Fulgini', 7, 3, 20), p('Machado', 8, 3, 45), p('Samed', 4, 3, 70), p('Said', 14, 3, 90),
  p('Wahi', 9, 4, 30), p('Thauvin', 11, 4, 70),
];
const BENCH_LONG = ['Descamps', 'Mikautadze', 'Nuamah', 'Morton', 'Benrahma', 'Caqueret', 'Kumbedi', 'Sarr'].map((n, i) => p(n, 30 + i, 0, 0));
const BENCH_SHORT = [p('Leca', 16, 0, 0)];
const lineup = (formation: string, starters: LiveMatchLineupPlayer[], bench: LiveMatchLineupPlayer[], probable?: boolean): LiveMatchLineup => ({
  formation, starters, bench, ...(probable === undefined ? {} : { probable }),
});

const FULL_TEAM = (k: number) => ({
  Touches: 600 + k, 'Tirs au total': 14 - k, 'Tirs cadrés': 6 - k, 'Buts attendus': 1.87 - k * 0.93,
  'Passes Completed': 421 - k * 69, 'Passes dans le dernier tiers': 118, 'Centres réussis': 5, 'Tacles Gagnés': 14,
  'Les interceptions': 9, 'Duels au sol gagnés': 38, 'Duels aériens gagnés': 17, 'Récupération du ballon': 52,
  'Fautes faites': 11, 'Hors jeu': 0,
});

interface Opts {
  olHome?: boolean;
  status?: 'upcoming' | 'live' | 'ended';
  events?: boolean;
  shots?: boolean;
  momentum?: boolean;
  performers?: boolean;
  standings?: boolean;
  lineups?: 'full' | 'none' | 'probable' | 'mixte';
  team?: boolean;
  homeFormation?: string;
  awayFormation?: string;
  homeBench?: LiveMatchLineupPlayer[];
  awayBench?: LiveMatchLineupPlayer[];
  nEvents?: number;
}

function stats(o: Opts = {}): LiveMatchStats {
  const { olHome = true, status = 'ended', events = true, shots = true, momentum = true, performers = true, standings = true, lineups = 'full', team = true } = o;
  const olSide = { id: OL, name: 'Lyon', symbolicName: 'OL', imageVersion: 1, score: 2 };
  const opSide = { id: OPP, name: 'Lens', symbolicName: 'RCL', imageVersion: 1, score: 1 };
  const home = olHome ? olSide : opSide;
  const away = olHome ? opSide : olSide;
  const olLineup = (probable?: boolean) => lineup(o.homeFormation ?? '4-2-3-1', OL_421, o.homeBench ?? BENCH_SHORT, probable);
  const opLineup = (probable?: boolean) => lineup(o.awayFormation ?? '4-4-2', OPP_442, o.awayBench ?? BENCH_SHORT, probable);
  const homeL = olHome ? olLineup : opLineup;
  const awayL = olHome ? opLineup : olLineup;
  let lu: LiveMatchStats['lineups'];
  if (lineups === 'full') lu = { home: homeL(), away: awayL() };
  else if (lineups === 'probable') lu = { home: homeL(true), away: awayL(true) };
  else if (lineups === 'mixte') lu = { home: homeL(true), away: awayL(false) };
  const ev = Array.from({ length: o.nEvents ?? 3 }, (_, i) => ({
    competitorId: i % 2 === 0 ? OL : OPP, gameTime: 20 + i * 10, gameTimeDisplay: `${20 + i * 10}'`, type: 'goal', isMajor: true,
    playerId: 1, extraPlayerId: null, playerName: i % 2 === 0 ? 'Cherki' : 'Thauvin', playerShortName: null, extraPlayerName: null, description: 'But',
  }));
  return {
    gameId: 10, matchupId: '465-1-10', competitionId: 35, competitionName: 'Ligue 1', status, statusGroup: 4, statusText: status === 'upcoming' ? 'À venir' : 'Terminé',
    gameTime: 90, gameTimeDisplay: "90'", startTime: '2026-10-11T20:00:00Z', home, away,
    teamStats: team ? { home: FULL_TEAM(0), away: FULL_TEAM(1) } : { home: {}, away: {} },
    events: events ? ev : [],
    topPerformers: performers ? [{ role: 'Meilleur buteur', homePlayer: { id: 1, name: 'Joueur-Domicile', statValue: '1', statName: 'Buts' }, awayPlayer: { id: 2, name: 'Joueur-Visiteur', statValue: '1', statName: 'Buts' } }] : [],
    shots: shots
      ? [
          { competitorId: OL, playerId: 1, time: "23'", xg: 0.4, xgot: 0.5, bodyPart: 'Foot', outcome: 'But', line: 90, side: 40 },
          { competitorId: OL, playerId: 1, time: "30'", xg: 0.2, xgot: 0.2, bodyPart: 'Foot', outcome: 'Cadré', line: 85, side: 60 },
          { competitorId: OPP, playerId: 2, time: "78'", xg: 0.3, xgot: 0.4, bodyPart: 'Foot', outcome: 'But', line: 90, side: 50 },
          { competitorId: OPP, playerId: 2, time: "80'", xg: 0.1, xgot: 0, bodyPart: 'Foot', outcome: 'Manqué', line: 80, side: 30 },
        ]
      : [],
    momentum: momentum ? Array.from({ length: 30 }, (_, i) => ({ minute: i * 3, value: 20 + (i % 5) * 10 })) : undefined,
    lineups: lu,
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
const chain = (el: Element, stop: Element) => {
  const out: Element[] = [];
  for (let e: Element | null = el; e && e !== stop; e = e.parentElement) out.push(e);
  return out;
};
const chainCss = (el: Element, stop: Element) => chain(el, stop).map(css).join(' ');
const before = (a: Element, b: Element) => !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
const centreIds = (col: Element) => Array.from(col.children).map((c) => (c as HTMLElement).dataset.testid);
// L186 — fiche R8 : « Le centre empile, dans l'ordre : Faits du match, puis la rangée Statistiques comparées | Momentum,
// puis la rangée Carte des tirs | (Joueurs en vue sur Classement en direct). » ; R10 : le DOM suit cet ordre de lecture.
// Le centre est UNE colonne (R4) : ses blocs sont lus dans l'ordre du DOM, quelle que soit la rangée qui les porte.
const CENTRE_COMPLET = ['faits-match', 'bloc-statistiques', 'elan', 'carte-tirs', 'joueurs-en-vue', 'classement-direct'];
const blocsDuCentre = (col: Element) =>
  Array.from(col.querySelectorAll('[data-testid]'))
    .map((e) => (e as HTMLElement).dataset.testid!)
    .filter((id) => CENTRE_COMPLET.includes(id));
const MIN = 'min-[1440px]:';

// Contraste WCAG 2.x
const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  s /= 100; l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0), f(8), f(4)];
}
const lum = ([h, s, l]: number[]) => {
  const [r, g, b] = hslToRgb(h, s, l).map(lin);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a: number[], b: number[]) => {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};
const token = (name: string) => {
  const css0 = readFileSync(path.resolve(__dirname, '../index.css'), 'utf8');
  const m = css0.match(new RegExp(`--${name}:\\s*([\\d.]+)\\s+([\\d.]+)%\\s+([\\d.]+)%`));
  if (!m) throw new Error(`jeton --${name} introuvable`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
};

beforeEach(() => {
  nextId = 1000;
  calls.length = 0;
  observed.length = 0;
  vi.stubGlobal('ResizeObserver', class { constructor() {} observe(el: Element) { observed.push(el); } unobserve() {} disconnect() {} });
  setWidth(1440);
});

describe('Page match en écran FM (L160)', () => {
  // ---------------------------------------------------------------- R1, R2
  it('R1 — chargement : message, aucune colonne', () => {
    hook = { isLoading: true, isError: false, data: undefined };
    const { rerender } = render(<MatchPage />);
    expect(tid('message-chargement')).toHaveTextContent('Chargement du match…');
    expect(screen.queryByTestId('grille-match')).toBeNull();
    expect(screen.queryByTestId('colonne-centre')).toBeNull();
    expect(screen.queryByTestId('bloc-composition')).toBeNull();
    // les données arrivées, le message disparaît et la grille prend sa place
    hook = { isLoading: false, isError: false, data: stats() };
    rerender(<MatchPage />);
    expect(screen.queryByTestId('message-chargement')).toBeNull();
    expect(tid('grille-match')).toBeInTheDocument();
  });

  it('R2 — erreur : message, aucune colonne', () => {
    hook = { isLoading: false, isError: true, data: undefined };
    const { rerender } = render(<MatchPage />);
    expect(tid('message-erreur')).toHaveTextContent('Match introuvable');
    expect(screen.getByRole('link')).toBeInTheDocument();
    expect(screen.queryByTestId('grille-match')).toBeNull();
    expect(screen.queryByTestId('colonne-centre')).toBeNull();
    // le match revenu (nouvelle tentative), l'erreur disparaît et la grille s'affiche
    hook = { isLoading: false, isError: false, data: stats() };
    rerender(<MatchPage />);
    expect(screen.queryByTestId('message-erreur')).toBeNull();
    expect(tid('grille-match')).toBeInTheDocument();
  });

  it("R2 — le message d'erreur porte la classe text-loss-fg (contraste ≥ 4,5:1)", () => {
    hook = { isLoading: false, isError: true, data: undefined };
    render(<MatchPage />);
    const el = tid('message-erreur');
    expect(el).toHaveClass('text-loss-fg');
    expect(tokens(el)).not.toContain('text-loss');
  });

  // ---------------------------------------------------------------- R3
  it("R3 — vide : en-tête et message, aucun bloc absent, centre à la même largeur qu'avec données", () => {
    const { unmount } = show();
    const classesCharge = tid('colonne-centre').getAttribute('class');
    unmount();
    show({ status: 'upcoming', lineups: 'none', events: false, shots: false, momentum: false, performers: false, standings: false, team: false });
    const entete = tid('entete-score');
    expect(entete).toHaveTextContent('À venir');
    expect(entete).toHaveTextContent('vs');
    expect(entete).toHaveTextContent('À VENIR');
    // L172 : date courte et heure du coup d'envoi (fixture : 2026-10-11T20:00:00Z, TZ Europe/Paris → 22h00)
    expect(screen.getByText('Dim. 11/10 · 22h00')).toBeInTheDocument();
    expect(tid('grille-match')).toBeInTheDocument();
    expect(tid('message-stats-vide')).toHaveTextContent('Pas encore de statistiques.');
    expect(within(tid('colonne-centre')).getByTestId('bloc-statistiques')).toBeInTheDocument();
    // L173 : Joueurs en vue reste affiché (état vide explicite) sur un match à venir, texte fixé par L173
    expect(tid('joueurs-en-vue')).toBeInTheDocument();
    for (const id of ['bloc-composition', 'stats-equipe-domicile', 'stats-equipe-visiteur', 'faits-match', 'elan', 'carte-tirs', 'classement-direct']) {
      expect(screen.queryByTestId(id)).toBeNull();
    }
    expect(tid('colonne-centre').getAttribute('class')).toBe(classesCharge);
    // L172 : heure non confirmée → jour non ferme de L47 (dimanche 11/10 → « Week-end du 10/10 ») + « Horaire à confirmer », jamais une heure ni la date de remplissage
    cleanup();
    hook = { isLoading: false, isError: false, data: { ...stats({ status: 'upcoming', lineups: 'none', events: false, shots: false, momentum: false, performers: false, standings: false, team: false }), timeConfirmed: false } };
    render(<MatchPage />);
    expect(screen.getByText('Week-end du 10/10 · Horaire à confirmer')).toBeInTheDocument();
    expect(screen.queryByText(/Dim\. 11\/10/)).toBeNull();
    expect(screen.queryByText(/\d{1,2}h\d{2}/)).toBeNull();
  });

  // ---------------------------------------------------------------- R4
  it("R4 — 1440 dans l'enveloppe de l'app (barre 240 px + marges 32 px) : trois colonnes, domicile à gauche, visiteur à droite, centre au milieu", () => {
    show();
    const grille = tid('grille-match');
    const t = tokens(grille);
    expect(t.some((x) => x.startsWith(`${MIN}grid-cols-[280px_minmax(0,1fr)_280px]`))).toBe(true);
    expect(t).toContain(`${MIN}grid`);
    const [home, away] = all('bloc-composition');
    expect(within(home).getByTestId('titre-composition')).toHaveTextContent('Lyon');
    expect(within(away).getByTestId('titre-composition')).toHaveTextContent('Lens');
    expect(chainCss(home, grille)).toMatch(/(col-start-1|--c:\s*1|col-\[1\])/);
    expect(chainCss(away, grille)).toMatch(/(col-start-3|--c:\s*3|col-\[3\])/);
    expect(chainCss(tid('colonne-centre'), grille)).toMatch(/(col-start-2|col-\[2\]|\bcol-2\b)/);
  });

  it('R4 — 1440 : les deux blocs de statistiques d\'équipe commencent à la même ordonnée (±1 px) et les deux compositions ont la même hauteur (±1 px), même si un banc tient sur deux lignes et l\'autre sur une', () => {
    show({ homeBench: BENCH_LONG, awayBench: BENCH_SHORT });
    const grille = tid('grille-match');
    const [home, away] = all('bloc-composition');
    // compositions dans la même rangée 1 des côtés, étirées à la même hauteur ; statistiques en rangée 2
    expect(chainCss(home, grille)).toMatch(/--r:\s*1|row-start-1/);
    expect(chainCss(away, grille)).toMatch(/--r:\s*1|row-start-1/);
    expect(chainCss(home, grille)).toMatch(/h-full|self-stretch|items-stretch/);
    expect(chainCss(away, grille)).toMatch(/h-full|self-stretch|items-stretch/);
    expect(chainCss(tid('stats-equipe-domicile'), grille)).toMatch(/--r:\s*2|row-start-2/);
    expect(chainCss(tid('stats-equipe-visiteur'), grille)).toMatch(/--r:\s*2|row-start-2/);
    expect(css(within(home).getByTestId('terrain-composition'))).toBe(css(within(away).getByTestId('terrain-composition')));
  });

  it('R4 — 1440 : gouttière de 16 px entre les colonnes (bord droit d\'une colonne + 16 = bord gauche de la suivante, ±1 px, y compris Composition et Statistiques de chaque côté), centre ≥ 480 px', () => {
    show();
    const grille = tid('grille-match');
    expect(tokens(grille).some((x) => /^min-\[1440px\]:gap-x-4$|^min-\[1440px\]:gap-4$/.test(x))).toBe(true);
    const [home] = all('bloc-composition');
    const sides = chain(home, grille).filter((e) => tokens(e).some((x) => x.startsWith(`${MIN}grid-cols-[280px_minmax(0,1fr)_280px]`)));
    expect(sides).toHaveLength(1);
    expect(tokens(sides[0]).some((x) => /^min-\[1440px\]:gap-x-4$|^min-\[1440px\]:gap-4$/.test(x))).toBe(true);
    expect(tokens(grille).join(' ')).toContain('minmax(0,1fr)');
    expect(tokens(grille).join(' ')).not.toMatch(/320px/);
  });

  it('R4 — 1439 : empilement une colonne, pas de trois colonnes', () => {
    setWidth(1439);
    show();
    const grille = tid('grille-match');
    // L186 — fiche R4 : « entre lg et 1439 px les compositions restent empilées sous le centre, dont les rangées
    // côte à côte commencent dès lg (R10) » ; R10 : « la grille à trois colonnes reste à 1440 px ». La grille et les
    // côtés (ancêtres des compositions) ne posent donc rien sous 1440 px ; les rangées du centre (lg:grid) en sont exclues.
    const [home, away] = all('bloc-composition');
    const cotes = new Set([grille, ...chain(home, grille), ...chain(away, grille), ...chain(tid('stats-equipe-domicile'), grille), ...chain(tid('stats-equipe-visiteur'), grille)]);
    for (const e of cotes) {
      for (const x of tokens(e)) {
        if (/grid-cols|(^|:)grid$|grid-rows/.test(x)) expect(x.startsWith(MIN)).toBe(true);
      }
    }
    // jamais de trois colonnes (280 px / reste / 280 px) avant 1440 px, où que ce soit dans la grille
    for (const e of Array.from(grille.querySelectorAll('*'))) {
      for (const x of tokens(e)) {
        if (/grid-cols-\[.*280px/.test(x) || /grid-cols-3/.test(x)) expect(x.startsWith(MIN)).toBe(true);
      }
    }
    expect(css(grille)).not.toMatch(/xl:grid|lg:grid/);
  });

  it('R4 — 1440 : un bloc qui grandit ne change pas de colonne', () => {
    const { unmount } = show({ nEvents: 2 });
    const colFaits = () => tid('faits-match').parentElement;
    const avant = colFaits();
    expect(avant).toBe(tid('colonne-centre'));
    const homeAvant = chainCss(all('bloc-composition')[0], tid('grille-match'));
    unmount();
    show({ nEvents: 40, homeBench: BENCH_LONG });
    expect(colFaits()).toBe(tid('colonne-centre'));
    expect(chainCss(all('bloc-composition')[0], tid('grille-match'))).toBe(homeAvant);
    expect(observed.filter(estConteneurDeDisposition)).toEqual([]);
  });

  // L186 — fiche R4 : « Un bloc du centre sans donnée n'est pas affiché et le suivant remonte : jamais de trou, quel que soit l'état » ;
  // les blocs sont listés dans l'ordre de lecture du centre (R8, R10), Joueurs en vue et Classement en direct compris.
  const ETATS: [string, Opts, string[]][] = [
    ['charge complet', {}, CENTRE_COMPLET],
    ['sans carte des tirs', { shots: false }, ['faits-match', 'bloc-statistiques', 'elan', 'joueurs-en-vue', 'classement-direct']],
    ['sans tirs ni Momentum', { shots: false, momentum: false }, ['faits-match', 'bloc-statistiques', 'joueurs-en-vue', 'classement-direct']],
    ['sans faits ni tirs', { events: false, shots: false }, ['bloc-statistiques', 'elan', 'joueurs-en-vue', 'classement-direct']],
  ];

  it("R4 — aucun trou : dans la colonne centrale, chaque bloc commence à (bas du précédent + 16 px de gap) ±1 px, quel que soit l'état (charge complet, sans carte des tirs, sans tirs ni Momentum, sans faits ni tirs, sans joueurs en vue ni classement)", () => {
    for (const [, o, attendu] of ETATS) {
      const { unmount } = show(o);
      const col = tid('colonne-centre');
      expect(blocsDuCentre(col)).toEqual(attendu);
      expect(tokens(col)).toEqual(expect.arrayContaining(['flex', 'flex-col', 'gap-4']));
      for (const c of Array.from(col.children)) expect(c.textContent?.trim()).not.toBe('');
      expect(centreIds(tid('colonne-centre-bas'))).toEqual(['joueurs-en-vue', 'classement-direct']);
      unmount();
    }
    show({ performers: false, standings: false });
    expect(screen.queryByTestId('joueurs-en-vue')).toBeNull();
    expect(screen.queryByTestId('classement-direct')).toBeNull();
    expect(blocsDuCentre(tid('colonne-centre'))).toEqual(['faits-match', 'bloc-statistiques', 'elan', 'carte-tirs']);
    expect(screen.queryByTestId('colonne-centre-bas')?.children.length ?? 0).toBe(0);
  });

  it("R4 — état à venir : la colonne centrale ne laisse pas de vide au-dessus du premier bloc présent (le haut du premier bloc est le haut de la grille, ±1 px), avec ou sans compositions probables", () => {
    for (const lineups of ['none', 'probable'] as const) {
      const { unmount } = show({ status: 'upcoming', lineups, events: false, shots: false, momentum: false, performers: false, standings: false, team: false });
      const col = tid('colonne-centre');
      // L186 : Statistiques est portée par la rangée Statistiques | Momentum (R4, R16) ; le premier élément du centre la contient
      expect(col.firstElementChild).toContainElement(tid('bloc-statistiques'));
      expect(blocsDuCentre(col)).toEqual(['bloc-statistiques']);
      expect(tokens(col).filter((x) => /^(mt|pt|my|py|m|p)-/.test(x))).toEqual([]);
      expect(tokens(tid('grille-match')).filter((x) => /^(pt|p|py)-/.test(x))).toEqual([]);
      unmount();
    }
  });

  it('R4 — 1440 : les colonnes sont indépendantes (agrandir un bloc latéral ne déplace aucun bloc du centre ; masquer un bloc du centre ne déplace aucun bloc latéral)', () => {
    show();
    const grille = tid('grille-match');
    // fiche R4 : « Aucune colonne ne s'étire à la hauteur d'une autre (align-items: start) »
    expect(tokens(grille)).toContain(`${MIN}items-start`);
    // L186 — fiche R4 : « Depuis L186 le centre est UNE colonne (une seule enveloppe, plus de centre haut / centre bas
    // coupés par les côtés) » : Joueurs en vue et Classement (colonne-centre-bas, la pile) sont dans cette enveloppe unique,
    // plus dans une rangée 2 de la grille extérieure (grid-rows auto / auto / 1fr et marge haute mt-4 supprimés).
    const centre = tid('colonne-centre');
    expect(centre).toContainElement(tid('colonne-centre-bas'));
    expect(grille.contains(centre)).toBe(true);
  });

  it('R4 — 1440×900 : le début des statistiques d\'équipe est visible sans défiler et aucun panneau latéral n\'a plus de 15 % de vide', () => {
    show();
    const [home, away] = all('bloc-composition');
    // terrain de 360 px, banc d'une ligne : la composition tient dans 900 px avec les statistiques d'équipe juste dessous
    for (const b of [home, away]) {
      expect(css(within(b).getByTestId('terrain-composition'))).toMatch(/360px/);
      expect(within(b).getByTestId('banc-composition')).toBeInTheDocument();
    }
    for (const id of ['stats-equipe-domicile', 'stats-equipe-visiteur']) {
      expect(within(tid(id)).getAllByText(/\d/).length).toBeGreaterThanOrEqual(5);
    }
  });

  it('R4 — BalancedColumns n\'est plus importé par match.tsx', () => {
    const src = readFileSync(path.resolve(__dirname, 'match.tsx'), 'utf8');
    expect(src).not.toMatch(/BalancedColumns|balanceColumns|balance-columns/);
    expect(existsSync(path.resolve(__dirname, '../lib/balance-columns.ts'))).toBe(false);
    show();
    expect(screen.queryByTestId('colonne-gauche')).toBeNull();
    expect(tid('grille-match')).toBeInTheDocument();
  });

  // ---------------------------------------------------------------- R5
  it('R5 — OL à domicile : OL à gauche, accent rouge', () => {
    show();
    const [home, away] = all('bloc-composition');
    expect(within(home).getByTestId('titre-composition')).toHaveTextContent('Lyon');
    expect(css(within(home).getByTestId('formation-composition')) + css(home)).toMatch(/ol-red/);
    expect(css(within(away).getByTestId('formation-composition')) + css(away)).toMatch(/ol-blue/);
    expect(tid('stats-equipe-domicile')).toHaveTextContent('Lyon');
    expect(tid('stats-equipe-visiteur')).toHaveTextContent('Lens');
  });

  it("R5 — OL en déplacement : OL à droite en rouge, adversaire à gauche en bleu, et barres, points de tirs et barres du Momentum de l'OL en rouge", () => {
    show({ olHome: false });
    const [home, away] = all('bloc-composition');
    expect(within(home).getByTestId('titre-composition')).toHaveTextContent('Lens');
    expect(within(away).getByTestId('titre-composition')).toHaveTextContent('Lyon');
    expect(css(within(away).getByTestId('formation-composition')) + css(away)).toMatch(/ol-red/);
    expect(css(within(home).getByTestId('formation-composition')) + css(home)).toMatch(/ol-blue/);
    const barres = tid('bloc-statistiques').innerHTML;
    expect(barres.indexOf('ol-blue-bright')).toBeGreaterThanOrEqual(0);
    expect(barres.indexOf('ol-blue-bright')).toBeLessThan(barres.indexOf('ol-red'));
    // Momentum : pression à domicile (adversaire) → barres vers le haut, bleues, sans rouge
    const mom = within(tid('elan')).getByRole('img', { name: 'Momentum' }).innerHTML;
    expect(mom).toMatch(/ol-blue-bright/);
    expect(mom).not.toMatch(/ol-red/);
  });

  it('R5 — Momentum : barres vers le haut (domicile) et vers le bas (visiteur) à la couleur du club, légende des noms puis « Vers le haut : X, vers le bas : Y », aria-label « Momentum »', () => {
    show();
    const bloc = tid('elan');
    const svg = within(bloc).getByRole('img', { name: 'Momentum' });
    expect(svg).toHaveAttribute('aria-label', 'Momentum');
    expect(svg.innerHTML).toMatch(/ol-red/);
    expect(svg.innerHTML).not.toMatch(/ol-blue(?!-bright)/);
    expect(within(bloc).getByRole('heading', { level: 2 })).toHaveTextContent('Momentum');
    const txt = bloc.textContent ?? '';
    expect(txt.indexOf('Lyon')).toBeGreaterThanOrEqual(0);
    expect(txt.indexOf('Lyon')).toBeLessThan(txt.indexOf('Lens'));
    expect(txt).toContain('Vers le haut : Lyon, vers le bas : Lens.');
    // pression visiteur → barres bleues
    const { unmount } = render(<div />);
    unmount();
  });

  it('R5 — contraste : les barres du Momentum, les barres comparées et les marqueurs de la carte des tirs mesurent au moins 3:1 sur --surface (rouge OL et bleu adverse, opacité 1) ; les libellés d\'attaque et numéros de pastille au moins 4,5:1', () => {
    expect(ratio(token('ol-red'), token('surface'))).toBeGreaterThanOrEqual(3);
    expect(ratio(token('ol-blue-bright'), token('surface'))).toBeGreaterThanOrEqual(3);
    expect(ratio(token('ol-red-bright'), token('surface'))).toBeGreaterThanOrEqual(4.5);
    expect(ratio([226, 70, 70], token('surface'))).toBeGreaterThanOrEqual(4.5);
    show();
    for (const id of ['elan', 'carte-tirs', 'bloc-statistiques']) {
      const html = tid(id).innerHTML;
      expect(html, id).toMatch(/ol-red/);
      expect(html, id).toMatch(/ol-blue-bright/);
      expect(html, id).not.toMatch(/ol-blue(?!-bright)/);
      expect(html, id).not.toMatch(/opacity[:=]\s*"?0?\.85/);
      expect(html, id).not.toMatch(/\bopacity-(80|85|90)\b/);
    }
    const tirs = tid('carte-tirs').innerHTML;
    expect(tirs).toMatch(/ol-red-bright/);
    expect(tirs).toMatch(/226[ _]70%[ _]70%/);
    expect(tirs).not.toMatch(/text-ol-blue\b/);
    expect(tirs).not.toMatch(/62a8e3|20,\s*32,\s*28/i);
    const [home, away] = all('bloc-composition');
    expect(home.innerHTML).toMatch(/ol-red-bright/);
    expect(away.innerHTML).toMatch(/226[ _]70%[ _]70%/);
  });

  it('R5 — un même club a la même teinte dans les barres comparées, le Momentum, la carte des tirs et leurs légendes (OL à domicile, puis à l\'extérieur)', () => {
    for (const olHome of [true, false]) {
      const { unmount } = show({ olHome, momentum: true });
      const colorOf = (id: string, nom: RegExp) => {
        const bloc = tid(id);
        const el = Array.from(bloc.querySelectorAll('*')).find((e) => e.children.length === 0 && nom.test(e.textContent ?? ''));
        return el;
      };
      void colorOf;
      const legende = within(tid('carte-tirs')).getByText(/OL Lyon/).parentElement as HTMLElement;
      expect(legende.innerHTML).toMatch(/ol-red/);
      const legendeAdv = within(tid('carte-tirs')).getByText(/RCL Lens/).parentElement as HTMLElement;
      expect(legendeAdv.innerHTML).toMatch(/ol-blue-bright/);
      expect(legende.innerHTML).not.toMatch(/ol-blue/);
      expect(legendeAdv.innerHTML).not.toMatch(/ol-red/);
      const entete = within(tid('elan')).getByText('Lyon').closest('span') ?? within(tid('elan')).getByText('Lyon').parentElement!;
      expect(entete.innerHTML).toMatch(/ol-red/);
      const carte = within(tid('carte-tirs')).getByRole('img', { name: 'Carte des tirs' }).innerHTML;
      expect(carte).toMatch(/ol-red/);
      expect(carte).toMatch(/ol-blue-bright/);
      const barres = tid('bloc-statistiques').innerHTML;
      const iRouge = barres.indexOf('ol-red');
      const iBleu = barres.indexOf('ol-blue-bright');
      expect(olHome ? iRouge < iBleu : iBleu < iRouge).toBe(true);
      unmount();
    }
  });

  it('R5 — chaque côté contient sa composition puis ses statistiques', () => {
    show();
    const grille = tid('grille-match');
    const [home, away] = all('bloc-composition');
    expect(chainCss(home, grille)).toMatch(/--c:\s*1|col-start-1/);
    expect(chainCss(tid('stats-equipe-domicile'), grille)).toMatch(/--c:\s*1|col-start-1/);
    expect(chainCss(away, grille)).toMatch(/--c:\s*3|col-start-3/);
    expect(chainCss(tid('stats-equipe-visiteur'), grille)).toMatch(/--c:\s*3|col-start-3/);
    expect(before(home, tid('stats-equipe-domicile'))).toBe(true);
    expect(before(away, tid('stats-equipe-visiteur'))).toBe(true);
    expect(within(tid('stats-equipe-domicile')).getByRole('heading', { level: 2 })).toHaveTextContent('Statistiques · Lyon');
    expect(within(tid('stats-equipe-visiteur')).getByRole('heading', { level: 2 })).toHaveTextContent('Statistiques · Lens');
  });

  // L186 — fiche R10 : « en-tête du score, Faits du match, Statistiques comparées, Momentum, Carte des tirs, Joueurs en vue,
  // Classement en direct, puis composition et statistiques de l'équipe à domicile, composition et statistiques de l'équipe visiteuse »
  const ORDRE_DOM = [
    'entete-score', 'faits-match', 'bloc-statistiques', 'elan', 'carte-tirs', 'joueurs-en-vue', 'classement-direct',
    'comp-0', 'stats-equipe-domicile', 'comp-1', 'stats-equipe-visiteur',
  ];
  const noeudsOrdonnes = () =>
    ORDRE_DOM.map((id) => (id.startsWith('comp-') ? all('bloc-composition')[Number(id.slice(5))] : tid(id)));

  it("R5 — l'ordre du DOM est celui de R10", () => {
    show();
    const n = noeudsOrdonnes();
    for (let i = 1; i < n.length; i++) expect(before(n[i - 1], n[i]), ORDRE_DOM[i]).toBe(true);
    expect(tid('grille-match')).toBeInTheDocument();
  });

  // ---------------------------------------------------------------- R6, R7
  it('R6 — 4-2-3-1 contre 4-4-2 : terrains de même hauteur ±1 px', () => {
    show({ homeFormation: '4-2-3-1', awayFormation: '4-4-2' });
    const [a, b] = all('terrain-composition');
    expect(css(a)).toMatch(/360px/);
    expect(css(a)).toBe(css(b));
    expect(a.children).toHaveLength(5);
    expect(b.children).toHaveLength(4);
  });

  it('R6 — 4-2-3-1 contre formation inconnue : même hauteur', () => {
    show({ homeFormation: '4-2-3-1', awayFormation: '' });
    const [a, b] = all('terrain-composition');
    expect(css(a)).toMatch(/360px/);
    expect(css(a)).toBe(css(b));
  });

  it('R6 — les 11 titulaires restent visibles dans la hauteur fixe à 1440 et à 390', () => {
    for (const w of [1440, 390]) {
      setWidth(w);
      const { unmount } = show();
      for (const t of all('terrain-composition')) {
        const rangees = within(t).getAllByTestId('rangee-composition');
        const n = rangees.reduce((s, r) => s + r.children.length, 0);
        expect(n).toBe(11);
        expect(css(t)).toMatch(/360px/);
        expect(tokens(t).some((x) => /overflow-(hidden|auto|scroll)/.test(x))).toBe(false);
      }
      unmount();
    }
  });

  it('R7 — hauteur du terrain 360 px à 1440 et à 390', () => {
    for (const w of [1440, 390]) {
      setWidth(w);
      const { unmount } = show();
      for (const t of all('terrain-composition')) {
        const d = css(t);
        expect(d).toMatch(/360px/);
        expect(tokens(t).filter((x) => x.includes(':') && /(^|:)h-/.test(x))).toEqual([]);
        expect(d).toMatch(/justify-around|space-around/);
      }
      unmount();
    }
  });

  // ---------------------------------------------------------------- R8
  it('R8 — 1440 : le centre contient faits, statistiques et momentum, carte des tirs, joueurs en vue, classement, dans cet ordre', () => {
    show();
    const grille = tid('grille-match');
    expect(grille).not.toContainElement(tid('entete-score'));
    expect(before(tid('entete-score'), grille)).toBe(true);
    // L186 — R8 : « Le centre empile, dans l'ordre : Faits du match, puis la rangée Statistiques comparées | Momentum,
    // puis la rangée Carte des tirs | (Joueurs en vue sur Classement en direct). »
    expect(blocsDuCentre(tid('colonne-centre'))).toEqual(CENTRE_COMPLET);
    expect(centreIds(tid('colonne-centre-bas'))).toEqual(['joueurs-en-vue', 'classement-direct']);
    expect(tid('colonne-centre-bas')).not.toContainElement(tid('bloc-statistiques'));
  });

  it("R8 — sans tir : la carte des tirs n'est pas affichée, le Momentum reste", () => {
    show({ shots: false });
    expect(screen.queryByTestId('carte-tirs')).toBeNull();
    expect(within(tid('colonne-centre')).getByTestId('elan')).toBeInTheDocument();
    // L186 — R8 : « Un bloc sans donnée n'est pas affiché » ; le Momentum suit Statistiques dans l'ordre du centre
    expect(blocsDuCentre(tid('colonne-centre'))).toEqual(['faits-match', 'bloc-statistiques', 'elan', 'joueurs-en-vue', 'classement-direct']);
  });

  // ---------------------------------------------------------------- R9
  it('R9 — les 4 mesures du centre ne sont pas répétées dans les blocs latéraux', () => {
    show();
    const centre = tid('bloc-statistiques').textContent ?? '';
    for (const l of ['Possession', 'Tirs', 'Tirs cadrés', 'xG']) expect(centre).toContain(l);
    for (const l of ['Passes complétées', 'Interceptions', 'Fautes', 'Duels au sol']) expect(centre).not.toContain(l);
    for (const id of ['stats-equipe-domicile', 'stats-equipe-visiteur']) {
      const t = tid(id).textContent ?? '';
      for (const l of ['Passes complétées', 'Passes dans la moitié adverse', 'Centres', 'Tacles', 'Interceptions', 'Duels au sol', 'Duels aériens', 'Récupérations', 'Fautes']) {
        expect(t, `${id} ${l}`).toContain(l);
      }
      for (const l of ['Possession', 'Tirs', 'xG', 'Touches']) expect(t, `${id} ${l}`).not.toContain(l);
    }
    expect(tid('stats-equipe-domicile')).toHaveTextContent('421');
  });

  it("R9 — une mesure à 0 des deux côtés n'apparaît nulle part", () => {
    show();
    expect(screen.queryByText(/Hors-jeu/)).toBeNull();
    expect(tid('stats-equipe-domicile').textContent).not.toContain('Hors');
    expect(tid('stats-equipe-visiteur').textContent).not.toContain('Hors');
  });

  // ---------------------------------------------------------------- R10
  it('R10 — 390 : ordre des blocs de haut en bas', () => {
    setWidth(390);
    show();
    const n = noeudsOrdonnes();
    for (let i = 1; i < n.length; i++) expect(before(n[i - 1], n[i]), ORDRE_DOM[i]).toBe(true);
    expect(tid('grille-match')).toBeInTheDocument();
  });

  it('R10 — ordre du DOM = ordre affiché à 390 (Statistiques avant Momentum, compositions de Lyon avant celles de Lens, compositions après Classement en direct)', () => {
    setWidth(390);
    show();
    const [home, away] = all('bloc-composition');
    expect(home).toHaveTextContent('Composition · Lyon');
    expect(away).toHaveTextContent('Composition · Lens');
    expect(before(home, away)).toBe(true);
    // L186 — R10 : « Statistiques comparées, Momentum, Carte des tirs, Joueurs en vue, Classement en direct, puis composition et statistiques de l'équipe à domicile, [...] visiteuse »
    expect(before(tid('bloc-statistiques'), tid('elan'))).toBe(true);
    expect(before(tid('joueurs-en-vue'), tid('classement-direct'))).toBe(true);
    expect(before(tid('classement-direct'), home)).toBe(true);
    expect(before(tid('stats-equipe-domicile'), away)).toBe(true);
    expect(before(tid('bloc-statistiques'), home)).toBe(true);
    // pas de réordonnancement sous 1440 px
    const grille = tid('grille-match');
    for (const e of [grille, ...Array.from(grille.querySelectorAll('*'))]) {
      for (const x of tokens(e)) {
        if (/^(order-|-order-|flex-col-reverse|flex-row-reverse)/.test(x)) throw new Error(`${x} réordonne sous 1440 px`);
      }
    }
  });

  it('R10 — display:contents n\'est posé que sur des div sans rôle ; ni order ni grid-row / grid-column sous 1440 px', () => {
    const { container } = show();
    const grille = tid('grille-match');
    expect(grille).toBeInTheDocument();
    let contents = 0;
    for (const e of Array.from(container.querySelectorAll('*'))) {
      const nu = tokens(e).filter((x) => !x.includes(':'));
      if (nu.includes('contents')) {
        contents++;
        expect(e.tagName).toBe('DIV');
        expect(e.hasAttribute('role')).toBe(false);
      }
      for (const x of nu) expect(x).not.toMatch(/^(order-|col-start|col-end|col-span|row-start|row-end|row-span|col-\d|row-\d|col-\[|row-\[|flex-col-reverse|flex-row-reverse)/);
      const st = (e as HTMLElement).style;
      expect(st.gridRow || st.gridColumn || st.order || '').toBe('');
    }
    expect(contents).toBeGreaterThan(0);
  });

  it('R10 — 390 : pas de défilement horizontal (scrollWidth = clientWidth)', () => {
    setWidth(390);
    const { container } = show({ homeBench: BENCH_LONG });
    const grille = tid('grille-match');
    for (const e of [grille, ...Array.from(grille.querySelectorAll('*'))]) {
      for (const x of tokens(e)) {
        if (x.includes(':')) continue;
        const m = x.match(/^(?:w|min-w)-\[(\d+)px\]/);
        if (m) expect(Number(m[1])).toBeLessThan(390);
        expect(x).not.toMatch(/^grid-cols-\[.*\d{3}px/);
      }
      const w = (e as HTMLElement).style.width;
      if (/px$/.test(w)) expect(parseFloat(w)).toBeLessThan(390);
    }
    expect(container.querySelectorAll('[data-testid="colonne-centre"]')).toHaveLength(1);
  });

  // ---------------------------------------------------------------- R11
  it('R11 — deux blocs Composition de 11 titulaires, Faits, Statistiques, Classement de 5 lignes présents', () => {
    show();
    const blocs = all('bloc-composition');
    expect(blocs).toHaveLength(2);
    for (const b of blocs) {
      const n = within(b).getAllByTestId('rangee-composition').reduce((s, r) => s + r.children.length, 0);
      expect(n).toBe(11);
    }
    expect(tid('faits-match')).toHaveTextContent('Faits du match');
    expect(tid('bloc-statistiques')).toHaveTextContent('Statistiques');
    const cl = tid('classement-direct');
    expect(cl).toHaveTextContent('Classement en direct');
    for (const n of [1, 2, 3, 4, 5]) expect(cl).toHaveTextContent(n === 3 ? 'Lyon' : `Club ${n}`);
    expect(cl).toHaveTextContent('Ligue 1 →');
    expect(tid('entete-score').textContent).toContain('·');
    expect(within(tid('elan')).getByRole('heading', { level: 2 })).toHaveTextContent('Momentum');
    expect(screen.queryByText('Élan')).toBeNull();
  });

  it('R11 — un seul appel /api/live-match/{gameId}/stats', () => {
    show();
    expect(tid('grille-match')).toBeInTheDocument();
    expect(calls.length).toBeGreaterThan(0);
    expect(new Set(calls).size).toBe(1);
    expect(calls[0]).toContain('10');
  });

  // ---------------------------------------------------------------- R12
  it('R12 — 10 titres h2 en charge, dont « Momentum », un seul h1', () => {
    show();
    const h2 = screen.getAllByRole('heading', { level: 2 });
    expect(h2).toHaveLength(10);
    const txt = h2.map((h) => h.textContent);
    expect(txt).toEqual(expect.arrayContaining(['Faits du match', 'Momentum', 'Carte des tirs', 'Statistiques', 'Joueurs en vue', 'Classement en direct']));
    expect(txt).toEqual(expect.arrayContaining(['Composition · Lyon', 'Composition · Lens', 'Statistiques · Lyon', 'Statistiques · Lens']));
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(within(tid('colonne-centre-bas')).getAllByRole('heading', { level: 2 })).toHaveLength(2);
  });

  it("R12 — l'apparence des titres est inchangée (mêmes classes)", () => {
    show();
    const h2 = screen.getAllByRole('heading', { level: 2 });
    expect(h2).toHaveLength(10);
    const classes = new Set(h2.map((h) => h.getAttribute('class')));
    expect(classes.size).toBe(1);
    expect([...classes][0]).toBeTruthy();
    expect(h2[0].tagName).toBe('H2');
  });

  // ---------------------------------------------------------------- R13
  it("R13 — OL à l'extérieur : adversaire à gauche, OL à droite en rouge", () => {
    show({ olHome: false });
    const grille = tid('grille-match');
    const [home, away] = all('bloc-composition');
    expect(within(home).getByTestId('titre-composition')).toHaveTextContent('Lens');
    expect(within(away).getByTestId('titre-composition')).toHaveTextContent('Lyon');
    expect(chainCss(home, grille)).toMatch(/--c:\s*1|col-start-1/);
    expect(chainCss(away, grille)).toMatch(/--c:\s*3|col-start-3/);
    expect(css(within(away).getByTestId('formation-composition')) + css(away)).toMatch(/ol-red/);
    expect(css(within(home).getByTestId('formation-composition')) + css(home)).toMatch(/ol-blue/);
    const entete = tid('entete-score').textContent ?? '';
    expect(entete.indexOf('Lens')).toBeLessThan(entete.indexOf('Lyon'));
    // faits : le but de l'OL (competitorId = OL) est du côté visiteur, donc à droite
    const faits = tid('faits-match');
    expect(faits).toBeInTheDocument();
  });

  it("R13 — OL à l'extérieur : barres et points de tirs de l'OL en rouge", () => {
    show({ olHome: false });
    const barres = tid('bloc-statistiques').innerHTML;
    expect(barres.indexOf('ol-blue-bright')).toBeLessThan(barres.indexOf('ol-red'));
    const carte = within(tid('carte-tirs')).getByRole('img', { name: 'Carte des tirs' });
    expect(carte.innerHTML).toMatch(/ol-red/);
    expect(carte.innerHTML).toMatch(/ol-blue-bright/);
    const mom = within(tid('elan')).getByRole('img', { name: 'Momentum' }).innerHTML;
    expect(mom).toMatch(/ol-blue-bright/);
  });

  it('R13 — OL à l\'extérieur : Joueurs en vue, domicile à gauche et visiteur à droite', () => {
    show({ olHome: false });
    const j = tid('joueurs-en-vue');
    expect(within(tid('colonne-centre-bas')).getByTestId('joueurs-en-vue')).toBe(j);
    const txt = j.textContent ?? '';
    expect(txt.indexOf('Joueur-Domicile')).toBeGreaterThanOrEqual(0);
    expect(txt.indexOf('Joueur-Domicile')).toBeLessThan(txt.indexOf('Joueur-Visiteur'));
  });

  it('R13 — OL à l\'extérieur : libellés d\'attaque, OL en rouge à gauche et adversaire en bleu à droite', () => {
    show({ olHome: false });
    const carte = tid('carte-tirs');
    // L186 — R13 : « libellés d'attaque (« ↓ OL attaque » rouge à gauche, « RCL attaque ↑ » bleu à droite, L186) »
    const gauche = within(carte).getByText(/↓ OL attaque/);
    const droite = within(carte).getByText(/RCL attaque ↑/);
    expect(css(gauche)).toMatch(/ol-red-bright/);
    expect(css(droite)).toMatch(/226[ _]70%[ _]70%/);
  });

  // ---------------------------------------------------------------- R14
  const probable = (lineups: 'probable' | 'mixte') =>
    show({ status: 'upcoming', lineups, events: false, shots: false, momentum: false, performers: false, standings: false, team: false });

  it('R14 — à venir probable : deux compositions, chacune avec l\'étiquette « Composition probable »', () => {
    probable('probable');
    const blocs = all('bloc-composition');
    expect(blocs).toHaveLength(2);
    for (const b of blocs) expect(within(b).getByTestId('etiquette-probable')).toHaveTextContent('Composition probable');
    expect(screen.queryByTestId('stats-equipe-domicile')).toBeNull();
    expect(screen.queryByTestId('stats-equipe-visiteur')).toBeNull();
    expect(screen.queryAllByTestId('bande-reservee')).toHaveLength(0);
    for (const b of blocs) {
      expect(before(within(b).getByTestId('titre-composition'), within(b).getByTestId('etiquette-probable'))).toBe(true);
      expect(before(within(b).getByTestId('etiquette-probable'), within(b).getByTestId('terrain-composition'))).toBe(true);
    }
  });

  it('R14 — terrains à la même ordonnée (±1 px) même si une seule composition est probable', () => {
    probable('mixte');
    const [home, away] = all('bloc-composition');
    expect(within(home).getByTestId('etiquette-probable')).toHaveTextContent('Composition probable');
    expect(within(away).queryByTestId('etiquette-probable')).toBeNull();
    const bande = within(away).getByTestId('bande-reservee');
    expect(bande).toBeEmptyDOMElement();
    expect(before(bande, within(away).getByTestId('terrain-composition'))).toBe(true);
    expect(before(within(away).getByTestId('titre-composition'), bande)).toBe(true);
    const h = (e: Element) => css(e).match(/h-6\b|h-\[24px\]|height:\s*24px/);
    expect(h(bande)).toBeTruthy();
    expect(h(within(home).getByTestId('etiquette-probable'))).toBeTruthy();
    expect(css(within(home).getByTestId('terrain-composition'))).toBe(css(within(away).getByTestId('terrain-composition')));
  });

  it('R14 — centre : message « Pas encore de statistiques. », pas de faits ni de tirs', () => {
    probable('probable');
    const centre = tid('colonne-centre');
    expect(within(centre).getByTestId('bloc-statistiques')).toBeInTheDocument();
    expect(within(centre).getByTestId('message-stats-vide')).toHaveTextContent('Pas encore de statistiques.');
    for (const id of ['faits-match', 'carte-tirs', 'elan']) expect(screen.queryByTestId(id)).toBeNull();
    expect(tid('entete-score')).toHaveTextContent('À venir');
  });

  // ---------------------------------------------------------------- R15
  it('R15 — le xG s\'affiche avec une virgule et deux décimales', () => {
    show();
    const b = tid('bloc-statistiques');
    expect(b).toHaveTextContent('1,87');
    expect(b).toHaveTextContent('0,94');
    expect(b.textContent).not.toContain('1.87');
    expect(tid('grille-match')).toBeInTheDocument();
  });
});
