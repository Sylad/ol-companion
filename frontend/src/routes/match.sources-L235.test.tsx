import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import type { LiveMatchStats } from '@/types/api';

// L235 — la page d'un match dit d'où viennent ses données, avec lien et attribution.

let courant: LiveMatchStats;

vi.mock('@tanstack/react-router', () => ({
  useParams: () => ({ gameId: '4672325' }),
  useSearch: () => ({ matchupId: '523-3250-4672325' }),
  Link: ({ children }: { children: React.ReactNode }) => <a href="/">{children}</a>,
}));
vi.mock('@/hooks/use-match-event-burst', () => ({ useMatchEventBurst: () => null }));
vi.mock('@/components/match-event-burst', () => ({ MatchEventBurst: () => null }));
vi.mock('@/hooks/use-live-match', () => ({ useLiveMatchStats: () => ({ isLoading: false, isError: false, data: courant }) }));

import { MatchPage } from './match';

(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };

function stats(over: Partial<LiveMatchStats>): LiveMatchStats {
  return {
    gameId: 4672325, matchupId: '523-3250-4672325', competitionId: 35, competitionName: 'Ligue 1', status: 'ended',
    statusGroup: 4, statusText: 'Terminé', gameTime: 90, gameTimeDisplay: "90'", startTime: '2026-10-05T20:45:00+02:00',
    home: { id: 523, name: 'Lyon', symbolicName: 'OL', imageVersion: 1, score: 2 },
    away: { id: 3250, name: 'Nice', symbolicName: 'NIC', imageVersion: 1, score: 1 },
    teamStats: { home: {}, away: {} }, events: [], topPerformers: [], shots: [], updatedAt: '2026-10-05T23:00:00Z',
    ...over,
  } as unknown as LiveMatchStats;
}

afterEach(cleanup);

describe('L235 — source des données de la page match', () => {
  it('R1 — un match terminé nomme 365scores, avec un lien externe sûr, et ne cite pas football-data.org', () => {
    courant = stats({});
    render(<MatchPage />);
    const note = screen.getByTestId('sources-match');
    const lien = within(note).getByRole('link', { name: /365scores/ });
    expect(lien.getAttribute('href')).toBe('https://www.365scores.com/fr/football/league/ligue-1-35');
    expect(lien.getAttribute('target')).toBe('_blank');
    expect(lien.getAttribute('rel')).toBe('noopener noreferrer');
    expect(note.textContent).not.toMatch(/football-data/i);
  });

  it('R2 — un match de Ligue 1 à venir nomme aussi football-data.org (heure du coup d\'envoi), avec lien', () => {
    courant = stats({ status: 'upcoming', statusGroup: 2 });
    render(<MatchPage />);
    const note = screen.getByTestId('sources-match');
    const lien = within(note).getByRole('link', { name: /football-data\.org/ });
    expect(lien.getAttribute('href')).toBe('https://www.football-data.org/');
    expect(lien.getAttribute('rel')).toBe('noopener noreferrer');
    expect(within(note).getByRole('link', { name: /365scores/ })).toBeTruthy();
  });

  it('R3 — un match à venir hors Ligue 1 ne cite pas football-data.org (il ne décide pas de son heure)', () => {
    courant = stats({ status: 'upcoming', statusGroup: 2, competitionId: 573, competitionName: 'Ligue Europa' });
    render(<MatchPage />);
    expect(screen.getByTestId('sources-match').textContent).not.toMatch(/football-data/i);
  });

  it('R4 — la note est discrète : après la grille du match, texte secondaire, hors du flux des blocs de données', () => {
    courant = stats({});
    render(<MatchPage />);
    const note = screen.getByTestId('sources-match');
    const grille = screen.getByTestId('grille-match');
    expect(grille.compareDocumentPosition(note) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(grille.contains(note)).toBe(false);
    expect(note.className).toContain('text-fg-dim');
  });
});
