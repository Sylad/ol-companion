import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';

// L159 — page du match à 1440 px : les trois colonnes finissent à hauteur proche
// (le classement passe sous la carte des tirs) et « Joueurs en vue » ne tronque
// plus les noms ni ne casse les libellés.

vi.mock('@tanstack/react-router', () => ({
  useParams: () => ({ gameId: '10' }),
  useSearch: () => ({ matchupId: '465-1-10' }),
  Link: ({ children }: { children: React.ReactNode }) => <a href="/">{children}</a>,
}));
vi.mock('@/hooks/use-match-event-burst', () => ({ useMatchEventBurst: () => null }));
vi.mock('@/hooks/use-live-match', () => ({
  useLiveMatchStats: () => ({
    isLoading: false,
    isError: false,
    data: {
      status: 'finished',
      competitionName: 'Ligue 1',
      home: { id: 465, name: 'Lyon', score: 2 },
      away: { id: 1, name: 'Nice', score: 1 },
      teamStats: { home: { Touches: 50 }, away: { Touches: 40 } },
      events: [],
      topPerformers: [
        {
          role: 'Attaquant',
          homePlayer: { name: 'Keito Nakamura', statName: 'Buts attendus', statValue: '0.45' },
          awayPlayer: { name: 'Jørgen Strand Larsen', statName: 'Buts attendus', statValue: '0.62' },
        },
      ],
      shots: [{}],
      momentum: [{}],
      standings: [{}],
      lineups: {
        home: { starters: [], bench: [] },
        away: { starters: [], bench: [] },
      },
    },
  }),
}));
vi.mock('@/components/shot-map', () => ({ ShotMap: () => <div data-testid="carte-tirs" /> }));
vi.mock('@/components/momentum-chart', () => ({ MomentumChart: () => <div data-testid="momentum" /> }));
vi.mock('@/components/lineup-card', () => ({ LineupCard: () => <div data-testid="compo" /> }));
vi.mock('@/components/mini-standings', () => ({ MiniStandings: () => <div data-testid="classement" /> }));
vi.mock('@/components/match-event-burst', () => ({ MatchEventBurst: () => null }));

import { MatchPage } from './match';

describe('<MatchPage /> — équilibre des colonnes (L159)', () => {
  it('le classement est dans la colonne centrale, sous la carte des tirs', () => {
    render(<MatchPage />);
    const centre = screen.getByTestId('colonne-centre');
    expect(within(centre).getByTestId('carte-tirs')).toBeInTheDocument();
    expect(within(centre).getByTestId('classement')).toBeInTheDocument();
    expect(within(screen.getByTestId('colonne-gauche')).queryByTestId('classement')).toBeNull();
  });

  it('« Joueurs en vue » : noms complets non tronqués, libellé de statistique sur une ligne', () => {
    render(<MatchPage />);
    const nom = screen.getByText('Jørgen Strand Larsen');
    expect(nom.className).not.toMatch(/truncate/);
    for (const libelle of screen.getAllByText(/Buts attendus/)) {
      expect(libelle.closest('[data-stat-ligne]')?.className).toMatch(/whitespace-nowrap/);
    }
  });
});
