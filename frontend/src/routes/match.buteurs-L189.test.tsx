import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { LiveMatchStats } from '@/types/api';

// L189 — buteurs de l'en-tête compactés pour que la rangée Statistiques | Momentum tienne au-dessus du pli à 1366 × 768
// avec 4 buteurs d'un côté (France 4-1 Belgique). jsdom ne mesure rien : la hauteur est mesurée dans Chromium (voir le
// rapport) ; ici, ce que le DOM déclare — une liste qui passe à la ligne par joueur entier, les minutes groupées par joueur.

vi.mock('@tanstack/react-router', () => ({
  useParams: () => ({ gameId: '4672325' }),
  useSearch: () => ({ matchupId: '5061-2373-4672325' }),
  Link: ({ children }: { children: React.ReactNode }) => <a href="/">{children}</a>,
}));
vi.mock('@/hooks/use-match-event-burst', () => ({ useMatchEventBurst: () => null }));
vi.mock('@/components/match-event-burst', () => ({ MatchEventBurst: () => null }));
vi.mock('@/hooks/use-live-match', () => ({ useLiveMatchStats: () => ({ isLoading: false, isError: false, data: stats() }) }));

import { MatchPage } from './match';

(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };

const goal = (competitorId: number, name: string, min: number, type = 'goal') => ({
  competitorId, gameTime: min, gameTimeDisplay: `${min}'`, type, isMajor: true, playerId: 1, extraPlayerId: null,
  playerName: name, playerShortName: null, extraPlayerName: null, description: 'But',
});

function stats(): LiveMatchStats {
  return {
    gameId: 4672325, matchupId: '5061-2373-4672325', competitionId: 7016, competitionName: 'Ligue des nations', status: 'ended',
    statusGroup: 4, statusText: 'Terminé', gameTime: 90, gameTimeDisplay: "90'", startTime: '2026-10-05T20:45:00+02:00',
    home: { id: 5061, name: 'France', symbolicName: 'FRA', imageVersion: 1, score: 4 },
    away: { id: 2373, name: 'Belgique', symbolicName: 'BEL', imageVersion: 1, score: 1 },
    teamStats: { home: {}, away: {} },
    events: [goal(5061, 'Mbappé', 12), goal(5061, 'Dembélé', 30), goal(5061, 'Mbappé', 55, 'penalty_goal'), goal(5061, 'Thuram', 80), goal(2373, 'Lukaku', 64)],
    topPerformers: [], shots: [], updatedAt: '2026-10-05T23:00:00Z',
  } as unknown as LiveMatchStats;
}

afterEach(cleanup);

describe('L189 — buteurs de l\'en-tête', () => {
  it('une ligne par joueur, minutes groupées : 4 buts de 3 joueurs côté France donnent 3 entrées', () => {
    render(<MatchPage />);
    const france = screen.getByText('Dembélé').closest('ul') as HTMLUListElement;
    expect(france.querySelectorAll('li')).toHaveLength(3);
    expect(screen.getByText("12', 55' (pen.)")).toBeInTheDocument();
  });

  it('la liste des buteurs coule en lignes qui passent à la ligne (flex-wrap), alignée vers le score', () => {
    render(<MatchPage />);
    const france = screen.getByText('Dembélé').closest('ul') as HTMLUListElement;
    const belgique = screen.getByText('Lukaku').closest('ul') as HTMLUListElement;
    expect(france.className).toMatch(/\bflex\b/);
    expect(france.className).toMatch(/\bflex-wrap\b/);
    expect(france.className).toMatch(/justify-end/);
    expect(belgique.className).toMatch(/\bflex-wrap\b/);
    expect(belgique.className).not.toMatch(/justify-end/);
  });

  it('un buteur n\'est insécable qu\'à partir de 1024 px : en dessous, un doublé ne pousse pas l\'autre colonne hors de l\'écran', () => {
    render(<MatchPage />);
    const li = screen.getByText('Thuram').closest('li') as HTMLLIElement;
    const jetons = li.className.split(/\s+/).filter((c) => /whitespace-nowrap$/.test(c));
    expect(jetons).toEqual(['min-[1024px]:whitespace-nowrap']);
  });
});
