import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { LiveMatchStats } from '@/types/api';

// L167 — complément d'acceptation (docs/specs/page-match-equipe-de-france/fiche.yaml) : R4 (couleurs) et R13 (noms
// d'équipe de l'en-tête). R1 côté back (horloge simulée) vit dans la suite Jest du backend
// (backend/src/modules/france/france.service.acceptation-L167.spec.ts) : le build Docker du frontend n'a pas backend/ à côté. Pas de navigateur dans ce dépôt (ni Playwright) : R4 et R13 sont
// vérifiées sur le DOM rendu (jsdom) et sur index.css, sans mesure de mise en page.

type HookResult = { isLoading: boolean; isError: boolean; data: LiveMatchStats | undefined };
let hook: HookResult;
let search = { matchupId: '5061-2373-4672325' };

vi.mock('@tanstack/react-router', () => ({
  useParams: () => ({ gameId: '4672325' }),
  useSearch: () => search,
  Link: ({ children, to, ...rest }: { children: React.ReactNode; to: string }) => <a href={to} {...(rest as object)}>{children}</a>,
}));
vi.mock('@/hooks/use-match-event-burst', () => ({ useMatchEventBurst: () => null }));
vi.mock('@/hooks/use-live-match', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks/use-live-match')>();
  return { ...actual, useLiveMatchStats: () => hook };
});
vi.mock('@/components/match-event-burst', () => ({ MatchEventBurst: () => null }));

import { MatchPage } from './match';

(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };

/* ------------------------------------------------------------------ R4 / R13 — page */

