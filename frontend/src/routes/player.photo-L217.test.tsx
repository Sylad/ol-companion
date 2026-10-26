import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { PlayerSeasonStats } from '@/types/api';

// L217 — fiche joueur : la photo 365scores en 404 (Angel García, athlete 266757) laisse place aux initiales, jamais à un cadre vide.

vi.mock('@tanstack/react-router', () => ({
  useParams: () => ({ athleteId: '266757' }),
  useSearch: () => ({}),
  Link: ({ children }: { children: React.ReactNode }) => <a href="/">{children}</a>,
}));
vi.mock('recharts', () => {
  const Null = () => null;
  return { LineChart: Null, Line: Null, XAxis: Null, YAxis: Null, CartesianGrid: Null, Tooltip: Null, ResponsiveContainer: Null };
});

import { PlayerDetailPage } from './player.$athleteId';

const joueur = (imageVersion: number | null, shortName = 'Angel García'): PlayerSeasonStats => ({
  athleteId: 266757, memberId: 1, name: 'Angel García', shortName, jerseyNumber: 14,
  position: 'Milieu', positionShort: 'MID', imageVersion, matchesPlayed: 1, matchesStarted: 0,
  minutesPlayed: 12, goals: 0, assists: 0, goalContributions: 0, shots: 0, shotsOnTarget: 0,
  shotAccuracy: 0, yellowCards: 0, redCards: 0, averageRating: null, byMatch: [],
} as unknown as PlayerSeasonStats);

function monter(imageVersion: number | null, shortName?: string) {
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true, status: 200, json: async () => joueur(imageVersion, shortName) })));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <PlayerDetailPage />
    </QueryClientProvider>,
  );
}

describe('<PlayerDetailPage /> — photo indisponible (L217)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('R1 — l’image en erreur est retirée et les initiales du nom prennent sa place', async () => {
    const { container } = monter(7);
    fireEvent.error(await screen.findByRole('img', { name: 'Angel García' }));
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText('AG')).toBeTruthy();
  });

  it('R2 — tant que la photo charge, l’<img> est affichée sans initiales', async () => {
    const { container } = monter(7);
    await screen.findByRole('img', { name: 'Angel García' });
    expect(container.querySelector('img')).not.toBeNull();
    expect(screen.queryByText('AG')).toBeNull();
  });

  it('L218 R1 — les initiales viennent du nom complet, pas de shortName (« García » seul donnait « G »)', async () => {
    monter(7, 'García');
    fireEvent.error(await screen.findByRole('img', { name: 'Angel García' }));
    expect(screen.getByText('AG')).toBeTruthy();
    expect(screen.queryByText('G')).toBeNull();
  });
});
