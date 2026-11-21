import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';

// L9 t1 — revue UX : remplacement lisible (entrant ↔ sortant dans la ligne), libellés français
// pour Poteau et But annulé (VAR), aucun libellé anglais brut.

vi.mock('@tanstack/react-router', () => ({
  useParams: () => ({ gameId: '10' }),
  useSearch: () => ({ matchupId: '465-1-10' }),
  Link: ({ children }: { children: React.ReactNode }) => <a href="/">{children}</a>,
}));
vi.mock('@/hooks/use-match-event-burst', () => ({ useMatchEventBurst: () => null }));

const ev = (over: Record<string, unknown>) => ({
  competitorId: 465, gameTime: 46, gameTimeDisplay: "46'", type: 'substitution', isMajor: false,
  playerId: 1, extraPlayerId: 2, playerName: 'Marco Kana', playerShortName: 'Kana',
  extraPlayerName: 'Amane Romeo', extraPlayerShortName: 'Romeo', description: 'Substitution', ...over,
});

vi.mock('@/hooks/use-live-match', () => ({
  useLiveMatchStats: () => ({
    isLoading: false,
    isError: false,
    data: {
      status: 'finished',
      competitionName: 'Ligue 1',
      home: { id: 465, name: 'Lyon', symbolicName: 'OL', score: 1 },
      away: { id: 1, name: 'Rennes', symbolicName: 'REN', score: 1 },
      teamStats: { home: {}, away: {} },
      events: [
        ev({}),
        ev({ gameTime: 52, gameTimeDisplay: "52'", type: 'woodwork', playerId: 3, extraPlayerId: null, playerName: 'Rayan Cherki', playerShortName: 'Cherki', extraPlayerName: null, extraPlayerShortName: null, description: 'Woodwork' }),
        ev({ gameTime: 53, gameTimeDisplay: "53'", type: 'goal_cancelled', playerId: null, extraPlayerId: null, playerName: null, playerShortName: null, extraPlayerName: null, extraPlayerShortName: null, description: 'But annulé — Var' }),
      ],
      topPerformers: [],
      shots: [],
    },
  }),
}));
vi.mock('@/components/shot-map', () => ({ ShotMap: () => null }));
vi.mock('@/components/momentum-chart', () => ({ MomentumChart: () => null }));
vi.mock('@/components/lineup-card', () => ({ LineupCard: () => null }));
vi.mock('@/components/mini-standings', () => ({ MiniStandings: () => null }));
vi.mock('@/components/match-event-burst', () => ({ MatchEventBurst: () => null }));

import { MatchPage } from './match';

/** Texte lu par un lecteur d'écran : sans les nœuds `aria-hidden`, espaces normalisées. */
function lu(el: Element): string {
  const copie = el.cloneNode(true) as Element;
  copie.querySelectorAll('[aria-hidden="true"]').forEach((n) => n.remove());
  return (copie.textContent ?? '').replace(/\s+/g, ' ').trim();
}
/** Texte à l'écran : sans les nœuds `sr-only`. */
function visible(el: Element): string {
  const copie = el.cloneNode(true) as Element;
  copie.querySelectorAll('.sr-only').forEach((n) => n.remove());
  return (copie.textContent ?? '').replace(/\s+/g, ' ').trim();
}
/** Émojis et flèches de texte hors d'un `aria-hidden`. */
function emojisLus(racine: Element): string[] {
  return [...racine.querySelectorAll('*')]
    .flatMap((e) => [...e.childNodes].filter((n) => n.nodeType === 3).map((n) => ({ e, t: n.textContent ?? '' })))
    .filter(({ e, t }) => /[\p{Extended_Pictographic}↔▸]/u.test(t) && !e.closest('[aria-hidden="true"]'))
    .map(({ t }) => t.trim());
}

describe('<MatchPage /> — faits du match (L9 t1)', () => {
  it('remplacement : entrant ↔ sortant dans la ligne elle-même, pas seulement au survol', () => {
    render(<MatchPage />);
    const faits = screen.getByTestId('faits-match');
    const ligne = within(faits).getByText(/Remplacement/);
    // L260 : la flèche reste à l'écran, le lecteur d'écran lit « remplace » (texte sr-only).
    expect(visible(ligne)).toBe('↔ Remplacement · Kana ↔ Romeo');
    expect(lu(ligne)).toBe('Remplacement · Kana remplace Romeo');
    expect(ligne).toHaveAttribute('title', 'Marco Kana (entrant) ↔ Amane Romeo (sortant)');
  });

  // L260 — émojis décoratifs (🥅, ⚽, ↔…) masqués aux lecteurs d'écran : le libellé français porte le sens.
  it('L260 — aucun émoji des faits du match n’est lu par un lecteur d’écran', () => {
    render(<MatchPage />);
    const faits = screen.getByTestId('faits-match');
    expect(faits.textContent).toMatch(/🥅/u);
    expect(emojisLus(faits)).toEqual([]);
    expect(lu(within(faits).getByText(/Poteau/))).toBe('Poteau · Cherki');
  });

  it('Poteau et But annulé (VAR) en français, sans « Woodwork » ni « Var » bruts', () => {
    render(<MatchPage />);
    const faits = screen.getByTestId('faits-match');
    expect(within(faits).getByText(/Poteau · Cherki/)).toBeInTheDocument();
    expect(within(faits).getByText(/But annulé \(VAR\)/)).toBeInTheDocument();
    expect(faits.textContent).not.toMatch(/Woodwork|Substitution/);
  });
});
