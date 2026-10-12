import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import type { LiveMatchLineup, LiveMatchLineupPlayer, LiveMatchStats } from '@/types/api';

// L43 — acceptation de l'écran composition-match (docs/specs/composition-match/fiche.yaml).
// Appel simulé (A1) : GET /api/live-match/{gameId}/stats, via le hook useLiveMatchStats.
// jsdom ne mesure aucune géométrie : les règles de mise en page (R7, R8) sont vérifiées
// sur ce que la pastille et la rangée déclarent (classes ou style en ligne).

type HookResult = { isLoading: boolean; isError: boolean; data: LiveMatchStats | undefined };
let hook: HookResult;

vi.mock('@tanstack/react-router', () => ({
  useParams: () => ({ gameId: '10' }),
  useSearch: () => ({ matchupId: '465-1-10' }),
  Link: ({ children }: { children: React.ReactNode }) => <a href="/">{children}</a>,
}));
vi.mock('@/hooks/use-match-event-burst', () => ({ useMatchEventBurst: () => null }));
vi.mock('@/hooks/use-live-match', () => ({ useLiveMatchStats: () => hook }));
vi.mock('@/components/shot-map', () => ({ ShotMap: () => null }));
vi.mock('@/components/momentum-chart', () => ({ MomentumChart: () => null }));
vi.mock('@/components/mini-standings', () => ({ MiniStandings: () => null }));
vi.mock('@/components/match-event-burst', () => ({ MatchEventBurst: () => null }));

import { MatchPage } from './match';

let nextId = 1;
const p = (name: string, jersey: number, yardLine: number, yardSide: number, pos = 'CM'): LiveMatchLineupPlayer => ({
  id: nextId++, name, shortName: name, jerseyNumber: jersey, positionShort: pos, yardLine, yardSide, ranking: null,
});

// Ordre volontairement mélangé : le découpage doit venir du tri yardLine puis yardSide.
const OL_421: LiveMatchLineupPlayer[] = [
  p('Lucas Perri', 1, 1, 50, 'GK'),
  p('Maitland-Niles', 2, 2, 85, 'RB'), p('Tagliafico', 3, 2, 15, 'LB'), p('Niakhaté', 4, 2, 40, 'CB'), p('Mata', 5, 2, 60, 'CB'),
  p('Matic', 8, 3, 35, 'DM'), p('Tessmann', 6, 3, 65, 'DM'),
  p('Cherki', 11, 4, 50, 'AM'), p('Fofana', 7, 4, 80, 'RW'), p('Tolisso', 10, 5, 20, 'LW'),
  p('Lacazette', 9, 7, 50, 'CF'),
];
const BENCH_OL = [p('Descamps', 30, 0, 0, 'GK'), p('Mikautadze', 14, 0, 0), p('Nuamah', 17, 0, 0), p('Morton', 21, 0, 0)];

const OPP_4141: LiveMatchLineupPlayer[] = [
  p('Samba', 1, 1, 50, 'GK'),
  p('Gradit', 3, 2, 15), p('Danso', 5, 2, 40), p('Medina', 2, 2, 60), p('Frankowski', 22, 2, 85),
  p('Machado', 8, 3, 50),
  p('Thauvin', 11, 4, 10), p('Sotoca', 10, 4, 35), p('Fulgini', 7, 5, 65), p('Said', 14, 5, 90),
  p('Wahi', 9, 7, 50),
];
const BENCH_OPP = [p('Leca', 16, 0, 0), p('Abdul Samed', 6, 0, 0)];

// Repli (R5) : 1, 4, 2, 3, 1 par yardLine, soit 5 lignes de tailles 1, 2, 3, 4, 1 de haut en bas.
const OPP_NOFORM: LiveMatchLineupPlayer[] = [
  p('Samba', 1, 1, 50, 'GK'),
  p('Gradit', 3, 2, 15), p('Danso', 5, 2, 40), p('Medina', 2, 2, 60), p('Frankowski', 22, 2, 85),
  p('Fulgini', 7, 3, 20), p('Machado', 8, 3, 45), p('Samed', 4, 3, 70),
  p('Said', 14, 4, 30), p('Thauvin', 11, 4, 70),
  p('Wahi', 9, 5, 50),
];

const lineup = (formation: string, starters: LiveMatchLineupPlayer[], bench: LiveMatchLineupPlayer[]): LiveMatchLineup => ({
  formation, starters, bench,
});

