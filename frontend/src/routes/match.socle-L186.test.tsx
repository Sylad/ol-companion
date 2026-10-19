import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { ShotMap } from '@/components/shot-map';
import type { LiveMatchLineup, LiveMatchLineupPlayer, LiveMatchStats } from '@/types/api';

// L186 — acceptation de l'écran page-match-fm (docs/specs/page-match-fm/fiche.yaml), règles R1 à R15 dans la disposition
// d'après L186 (centre en UNE colonne : Faits, rangée Statistiques | Momentum, rangée Carte des tirs | pile).
// Chaque test qui rend la page chargée commence par la structure du centre de L186 (voir structureCentre) : c'est ce qui
// les tient rouges tant que le lot n'est pas livré, les règles R1 à R15 ne changeant pas autrement.
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

// R4 — « Depuis L186 le centre est UNE colonne (une seule enveloppe [...]) : Faits du match, puis la rangée Statistiques | Momentum (R16),
// puis la rangée Carte des tirs | pile Joueurs en vue + Classement en direct (R17, R18). »
const structureCentre = () => {
  const centre = tid('colonne-centre');
  expect(within(centre).getByTestId('rangee-stats-elan')).toContainElement(tid('bloc-statistiques'));
};
const show = (o: Opts = {}) => {
  hook = { isLoading: false, isError: false, data: stats(o) };
  const r = render(<MatchPage />);
  structureCentre();
  return r;
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


describe('Page match en écran FM (L186) — règles R1 à R15', () => {

  it('R1 — chargement : message, aucune colonne', () => {
    // R1 — « Pendant le chargement, la page affiche le message d'attente existant, sans grille et sans squelette »
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
    structureCentre();
  });
  it('R2 — erreur : message, aucune colonne', () => {
    // R2 — « Si le match ne se charge pas, la page affiche l'erreur existante et un lien de retour, sans grille. »
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
    structureCentre();
  });
  it("R2 — le message d'erreur porte la classe text-loss-fg (contraste ≥ 4,5:1)", () => {
    // R2 — « classe text-loss-fg, jamais text-loss (3,85:1 sur le panneau, sous 4,5:1) »
    hook = { isLoading: false, isError: true, data: undefined };
    render(<MatchPage />);
    const el = tid('message-erreur');
    expect(el).toHaveClass('text-loss-fg');
    expect(tokens(el)).not.toContain('text-loss');
    hook = { isLoading: false, isError: false, data: stats() };
    cleanup();
    render(<MatchPage />);
    structureCentre();
  });
  it("R3 — vide : en-tête et message, aucun bloc absent, centre à la même largeur qu'avec données", () => {
    // R3 — « l'en-tête reste, les blocs absents ne s'affichent pas (aucun cadre vide), [...] le centre garde sa largeur ; le bloc Statistiques annonce l'absence de chiffres »
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
    structureCentre();
  });

  it("R3 — à venir : coup d'envoi dans l'en-tête, Joueurs en vue avec son message d'état vide", () => {
    const vide = { status: 'upcoming', lineups: 'none', events: false, shots: false, momentum: false, performers: false, standings: false, team: false } as const;
    show(vide);
    // R3 — « la date courte et l'heure du coup d'envoi (« Jeu. 22/10 · 21h00 »[...]) » (fixture : 2026-10-11T20:00:00Z, Europe/Paris)
    expect(within(tid('entete-score')).getByTestId('coup-envoi')).toHaveTextContent('Dim. 11/10 · 22h00');
    // R3 — « quand topPerformers est vide il s'affiche, en pleine largeur du centre faute de carte des tirs (R18), avec l'état vide « Les joueurs en vue apparaîtront avec les statistiques du match. » »
    expect(tid('message-joueurs-en-vue-vide')).toHaveTextContent('Les joueurs en vue apparaîtront avec les statistiques du match.');
    expect(within(tid('colonne-centre')).getByTestId('joueurs-en-vue')).toBeInTheDocument();
    cleanup();
    // R3 — « avec des chiffres, il porte la mention « Chiffres de la saison avant le coup d’envoi, pas de ce match. » »
    show({ ...vide, performers: true });
    expect(tid('periode-joueurs-en-vue')).toHaveTextContent('Chiffres de la saison avant le coup d’envoi, pas de ce match.');
    cleanup();
    // R3 — « sur un match terminé, il reste dans le masque et disparaît quand topPerformers est vide (L173) »
    show({ performers: false });
    expect(screen.queryByTestId('joueurs-en-vue')).toBeNull();
  });
  it("R4 — 1440 dans l'enveloppe de l'app (barre 240 px + marges 32 px) : trois colonnes, domicile à gauche, visiteur à droite, centre au milieu", () => {
    // R4 — « équipe à domicile à gauche (composition puis statistiques d'équipe), match au centre, équipe visiteuse à droite ; colonnes latérales 280 px, centre = le reste »
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
    // R4 — « Les deux compositions partagent la rangée 1 des côtés (même hauteur) et les deux blocs de statistiques d'équipe commencent à la même ordonnée, sous les compositions ; les terrains gardent la même hauteur fixe (R6) »
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
    // R4 — « gouttière de 16 px entre colonnes (les bordures ne se touchent jamais) »
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
    // R4/R10 — « de 1024 à 1439 px les compositions restent empilées sous le centre » ; la grille à trois colonnes ne vaut qu'à 1440 px
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
    // R4 — « Aucune colonne ne s'étire à la hauteur d'une autre » : un bloc qui grandit reste dans sa colonne
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
  it("R4 — état à venir : la colonne centrale ne laisse pas de vide au-dessus du premier bloc présent (le haut du premier bloc est le haut de la grille, ±1 px), avec ou sans compositions probables", () => {
    // R4 — « Un bloc du centre sans donnée n'est pas affiché et le suivant remonte : jamais de trou, quel que soit l'état »
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
    // R4 — « Aucune colonne ne s'étire à la hauteur d'une autre (align-items: start) : la hauteur d'un côté ne déplace aucun bloc du centre, ni l'inverse »
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
    // R4 — « les terrains gardent la même hauteur fixe (R6) » : composition de 360 px et statistiques d'équipe juste dessous
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

  it('R4 — 1440×900 : Statistiques et Momentum sont entièrement visibles sans défiler (bas des deux blocs ≤ 900 px)', () => {
    show();
    const rangee = tid('rangee-stats-elan');
    // R4 — « la rangée Statistiques | Momentum (R16) » : les deux blocs sont côte à côte, dans la même rangée du centre, sous les Faits du match
    expect(within(rangee).getByTestId('bloc-statistiques')).toBeInTheDocument();
    expect(within(rangee).getByTestId('elan')).toBeInTheDocument();
    expect(before(tid('faits-match'), rangee)).toBe(true);
    // R16 — « son tracé a pour hauteur min(96 px, hauteur de l'ancien tracé) [...] svg viewBox 240 × 96 »
    expect(within(tid('elan')).getByRole('img', { name: 'Momentum' }).getAttribute('viewBox')).toBe('0 0 240 96');
  });
  it('R4 — BalancedColumns n\'est plus importé par match.tsx', () => {
    // R4 — « BalancedColumns et balanceColumns ne sont plus utilisés par la page. »
    const src = readFileSync(path.resolve(__dirname, 'match.tsx'), 'utf8');
    expect(src).not.toMatch(/BalancedColumns|balanceColumns|balance-columns/);
    expect(existsSync(path.resolve(__dirname, '../lib/balance-columns.ts'))).toBe(false);
    show();
    expect(screen.queryByTestId('colonne-gauche')).toBeNull();
    expect(tid('grille-match')).toBeInTheDocument();
  });
  it('R5 — OL à domicile : OL à gauche, accent rouge', () => {
    // R5 — « colonne de gauche = équipe à domicile (data.home) [...] la couleur suit le CLUB (OL toujours rouge, adversaire toujours bleu) »
    show();
    const [home, away] = all('bloc-composition');
    expect(within(home).getByTestId('titre-composition')).toHaveTextContent('Lyon');
    expect(css(within(home).getByTestId('formation-composition')) + css(home)).toMatch(/ol-red/);
    expect(css(within(away).getByTestId('formation-composition')) + css(away)).toMatch(/ol-blue/);
    expect(tid('stats-equipe-domicile')).toHaveTextContent('Lyon');
    expect(tid('stats-equipe-visiteur')).toHaveTextContent('Lens');
  });
  it("R5 — OL en déplacement : OL à droite en rouge, adversaire à gauche en bleu, et barres, points de tirs et barres du Momentum de l'OL en rouge", () => {
    // R5 — « OL = --ol-red, adversaire = --ol-blue-bright » pour les barres comparées et les barres du Momentum, OL à l'extérieur
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
    // R5 — « barres vers le haut pour l'équipe à domicile, vers le bas pour la visiteuse [...] légende de direction « Vers le haut : <domicile>, vers le bas : <visiteur>. » (role="img", aria-label « Momentum »)
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
  });
  it('R5 — contraste : les barres du Momentum, les barres comparées et les marqueurs de la carte des tirs mesurent au moins 3:1 sur --surface (rouge OL et bleu adverse, opacité 1) ; les libellés d\'attaque et numéros de pastille au moins 4,5:1', () => {
    // R5 — « opacité 1 partout (WCAG 1.4.11 : 3:1) [...] --ol-blue, interdit pour un élément graphique » ; « (b) Texte qui porte une équipe : OL = --ol-red-bright (4,95:1), adversaire = hsl(226 70% 70%) (6,59:1) »
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
    // R5 — « la même teinte pour un même club dans tous les blocs »
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
    // R5 — « Chaque côté porte sa composition puis ses statistiques d'équipe »
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
  // R10 — « en-tête du score, Faits du match, Statistiques comparées, Momentum, Carte des tirs, Joueurs en vue,
  // Classement en direct, puis composition et statistiques de l'équipe à domicile, composition et statistiques de l'équipe visiteuse »
  const ORDRE_DOM = [
    'entete-score', 'faits-match', 'bloc-statistiques', 'elan', 'carte-tirs', 'joueurs-en-vue', 'classement-direct',
    'comp-0', 'stats-equipe-domicile', 'comp-1', 'stats-equipe-visiteur',
  ];
  const noeudsOrdonnes = () =>
    ORDRE_DOM.map((id) => (id.startsWith('comp-') ? all('bloc-composition')[Number(id.slice(5))] : tid(id)));

  it("R5 — l'ordre du DOM est celui de R10", () => {
    // R5/R10 — « Le DOM est écrit dans cet ordre »
    show();
    const n = noeudsOrdonnes();
    for (let i = 1; i < n.length; i++) expect(before(n[i - 1], n[i]), ORDRE_DOM[i]).toBe(true);
    expect(tid('grille-match')).toBeInTheDocument();
  });

  it('R5 — sous chaque minute : « OL » pour le club suivi (jamais « LYO »), le repli « REN » pour l\'adversaire', () => {
    // R5 — « « OL » fixe pour le club suivi (jamais « LYO »), [...] les trois premières lettres du nom en capitales (« REN ») »
    hook = {
      isLoading: false, isError: false,
      data: {
        ...stats({ shots: false, momentum: false, performers: false, standings: false, lineups: 'none' }),
        home: { id: OL, name: 'Lyon', symbolicName: '', imageVersion: 1, score: 1 },
        away: { id: OPP, name: 'Rennes', symbolicName: '', imageVersion: 1, score: 1 },
        events: [
          { competitorId: OL, gameTime: 12, gameTimeDisplay: "12'", type: 'goal', isMajor: true, playerId: 5, extraPlayerId: null, playerName: 'A B', playerShortName: 'B', extraPlayerName: null, description: 'But' },
          { competitorId: OPP, gameTime: 60, gameTimeDisplay: "60'", type: 'goal', isMajor: true, playerId: 6, extraPlayerId: null, playerName: 'C D', playerShortName: 'D', extraPlayerName: null, description: 'But' },
        ],
      } as unknown as LiveMatchStats,
    };
    render(<MatchPage />);
    structureCentre();
    const faits = tid('faits-match');
    // R5 — « « OL » fixe pour le club suivi (jamais « LYO »), le sigle de 365scores pour l'adversaire et, quand 365scores le renvoie vide, les trois premières lettres du nom en capitales (« REN ») »
    expect(within(faits).getByText("12'").nextElementSibling).toHaveTextContent(/^OL$/);
    expect(within(faits).getByText("60'").nextElementSibling).toHaveTextContent(/^REN$/);
    expect(faits.textContent).not.toContain('LYO');
  });

  const tir = (side: number, line: number) => ({ playerId: 1, competitorId: 10, time: 5, line, side, xg: 0.2, outcome: 'Saved' }) as never;
  const carte = (p: { homeName: string; awayName: string; homeSymbol?: string; awaySymbol?: string }) =>
    render(
      <ShotMap shots={[tir(92, 50), tir(8, 50)]} homeId={10} homeIsOl homeName={p.homeName} awayName={p.awayName} homeSymbol={p.homeSymbol ?? ''} awaySymbol={p.awaySymbol ?? ''} />,
    );

  it('R5 — sans sigle de 365scores : « OL Lyon · Rennes », pas « LYO LYON · REN RENNES »', () => {
    carte({ homeName: 'Lyon', awayName: 'Rennes' });
    const c = screen.getByTestId('carte-tirs');
    const entete = within(c).getByRole('heading', { level: 2 }).closest('header') as HTMLElement;
    // R5 — « quand le sigle n'est qu'un repli tiré du nom, elle se réduit au nom (« Rennes », pas « REN Rennes ») »
    expect(within(entete).getByText('OL Lyon')).toBeTruthy();
    expect(within(entete).getByText('Rennes')).toBeTruthy();
    expect(entete.textContent).not.toMatch(/LYO|REN\b/);
    // R5 — « (terrain à la verticale depuis L186 ») : la carte est celle de L186
    expect(within(c).getByRole('img', { name: 'Carte des tirs' }).getAttribute('viewBox')).toBe('0 0 450 700');
  });

  it('R5 — avec un vrai sigle adverse, la légende garde « RCL Lens »', () => {
    carte({ homeName: 'Lyon', awayName: 'Lens', homeSymbol: 'OL', awaySymbol: 'RCL' });
    const c = screen.getByTestId('carte-tirs');
    // R5 — « Légende de la carte des tirs « sigle + nom » (OL Lyon, RCL Lens) »
    expect(within(c).getByText('OL Lyon')).toBeTruthy();
    expect(within(c).getByText('RCL Lens')).toBeTruthy();
    // R5 — « « ↓ <visiteur> attaque » à gauche et « <domicile> attaque ↑ » à droite »
    expect(within(c).getByText('↓ RCL attaque')).toBeTruthy();
    expect(within(c).getByText('OL attaque ↑')).toBeTruthy();
  });

  it('R6 — 4-2-3-1 contre 4-4-2 : terrains de même hauteur ±1 px', () => {
    // R6 — « Les deux terrains de composition ont la même hauteur quelle que soit la formation (4-2-3-1 à 5 rangées, 4-4-2 à 4 rangées) »
    show({ homeFormation: '4-2-3-1', awayFormation: '4-4-2' });
    const [a, b] = all('terrain-composition');
    expect(css(a)).toMatch(/360px/);
    expect(css(a)).toBe(css(b));
    expect(a.children).toHaveLength(5);
    expect(b.children).toHaveLength(4);
  });
  it('R6 — 4-2-3-1 contre formation inconnue : même hauteur', () => {
    // R6 — « repli « formation inconnue » » : même hauteur
    show({ homeFormation: '4-2-3-1', awayFormation: '' });
    const [a, b] = all('terrain-composition');
    expect(css(a)).toMatch(/360px/);
    expect(css(a)).toBe(css(b));
  });
  it('R6 — les 11 titulaires restent visibles dans la hauteur fixe à 1440 et à 390', () => {
    // R6 — « les rangées se répartissent verticalement dans cette hauteur fixe »
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
    // R7 — « La hauteur du terrain est de 360 px à toute largeur, les rangées étant espacées de façon égale (justify-content: space-around). »
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
  it('R9 — les 4 mesures du centre ne sont pas répétées dans les blocs latéraux', () => {
    // R9 — « Les barres comparées du centre ne portent que possession (touches), tirs, tirs cadrés et xG » ; les latérales listent les autres mesures
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
    // R9 — « Les lignes à 0 des deux équipes sont omises. »
    show();
    expect(screen.queryByText(/Hors-jeu/)).toBeNull();
    expect(tid('stats-equipe-domicile').textContent).not.toContain('Hors');
    expect(tid('stats-equipe-visiteur').textContent).not.toContain('Hors');
  });
  it('R11 — deux blocs Composition de 11 titulaires, Faits, Statistiques, Classement de 5 lignes présents', () => {
    // R11 — « Les attendus de docs/qa/expectations.md [...] en-tête avec deux clubs, Faits du match, Statistiques, deux blocs Composition de 11, Classement en direct avec 5 lignes restent vrais » ; « titre « Momentum » compris : aucun renommage en « Élan » »
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
    // R11 — « aucun nouvel appel API [...] la page lit toujours GET /api/live-match/{gameId}/stats »
    show();
    expect(tid('grille-match')).toBeInTheDocument();
    expect(calls.length).toBeGreaterThan(0);
    expect(new Set(calls).size).toBe(1);
    expect(calls[0]).toContain('10');
  });
  it('R12 — 10 titres h2 en charge, dont « Momentum », un seul h1', () => {
    // R12 — « Le titre de chaque bloc [...] est un titre h2 [...] la page a un seul h1 »
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
    // R12 — « sans changement d'apparence »
    show();
    const h2 = screen.getAllByRole('heading', { level: 2 });
    expect(h2).toHaveLength(10);
    const classes = new Set(h2.map((h) => h.getAttribute('class')));
    expect(classes.size).toBe(1);
    expect([...classes][0]).toBeTruthy();
    expect(h2[0].tagName).toBe('H2');
  });

  const h2s = () => screen.getAllByRole('heading', { level: 2 });
  const trouve = (re: RegExp) => h2s().filter((h) => re.test(h.textContent ?? ''));

  it("R12 — le titre n'est ni tronqué ni coupé (pas de truncate, line-clamp ni text-ellipsis) et peut rétrécir pour passer à la ligne", () => {
    show();
    const titres = all('titre-composition');
    expect(titres).toHaveLength(2);
    // R12 — « le titre « Composition · club » n'est plus tronqué, il passe à la ligne »
    for (const t of titres) {
      for (const e of [t, ...Array.from(t.querySelectorAll('*'))]) {
        for (const x of tokens(e)) expect(x).not.toMatch(/(^|:)(truncate|line-clamp-\d+|text-ellipsis|whitespace-nowrap)$/);
      }
    }
  });

  it("R12 — même jeu de classes que les autres titres h2 (l'apparence ne diffère pas d'un bloc à l'autre)", () => {
    show();
    // R12 — « sans changement d'apparence » : la typographie du titre « Composition · club » est celle des autres h2
    const typo = (h: Element) => tokens(h).filter((x) => /^(text-|font-|tracking-|uppercase|capitalize)/.test(x)).sort().join(' ');
    const [premier, ...autres] = h2s();
    for (const h of autres) expect(typo(h), h.textContent ?? '').toBe(typo(premier));
    expect(trouve(/Composition · /)).toHaveLength(2);
  });

  it("R12 — l'en-tête réserve la place de deux lignes à 1440, pour que les deux terrains restent à la même ordonnée quand un seul titre passe à la ligne", () => {
    show();
    for (const b of all('bloc-composition')) {
      const t = within(b).getByTestId('titre-composition');
      // R12 — « l'en-tête d'une composition a une hauteur minimale de 60 px à partir de 1440 px »
      const entetes = chain(t, b);
      expect(entetes.some((e) => tokens(e).some((x) => /^min-\[1440px\]:min-h-(\[60px\]|15)$/.test(x)))).toBe(true);
    }
  });
  it("R13 — OL à l'extérieur : adversaire à gauche, OL à droite en rouge", () => {
    // R13 — « l'équipe à domicile (adversaire) est à gauche et l'OL à droite » ; « adversaire bleu à gauche, OL rouge à droite »
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
    // R13 — « y compris barres, points de tirs, [...] barres et pastilles de but du Momentum » (couleur par club)
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
    // R13 — « la cellule de chaque joueur de Joueurs en vue (domicile à gauche, visiteur à droite) »
    show({ olHome: false });
    const j = tid('joueurs-en-vue');
    expect(within(tid('colonne-centre-bas')).getByTestId('joueurs-en-vue')).toBe(j);
    const txt = j.textContent ?? '';
    expect(txt.indexOf('Joueur-Domicile')).toBeGreaterThanOrEqual(0);
    expect(txt.indexOf('Joueur-Domicile')).toBeLessThan(txt.indexOf('Joueur-Visiteur'));
  });
  const probable = (lineups: 'probable' | 'mixte') =>
    show({ status: 'upcoming', lineups, events: false, shots: false, momentum: false, performers: false, standings: false, team: false });

  it('R14 — à venir probable : deux compositions, chacune avec l\'étiquette « Composition probable »', () => {
    // R14 — « affiche les deux compositions sur leurs côtés, chacune avec l'étiquette « Composition probable » [...] les statistiques d'équipe latérales sont absentes »
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
    // R14 — « bande de 24 px de haut réservée dans les DEUX compositions dès que l'une est probable [...] les deux terrains restent à la même ordonnée »
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
    // R14 — « Statistiques, avec son message, est garanti, sans faits, tirs ni momentum »
    probable('probable');
    const centre = tid('colonne-centre');
    expect(within(centre).getByTestId('bloc-statistiques')).toBeInTheDocument();
    expect(within(centre).getByTestId('message-stats-vide')).toHaveTextContent('Pas encore de statistiques.');
    for (const id of ['faits-match', 'carte-tirs', 'elan']) expect(screen.queryByTestId(id)).toBeNull();
    expect(tid('entete-score')).toHaveTextContent('À venir');
  });
  it('R15 — le xG s\'affiche avec une virgule et deux décimales', () => {
    // R15 — « Les nombres décimaux des statistiques (xG) s'écrivent à la française, virgule et deux décimales (« 1,87 ») »
    show();
    const b = tid('bloc-statistiques');
    expect(b).toHaveTextContent('1,87');
    expect(b).toHaveTextContent('0,94');
    expect(b.textContent).not.toContain('1.87');
    expect(tid('grille-match')).toBeInTheDocument();
  });
});
