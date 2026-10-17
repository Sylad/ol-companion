import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { LiveMatchStats } from '@/types/api';

// L172 — R3 de docs/specs/page-match-fm/fiche.yaml (amendée) : l’en-tête d’un match de l’OL à venir (hors Bleus) dit
// la date et l’heure, ou « Horaire à confirmer » quand la réponse stats porte timeConfirmed: false.

let data: LiveMatchStats;
vi.mock('@tanstack/react-router', () => ({
  useParams: () => ({ gameId: '4672325' }),
  useSearch: () => ({ matchupId: '523-1234-4672325' }),
  Link: ({ children, to, ...rest }: { children: React.ReactNode; to: string }) => <a href={to} {...(rest as object)}>{children}</a>,
}));
vi.mock('@/hooks/use-match-event-burst', () => ({ useMatchEventBurst: () => null }));
vi.mock('@/hooks/use-live-match', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/hooks/use-live-match')>()),
  useLiveMatchStats: () => ({ isLoading: false, isError: false, data }),
}));
vi.mock('@/components/match-event-burst', () => ({ MatchEventBurst: () => null }));

import { MatchPage } from './match';

(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };

const aVenir = (timeConfirmed?: boolean): LiveMatchStats => ({
  gameId: 4672325, matchupId: '523-1234-4672325', competitionId: 573, competitionName: 'Ligue Europa',
  status: 'upcoming', statusGroup: 1, statusText: 'Programmé', gameTime: 0, gameTimeDisplay: '',
  startTime: '2026-11-12T20:00:00Z', ...(timeConfirmed === undefined ? {} : { timeConfirmed }),
  home: { id: 465, name: 'Lyon', symbolicName: 'LYO', imageVersion: 1, score: null },
  away: { id: 1234, name: 'Lillestrom', symbolicName: 'LIL', imageVersion: 1, score: null },
  teamStats: { home: {}, away: {} }, events: [], topPerformers: [], shots: [], updatedAt: '2026-10-17T12:00:00Z',
} as unknown as LiveMatchStats);

beforeEach(() => {
  process.env.TZ = 'Europe/Paris';
});

describe('R3 — match de l’OL à venir : date et heure ou « Horaire à confirmer » (L172)', () => {
  it('R3 — timeConfirmed faux : « Jeu. 12/11 · Horaire à confirmer », jamais l’heure de remplissage', async () => {
    data = aVenir(false);
    render(<MatchPage />);
    const date = await screen.findByTestId('coup-envoi');
    expect(date.textContent).toBe('Jeu. 12/11 · Horaire à confirmer');
    expect(date.textContent).not.toMatch(/\d{2}h\d{2}/);
  });

  it('R3 — timeConfirmed vrai : l’heure est affichée (« Jeu. 12/11 · 21h00 »)', async () => {
    data = aVenir(true);
    render(<MatchPage />);
    expect((await screen.findByTestId('coup-envoi')).textContent).toBe('Jeu. 12/11 · 21h00');
  });

  it('R3 — champ absent (backend antérieur) : l’heure est affichée', async () => {
    data = aVenir();
    render(<MatchPage />);
    expect((await screen.findByTestId('coup-envoi')).textContent).toBe('Jeu. 12/11 · 21h00');
  });
});