function stats(lineups?: LiveMatchStats['lineups']): LiveMatchStats {
  return {
    status: 'finished',
    competitionName: 'Ligue 1',
    home: { id: 465, name: 'Lyon', score: 2 },
    away: { id: 1, name: 'Lens', score: 1 },
    teamStats: { home: {}, away: {} },
    events: [],
    topPerformers: [],
    shots: [],
    lineups,
    updatedAt: '2026-10-11T20:00:00Z',
  } as unknown as LiveMatchStats;
}

const loaded = (opp: LiveMatchLineup = lineup('4-1-4-1', OPP_4141, BENCH_OPP)) => {
  hook = { isLoading: false, isError: false, data: stats({ home: lineup('4-2-3-1', OL_421, BENCH_OL), away: opp }) };
};

const setWidth = (w: number) => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: w });
  window.dispatchEvent(new Event('resize'));
};

const blocks = () => screen.getAllByTestId('bloc-composition');
const rows = (block: HTMLElement) => within(block).getAllByTestId('rangee-composition');
const chips = (row: HTMLElement) => Array.from(row.children) as HTMLElement[];
const sizes = (block: HTMLElement) => rows(block).map((r) => chips(r).length);
const names = (row: HTMLElement) => chips(row).map((c) => c.textContent ?? '');
const declared = (el: HTMLElement) =>
  `${el.className} ${el.getAttribute('style') ?? ''}`.replace(/\s+/g, ' ');
const widthSignature = (el: HTMLElement) =>
  `${el.style.flexBasis}|${el.style.width}|${el.style.flex}|${el.className}`;

beforeEach(() => {
  nextId = 1000;
  setWidth(1440);
});

