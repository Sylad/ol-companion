import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { LiveMatchStats } from '@/types/api';

// L168 — R7/R11 de docs/specs/page-match-equipe-de-france/fiche.yaml (amendées) : l'en-tête d'un match des
// Bleus à venir dit « Horaire à confirmer » quand la réponse stats porte timeConfirmed: false.

let data: LiveMatchStats;
vi.mock('@tanstack/react-router', () => ({
  useParams: () => ({ gameId: '4672325' }),
  useSearch: () => ({ matchupId: '5061-2373-4672325' }),
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
  gameId: 4672325, matchupId: '5061-2373-4672325', competitionId: 7016, competitionName: 'Qualifications Coupe du monde',
  status: 'upcoming', statusGroup: 1, statusText: 'Programmé', gameTime: 0, gameTimeDisplay: '',
  startTime: '2026-11-12T20:00:00Z', ...(timeConfirmed === undefined ? {} : { timeConfirmed }),
  home: { id: 5061, name: 'France', symbolicName: 'FRA', imageVersion: 1, score: null },
  away: { id: 2373, name: 'Belgique', symbolicName: 'BEL', imageVersion: 1, score: null },
  teamStats: { home: {}, away: {} }, events: [], topPerformers: [], shots: [], updatedAt: '2026-10-17T12:00:00Z',
} as unknown as LiveMatchStats);

beforeEach(() => {
  process.env.TZ = 'Europe/Paris';
});

describe('R11 — match des Bleus à venir, heure non fixée (L168)', () => {
  it('R11 — timeConfirmed faux : « Jeu. 12/11 · Horaire à confirmer », jamais l’heure de remplissage', async () => {
    data = aVenir(false);
    render(<MatchPage />);
    const date = await screen.findByTestId('coup-envoi');
    expect(date.textContent).toBe('Jeu. 12/11 · Horaire à confirmer');
    expect(date.textContent).not.toMatch(/\d{2}h\d{2}/);
  });

  it('R11 — timeConfirmed vrai : l’heure est affichée (« Jeu. 12/11 · 21h00 »)', async () => {
    data = aVenir(true);
    render(<MatchPage />);
    expect((await screen.findByTestId('coup-envoi')).textContent).toBe('Jeu. 12/11 · 21h00');
  });

  it('R7 — champ absent (backend antérieur) : l’heure est affichée', async () => {
    data = aVenir();
    render(<MatchPage />);
    expect((await screen.findByTestId('coup-envoi')).textContent).toBe('Jeu. 12/11 · 21h00');
  });
});
