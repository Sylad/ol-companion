import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import type { LiveMatchStats } from '@/types/api';

// L167, 2e passe de revue : R12 (la page d'un match de l'OL reste inchangée, verbatim) et R13 (« Bosnie-Herzégovine »
// sur deux lignes à 390 px). Fichier à part : les trois tests d'acceptation scellés ne sont jamais modifiés.
// `cn` passe par tailwind-merge : une classe de taille posée APRÈS `leading-none` l'écrase (R12) — le test regarde la
// classe calculée, pas la constante.

let hook: { isLoading: boolean; isError: boolean; data: LiveMatchStats | undefined };
let search = { matchupId: '465-1-10' };

vi.mock('@tanstack/react-router', () => ({
  useParams: () => ({ gameId: '10' }),
  useSearch: () => search,
  Link: ({ children }: { children: React.ReactNode }) => <a href="/">{children}</a>,
}));
vi.mock('@/hooks/use-match-event-burst', () => ({ useMatchEventBurst: () => null }));
vi.mock('@/hooks/use-live-match', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks/use-live-match')>();
  return { ...actual, useLiveMatchStats: () => hook };
});
vi.mock('@/components/shot-map', () => ({ ShotMap: () => null }));
vi.mock('@/components/momentum-chart', () => ({ MomentumChart: () => null }));
vi.mock('@/components/lineup-card', () => ({ LineupCard: () => null }));
vi.mock('@/components/mini-standings', () => ({ MiniStandings: () => null }));
vi.mock('@/components/match-event-burst', () => ({ MatchEventBurst: () => null }));

import { MatchPage } from './match';

(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };

function show(homeId: number, awayId: number, homeName: string, awayName: string, status: string = 'ended') {
  search = { matchupId: `${homeId}-${awayId}-10` };
  hook = {
    isLoading: false,
    isError: false,
    data: {
      gameId: 10, matchupId: search.matchupId, competitionId: 1, competitionName: 'Ligue 1', status, statusGroup: 4,
      statusText: 'Terminé', gameTime: 90, gameTimeDisplay: "90'", startTime: '2026-11-12T20:00:00Z',
      home: { id: homeId, name: homeName, symbolicName: 'H', imageVersion: 1, score: 4 },
      away: { id: awayId, name: awayName, symbolicName: 'A', imageVersion: 1, score: 1 },
      teamStats: { home: {}, away: {} }, events: [], topPerformers: [], shots: [], momentum: [], updatedAt: '2026-11-12T22:00:00Z',
    } as unknown as LiveMatchStats,
  };
  return render(<MatchPage />);
}

/** Les deux éléments « nom d'équipe » de l'en-tête (police d'affichage, gras). */
const noms = (root: HTMLElement, ...names: string[]) =>
  names.map((n) => Array.from(root.querySelectorAll('div.font-display.font-bold')).find((e) => e.textContent === n)!);

beforeEach(() => { document.body.className = ''; document.body.innerHTML = ''; });

describe('R12 — l’interligne des noms d’équipe survit à tailwind-merge', () => {
  it('match de l’OL : text-2xl ET leading-none dans la classe calculée des deux noms', () => {
    const { container } = show(465, 1, 'Lyon', 'Paris FC');
    for (const el of noms(container, 'Lyon', 'Paris FC')) {
      expect(el).toBeDefined();
      expect(el.classList.contains('text-2xl')).toBe(true);
      expect(el.classList.contains('leading-none')).toBe(true);
    }
  });

  it('match des Bleus : les trois tailles responsives ET leading-none dans la classe calculée des deux noms', () => {
    const { container } = show(5061, 2373, 'France', 'Bosnie-Herzégovine');
    for (const el of noms(container, 'France', 'Bosnie-Herzégovine')) {
      expect(el).toBeDefined();
      expect(el.classList.contains('text-base')).toBe(true);
      expect(el.classList.contains('min-[390px]:text-lg')).toBe(true);
      expect(el.classList.contains('min-[600px]:text-2xl')).toBe(true);
      expect(el.classList.contains('leading-none')).toBe(true);
      // `text-lg` / `text-2xl` posent leur interligne dans leur media query : il faut un `leading-none` par palier
      expect(el.classList.contains('min-[390px]:leading-none')).toBe(true);
      expect(el.classList.contains('min-[600px]:leading-none')).toBe(true);
    }
  });
});

describe('R13 — séparateur du score : 4 px par côté sous 600 px, Bleus seulement', () => {
  const sep = (root: HTMLElement) => Array.from(root.querySelectorAll('span')).find((s) => s.textContent === '·')!;

  it('Bleus : mx-1 (4 px) puis mx-2 (8 px) à partir de 600 px', () => {
    const { container } = show(5061, 2373, 'France', 'Belgique');
    const s = sep(container);
    expect(s.classList.contains('mx-1')).toBe(true);
    expect(s.classList.contains('min-[600px]:mx-2')).toBe(true);
    expect(s.classList.contains('mx-2')).toBe(false);
  });

  it('OL : inchangé, mx-2 sans variante', () => {
    const { container } = show(465, 1, 'Lyon', 'Paris FC');
    const s = sep(container);
    expect(s.classList.contains('mx-2')).toBe(true);
    expect(s.classList.contains('mx-1')).toBe(false);
    expect(s.className).not.toMatch(/min-\[600px\]/);
  });
});