const css = readFileSync(path.resolve(__dirname, '../index.css'), 'utf8');
const BLEU = /hsl\(\s*224[\s,_]+80%[\s,_]+58%/;
const BLANC = /hsl\(\s*0[\s,_]+0%[\s,_]+96%/;

const p = (id: number, name: string, line: number, side: number) => ({ id, name, shortName: name, jerseyNumber: id % 30, positionShort: 'CM', yardLine: line, yardSide: side, ranking: null });
const lineup = (b: number) => ({
  formation: '4-3-3',
  starters: [p(b + 1, 'G', 1, 50), p(b + 2, 'D1', 2, 20), p(b + 3, 'D2', 2, 40), p(b + 4, 'D3', 2, 60), p(b + 5, 'D4', 2, 80), p(b + 6, 'M1', 3, 25), p(b + 7, 'M2', 3, 50), p(b + 8, 'M3', 3, 75), p(b + 9, 'A1', 4, 20), p(b + 10, 'A2', 4, 50), p(b + 11, 'A3', 4, 80)],
  bench: [p(b + 12, 'Remp', 0, 0)],
});
function data(homeId: number, awayId: number, homeName: string, awayName: string, extra: Record<string, unknown> = {}): LiveMatchStats {
  return {
    gameId: 4672325, matchupId: `${homeId}-${awayId}-4672325`, competitionId: 7016, competitionName: 'Qualifications', status: 'ended', statusGroup: 4,
    statusText: 'Terminé', gameTime: 90, gameTimeDisplay: "90'", startTime: '2026-11-12T20:00:00Z',
    home: { id: homeId, name: homeName, symbolicName: 'H', imageVersion: 1, score: 4 },
    away: { id: awayId, name: awayName, symbolicName: 'A', imageVersion: 1, score: 1 },
    teamStats: { home: { Touches: 600, 'Tirs au total': 14 }, away: { Touches: 400, 'Tirs au total': 8 } },
    events: [{ competitorId: homeId, gameTime: 35, gameTimeDisplay: "35'", type: 'goal', isMajor: true, playerId: 1, extraPlayerId: null, playerName: 'Lukébakio', playerShortName: null, extraPlayerName: null, description: 'But' }],
    topPerformers: [],
    shots: [{ competitorId: homeId, playerId: 1, time: "12'", xg: 0.3, xgot: 0.2, bodyPart: 'Pied', outcome: 'Goal', line: 90, side: 50 }, { competitorId: awayId, playerId: 2, time: "20'", xg: 0.1, xgot: 0.1, bodyPart: 'Pied', outcome: 'Saved', line: 80, side: 40 }],
    momentum: [{ minute: 1, value: 20 }, { minute: 2, value: -30 }, { minute: 3, value: 10 }],
    lineups: { home: lineup(100), away: lineup(200) },
    updatedAt: '2026-11-12T22:00:00Z',
    ...extra,
  } as unknown as LiveMatchStats;
}
const show = (d: LiveMatchStats) => {
  search = { matchupId: d.matchupId };
  hook = { isLoading: false, isError: false, data: d };
  return render(<MatchPage />);
};
const norm = (el: Element) => el.outerHTML.replace(/_/g, ' ');
const BLOCS = ['bloc-statistiques', 'elan', 'carte-tirs', 'bloc-composition'];

beforeEach(() => { document.body.className = ''; });

describe('R4 — une couleur par équipe sur la page des Bleus', () => {
  it('R4 — la France (domicile ou extérieur) est en bleu, l’adversaire en blanc dans les barres, le Momentum et les tirs', async () => {
    for (const [france, side] of [[true, 'domicile'], [false, 'extérieur']] as const) {
      document.body.innerHTML = '';
      show(france ? data(5061, 2373, 'France', 'Belgique') : data(2373, 5061, 'Belgique', 'France'));
      for (const id of ['bloc-statistiques', 'elan', 'carte-tirs']) {
        const html = norm(await screen.findByTestId(id));
        const iBleu = html.search(BLEU);
        const iBlanc = html.search(BLANC);
        // R4 — « la France est bleue hsl(224 80% 58%) …, l’adversaire est blanc hsl(0 0% 96%) »
        expect([id, side, iBleu >= 0, iBlanc >= 0]).toEqual([id, side, true, true]);
        // R4 — « quel que soit le côté (domicile à gauche comme avant) » : la couleur de la France suit son côté, le domicile reste à gauche
        if (id === 'bloc-statistiques') expect(iBleu < iBlanc).toBe(france);
      }
    }
  });

  it('R4 — contraste du bleu et du blanc sur --surface ≥ 3:1 calculé', async () => {
    const lum = (h: number, s: number, l: number) => {
      s /= 100; l /= 100;
      const k = (n: number) => (n + h / 30) % 12;
      const a = s * Math.min(l, 1 - l);
      const ch = (n: number) => { const c = l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))); return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
      return 0.2126 * ch(0) + 0.7152 * ch(8) + 0.0722 * ch(4);
    };
    const ratio = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    const m = css.match(/--surface:\s*(\d+)\s+(\d+)%\s+(\d+)%/)!;
    const surface = lum(+m[1], +m[2], +m[3]);
    show(data(5061, 2373, 'France', 'Belgique'));
    const html = norm(await screen.findByTestId('elan')) + norm(await screen.findByTestId('carte-tirs'));
    const bleu = html.match(/hsl\(\s*(224)[\s,]+(80)%[\s,]+(58)%/);
    const blanc = html.match(/hsl\(\s*(0)[\s,]+(0)%[\s,]+(96)%/);
    // R4 — « (4,04:1 sur --surface …, ≥ 3:1 WCAG 1.4.11) » : les teintes réellement posées sur le Momentum et les tirs
    expect(bleu).not.toBeNull();
    expect(blanc).not.toBeNull();
    expect(ratio(lum(224, 80, 58), surface)).toBeGreaterThanOrEqual(3);
    // R4 — « l’adversaire est blanc hsl(0 0% 96%) (17,15:1) »
    expect(ratio(lum(0, 0, 96), surface)).toBeGreaterThanOrEqual(3);
  });

  it('R4 — aucune teinte verte ni rouge OL d’équipe', async () => {
    show(data(5061, 2373, 'France', 'Belgique'));
    await screen.findByTestId('elan');
    // R4 — « Le bleu et le rouge OL ne sont plus utilisés pour une équipe sur cette page ; jamais de vert. »
    // R4 et R5 gardent le rouge comme accent (anneau de focus, bordure néon, bordure du curseur) : ces jetons ne colorent pas une équipe
    const sansAccents = (html: string) => html.replace(/\S*(?:focus(?:-visible|-within)?:|ring-|outline-|border(?:-[trblxy])?-)\S*ol-(?:blue|red)\S*/g, '');
    for (const id of BLOCS) {
      const html = (await screen.findAllByTestId(id)).map(norm).join(' ');
      expect([id, /ol-blue|ol-red/.test(sansAccents(html))]).toEqual([id, false]);
      // vert = teintes 90 à 165 ; le cyan et le turquoise (166 à 199) ne sont pas du vert
      expect([id, /green|emerald|lime|hsl\(\s*(?:9\d|1[0-5]\d|16[0-5])\b/.test(html)]).toEqual([id, false]);
    }
    // et la France y est bien en bleu (témoin : sans lui, l'absence ci-dessus ne prouve rien)
    expect(norm(await screen.findByTestId('elan'))).toMatch(BLEU);
  });
});

describe('R13 — noms d’équipe de l’en-tête', () => {
  const entete = async (nom: string) => {
    show(data(5061, 2373, 'France', nom));
    return screen.findByTestId('entete-score');
  };

  it('R13 — à 390 px, « Bosnie-Herzégovine » est entièrement lisible dans l’en-tête (deux lignes, aucun caractère perdu)', async () => {
    const el = await entete('Bosnie-Herzégovine');
    const nom = Array.from(el.querySelectorAll('*')).find((n) => n.children.length === 0 && n.textContent === 'Bosnie-Herzégovine')!;
    // R13 — « Les noms d’équipe de l’en-tête ne sont jamais coupés ni cachés » : tous les caractères sont dans le DOM
    expect(nom).toBeDefined();
    const html = norm(nom);
    // R13 — « les noms passent à la ligne par overflow-wrap:anywhere » (classe, style en ligne ou règle de index.css)
    expect(/overflow-wrap:\s*anywhere|break-anywhere|\[overflow-wrap:anywhere\]/.test(html) || /overflow-wrap:\s*anywhere/.test(css)).toBe(true);
    // R13 — « jamais coupés ni cachés » : ni points de suspension ni masquage du débordement
    expect(html).not.toMatch(/truncate|text-ellipsis|overflow-hidden/);
    // R13 — « la grille est minmax(0,1fr) auto minmax(0,1fr) »
    expect(norm(el).replace(/\s/g, '').replace(/_/g, '')).toMatch(/minmax\(0,1fr\)auto minmax\(0,1fr\)|minmax\(0,1fr\)autominmax\(0,1fr\)/);
  });

  it('R13 — à 320 px, barre de défilement classique de 15 px présente (reflow 1280 px à 400 %), « Belgique » n’est pas coupée au milieu du mot et aucun caractère n’est perdu ; « Lukébakio 35\' » n’est pas coupé ; aucun dépassement horizontal de la page', async () => {
    const el = await entete('Belgique');
    // R13 — « aucun caractère n’est perdu » : le nom complet et le buteur sont dans l'en-tête
    expect(el.textContent).toContain('Belgique');
    expect(el.textContent).toContain('Lukébakio');
    expect(el.textContent).toContain("35'");
    // R13 — « les noms … sont à 24 px au-dessus de 600 px, 18 px sous 600 px, 16 px sous 390 px »
    const html = norm(el);
    expect(html).toMatch(/24px|text-2xl/);
    expect(`${html}\n${css}`).toMatch(/18px|text-lg/);
    expect(`${html}\n${css}`).toMatch(/16px|text-base/);
    // R13 — « sous 360 px la marge latérale de l’en-tête passe à 6 px, l’écart à 4 px et le score à 32 px »
    expect(`${html}\n${css}`).toMatch(/max-width:\s*359(\.98)?px|max-\[359px\]|max-\[360px\]|\(max-width:\s*360px\)/);
    expect(`${html}\n${css}`).toMatch(/32px/);
  });
});
