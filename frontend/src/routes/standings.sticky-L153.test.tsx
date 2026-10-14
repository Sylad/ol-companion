import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// L153 — l'en-tête collant du classement se collait au premier ancêtre qui n'est ni
// `overflow: visible` ni `clip` : la <section> de la page (overflow-hidden) comme avant le
// wrapper overflow-x-auto. On monte la page entière avec le vrai tableau et on vérifie
// tous les ancêtres du <th>.

vi.mock('@/hooks/use-standings', () => ({
  useStandings: () => ({
    data: {
      currentMatchday: 9,
      updatedAt: new Date().toISOString(),
      table: [
        {
          position: 1, team: 'Olympique Lyonnais', teamId: 523, played: 9, won: 7, draw: 1,
          lost: 1, goalsFor: 20, goalsAgainst: 5, goalDifference: 15, points: 22,
        },
      ],
    },
    isLoading: false, isError: false, isFetching: false, refetch: vi.fn(),
  }),
}));
vi.mock('@/components/knowledge-header', () => ({ KnowledgeHeader: () => null }));
vi.mock('@/components/position-tracker', () => ({ PositionTracker: () => null }));

import { StandingsPage } from './standings';

describe('StandingsPage — en-tête collant (L153)', () => {
  it('aucun ancêtre du <th sticky>, jusqu’à la page, ne crée un conteneur de défilement', () => {
    vi.stubGlobal('fetch', vi.fn());
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { container } = render(
      <QueryClientProvider client={client}>
        <StandingsPage />
      </QueryClientProvider>,
    );
    const th = container.querySelector('th')!;
    expect(th.className).toMatch(/(^| )sticky( |$)/);
    for (let el = th.parentElement; el && el !== document.body; el = el.parentElement) {
      expect(el.className, el.tagName).not.toMatch(/(^| )overflow-(x-|y-)?(auto|scroll|hidden)/);
    }
  });
});
