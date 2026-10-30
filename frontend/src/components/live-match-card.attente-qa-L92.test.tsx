import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { LiveMatchSummary } from '@/types/api';

// L92 — la ligne `never` de la section `*` de docs/qa/expectations.md exclut la pastille LIVE
// de la carte du direct : son svg pulse tant que le match est en cours.

let summary: LiveMatchSummary;

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => <a href={to}>{children}</a>,
}));
vi.mock('@/hooks/use-live-match', () => ({
  useCurrentLiveMatch: () => ({ isLoading: false, data: summary }),
  useLiveMatchStats: () => ({ data: undefined }),
}));

import { LiveMatchCard } from './live-match-card';

const make = (status: 'live' | 'upcoming' | 'finished'): LiveMatchSummary => ({
  gameId: 1, matchupId: '523-1234-1', competitionId: 35, competitionName: 'France, Ligue 1', status, statusGroup: 3,
  statusText: 'Deuxième mi-temps', gameTime: 60, gameTimeDisplay: "60'", startTime: '2026-10-17T19:00:00Z',
  home: { id: 465, name: 'Lyon', symbolicName: 'OL', imageVersion: 1, score: 1 },
  away: { id: 1234, name: 'Lens', symbolicName: 'RCL', imageVersion: 1, score: 0 },
} as unknown as LiveMatchSummary);

const attentes = readFileSync(resolve(__dirname, '../../../docs/qa/expectations.md'), 'utf8');
const ligneNever = attentes
  .split('\n')
  .find((l) => l.startsWith('- never:') && l.includes('.animate-pulse')) ?? '';

describe('Attente QA * — pastille LIVE (L92)', () => {
  it('R1 — la ligne never nomme la pastille LIVE (svg.animate-pulse de la carte du direct) comme exclue', () => {
    expect(ligneNever).toContain('svg.animate-pulse');
    expect(ligneNever).toContain('pastille LIVE');
    expect(ligneNever).toMatch(/hors (de )?la pastille LIVE|sauf la pastille LIVE/);
  });

  it('R2 — en direct, la pastille « Live » est un svg.animate-pulse : le sélecteur nommé existe', () => {
    summary = make('live');
    const { container } = render(<LiveMatchCard />);
    const pastille = container.querySelector('svg.animate-pulse');
    expect(pastille).not.toBeNull();
    expect(pastille?.parentElement?.textContent?.trim()).toBe('Live');
  });

  it('R3 — hors direct, aucun .animate-pulse sur la carte : l’exclusion ne couvre que le match en cours', () => {
    summary = make('finished');
    const { container } = render(<LiveMatchCard />);
    expect(container.querySelector('.animate-pulse')).toBeNull();
  });
});