describe('Page match — blocs Composition (L43)', () => {
  it('R1 — chargement : message, aucun bloc Composition', () => {
    hook = { isLoading: true, isError: false, data: undefined };
    render(<MatchPage />);
    expect(screen.getByTestId('message-chargement')).toHaveTextContent('Chargement du match…');
    expect(screen.queryAllByTestId('bloc-composition')).toHaveLength(0);
  });

  it('R2 — erreur : message, aucun bloc Composition', () => {
    hook = { isLoading: false, isError: true, data: undefined };
    render(<MatchPage />);
    expect(screen.getByTestId('message-erreur')).toHaveTextContent('Match introuvable');
    expect(screen.queryAllByTestId('bloc-composition')).toHaveLength(0);
  });

  it('R3 — vide : pas de bloc Composition sans lineup', () => {
    hook = { isLoading: false, isError: false, data: stats(undefined) };
    render(<MatchPage />);
    expect(screen.queryAllByTestId('bloc-composition')).toHaveLength(0);
    expect(screen.queryByTestId('liste-compositions')).toBeNull();
    expect(screen.getByTestId('bloc-statistiques')).toBeInTheDocument();
  });

  it('R4 — 4-2-3-1 à 390 et 1440 px : 5 lignes visibles, aucun joueur seul sur une ligne de trop', () => {
    for (const w of [390, 1440]) {
      setWidth(w);
      loaded();
      const { unmount } = render(<MatchPage />);
      const ol = blocks()[0];
      expect(rows(ol)).toHaveLength(5);
      expect(sizes(ol).filter((n) => n === 1)).toHaveLength(2); // buteur et gardien seulement
      unmount();
    }
  });

  it('R4 — 4-2-3-1 : 5 rangées de 1, 4, 2, 3, 1 joueurs (attaque en haut)', () => {
    loaded();
    render(<MatchPage />);
    const ol = blocks()[0];
    expect(within(ol).getByTestId('titre-composition')).toHaveTextContent('Composition · Lyon');
    expect(within(ol).getByTestId('formation-composition')).toHaveTextContent('4-2-3-1');
    const r = rows(ol);
    // de haut en bas : attaque (1), 3, 2, défense (4), gardien (1)
    expect(sizes(ol)).toEqual([1, 3, 2, 4, 1]);
    expect(names(r[0])).toEqual(['9Lacazette']);
    expect(names(r[1])).toEqual(['10Tolisso', '11Cherki', '7Fofana']); // tri yardLine puis yardSide, puis gauche → droite
    expect(names(r[2])).toEqual(['8Matic', '6Tessmann']);
    expect(names(r[3])).toEqual(['3Tagliafico', '4Niakhaté', '5Mata', '2Maitland-Niles']);
    expect(names(r[4])).toEqual(['1Lucas Perri']);
  });

  it('R4 — 4-1-4-1 : 5 rangées de 1, 4, 1, 4, 1 joueurs', () => {
    loaded();
    render(<MatchPage />);
    const opp = blocks()[1];
    expect(within(opp).getByTestId('titre-composition')).toHaveTextContent('Composition · Lens');
    expect(within(opp).getByTestId('formation-composition')).toHaveTextContent('4-1-4-1');
    expect(sizes(opp)).toEqual([1, 4, 1, 4, 1]);
    expect(names(rows(opp)[1])).toEqual(['11Thauvin', '10Sotoca', '7Fulgini', '14Said']);
  });

  it('R5 — formation absente : rangées par yardLine, note visible, pas de pastille', () => {
    loaded(lineup('', OPP_NOFORM, BENCH_OPP));
    render(<MatchPage />);
    const opp = blocks()[1];
    expect(sizes(opp)).toEqual([1, 2, 3, 4, 1]);
    expect(within(opp).queryByTestId('formation-composition')).toBeNull();
    expect(within(opp).getByTestId('note-repli')).toHaveTextContent(
      'Formation inconnue : rangées lues d’après les positions annoncées.',
    );
    // le bloc OL, à formation connue, n'a ni note
    expect(within(blocks()[0]).queryByTestId('note-repli')).toBeNull();
  });

  it('R6 — numéro adverse : contraste ≥ 4,5:1', () => {
    loaded();
    render(<MatchPage />);
    const opp = blocks()[1];
    const num = chips(rows(opp)[0])[0].firstElementChild as HTMLElement;
    expect(num).toHaveTextContent('9');
    expect(declared(num)).toMatch(/hsl\(\s*226[\s_,]+70%[\s_,]+70%\s*\)/);
  });

  it('R6 — 11 titulaires et banc inchangés', () => {
    loaded();
    render(<MatchPage />);
    const [ol, opp] = blocks();
    for (const b of [ol, opp]) {
      const total = rows(b).reduce((n, r) => n + chips(r).length, 0);
      expect(total).toBe(11);
    }
    const bancOl = within(ol).getByTestId('banc-composition');
    expect(bancOl).toHaveTextContent('Banc');
    for (const n of ['Descamps', 'Mikautadze', 'Nuamah', 'Morton']) expect(bancOl).toHaveTextContent(n);
    expect(within(opp).getByTestId('banc-composition')).toHaveTextContent('Abdul Samed');
  });

  it('R7 — rangée centrée : 4-2-3-1, les 11 pastilles ont la même largeur ±1 px ; centre de la pastille du buteur et du gardien = centre du bloc ±1 px', () => {
    loaded();
    render(<MatchPage />);
    const ol = blocks()[0];
    const all = rows(ol).flatMap(chips);
    expect(all).toHaveLength(11);
    for (const r of rows(ol)) {
      const d = declared(r);
      expect(d).toMatch(/\bflex\b|display:\s*flex/);
      expect(d).toMatch(/justify-center|justify-content:\s*center/);
      expect(d).toMatch(/\bgap-1\b|gap-\[4px\]|gap:\s*4px/);
    }
    const sig = new Set(all.map(widthSignature));
    expect(sig.size).toBe(1);
    // largeur de la rangée la plus fournie (4) : (100 % − 3·4 px) / 4, ni 100 % ni auto
    expect([...sig][0]).toMatch(/calc|basis-\[|w-\[/);
    expect([...sig][0]).not.toMatch(/flex-1\b|\bgrow\b/);
  });

  it('R7 — rangée centrée : 4-1-4-1, rangées de 1, 4, 1, 4, 1 centrées, pastilles de largeur égale', () => {
    loaded();
    render(<MatchPage />);
    const opp = blocks()[1];
    expect(sizes(opp)).toEqual([1, 4, 1, 4, 1]);
    for (const r of rows(opp)) {
      expect(declared(r)).toMatch(/justify-center|justify-content:\s*center/);
    }
    const all = rows(opp).flatMap(chips);
    expect(new Set(all.map(widthSignature)).size).toBe(1);
    // la largeur est la même d'un bloc à l'autre (Nmax = 4 dans les deux formations)
    const olAll = rows(blocks()[0]).flatMap(chips);
    expect(widthSignature(olAll[0])).toBe(widthSignature(all[0]));
  });

  it('R8 — 320, 390 et 1440 px : aucun nom coupé ailleurs qu\'après un tiret (ni ellipse, ni débordement de la pastille)', () => {
    for (const w of [320, 390, 1440]) {
      setWidth(w);
      loaded();
      const { unmount } = render(<MatchPage />);
      for (const b of blocks()) {
        for (const chip of rows(b).flatMap(chips)) {
          const nameEl = chip.lastElementChild as HTMLElement;
          const d = declared(nameEl) + ' ' + declared(chip);
          expect(d).not.toMatch(/truncate|line-clamp|text-ellipsis|text-clip|break-all|break-words|overflow-wrap:\s*(anywhere|break-word)|word-break:\s*break/);
          expect(nameEl.textContent).not.toMatch(/…|\.\.\./);
          expect(nameEl.textContent).not.toMatch(/­/); // pas de césure douce insérée
        }
      }
      const mn = screen.getByText('Maitland-Niles');
      expect(mn.textContent).toBe('Maitland-Niles'); // un seul élément, le tiret est la seule coupure possible
      expect(screen.getByText('Frankowski').textContent).toBe('Frankowski');
      unmount();
    }
  });

  it('R8 — pastille : le numéro est au-dessus du nom (même axe vertical, numéro plus haut)', () => {
    loaded();
    render(<MatchPage />);
    for (const b of blocks()) {
      for (const chip of rows(b).flatMap(chips)) {
        const kids = Array.from(chip.children) as HTMLElement[];
        expect(kids).toHaveLength(2);
        expect(kids[0].textContent).toMatch(/^\d+$/); // numéro d'abord
        expect(kids[1].textContent).toMatch(/\D/); // nom ensuite
        const d = declared(chip);
        expect(d).toMatch(/flex-col|flex-direction:\s*column/);
        expect(d).toMatch(/items-center|align-items:\s*center/);
        expect(d).toMatch(/text-center|text-align:\s*center/);
      }
    }
  });

  it('R8 — nom sans tiret trop long : 10 px, jamais coupé en milieu de mot', () => {
    const long = [...OPP_4141];
    long[4] = p('Papastathopoulos', 22, 2, 85);
    loaded(lineup('4-1-4-1', long, BENCH_OPP));
    render(<MatchPage />);
    const el = screen.getByText('Papastathopoulos');
    expect(el.textContent).toBe('Papastathopoulos');
    const d = declared(el) + ' ' + declared(el.parentElement as HTMLElement);
    expect(d).not.toMatch(/truncate|line-clamp|text-ellipsis|break-all|break-words|overflow-wrap:\s*(anywhere|break-word)/);
    // le nom déclare une taille réduite à 10 px (ou le bloc le fait pour ses noms les plus longs)
    expect(d).toMatch(/text-\[10px\]|font-size:\s*10px/);
    // un nom court garde 11 px
    const short = declared(screen.getByText('Samba'));
    expect(short + ' ' + declared(screen.getByText('Samba').parentElement as HTMLElement)).toMatch(/text-\[11px\]|font-size:\s*11px/);
  });

  it('R8 — mesure : chaque nom prend la plus grande taille qui tient dans la pastille (7 noms de la QA 12-10)', () => {
    const noms = ['Frankowski', 'Omobamidele', 'Augustinsson', 'Coosemans', 'Thomasson', 'Greenwood', 'Guendouzi'];
    const opp = [...OPP_4141];
    noms.forEach((n, k) => { opp[k + 1] = p(n, 30 + k, 2, 40 + k); });
    const CLIENT = 58;
    const wide = (el: HTMLElement) => (parseFloat(el.style.fontSize) || 11) * el.textContent!.length * 0.55;
    const sw = vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockImplementation(function (this: HTMLElement) {
      return Math.max(wide(this), CLIENT);
    });
    const cw = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(CLIENT);
    try {
      loaded(lineup('4-1-4-1', opp, BENCH_OPP));
      render(<MatchPage />);
      for (const n of noms) {
        const el = screen.getByText(n);
        const size = parseFloat(el.style.fontSize);
        expect(wide(el), n).toBeLessThanOrEqual(CLIENT); // tient
        if (size < 11) expect(n.length * (size + 1) * 0.55, n).toBeGreaterThan(CLIENT); // et pas plus petit que nécessaire
      }
      expect(screen.getByText('Samba').style.fontSize).toBe('11px');
    } finally {
      sw.mockRestore();
      cw.mockRestore();
    }
  });
});
