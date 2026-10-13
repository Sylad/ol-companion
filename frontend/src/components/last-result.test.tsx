import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LastResult } from './last-result';

const MATCH = {
  id: 1,
  date: '2026-10-13T18:45:00Z',
  homeTeam: 'Olympique Lyonnais',
  homeTeamId: 523,
  awayTeam: 'Lens',
  awayTeamId: 546,
  homeScore: 2,
  awayScore: 1,
  competition: 'Ligue Europa',
  competitionCode: 'C3',
  competitionId: 573,
  status: 'FINISHED',
  matchday: null,
  round: '3e tour de qualification · retour',
};

function renderCard() {
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true, status: 200, json: async () => [MATCH] })));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <LastResult />
    </QueryClientProvider>,
  );
}

describe('<LastResult /> — pied de carte (L134)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('la date ne se coupe jamais : insécable, elle ne rétrécit pas ; c’est le tour qui passe à la ligne', async () => {
    renderCard();
    const carte = await screen.findByTestId('dernier-resultat');
    const pied = carte.querySelector('footer') as HTMLElement;
    const [tour, date] = Array.from(pied.children) as HTMLElement[];

    expect(tour.textContent).toBe('Ligue Europa · 3e tour de qualification · retour');
    expect(date.textContent).toMatch(/^\S+ \d{2}\/\d{2}$/);
    expect(date.className).toContain('whitespace-nowrap');
    expect(date.className).toContain('shrink-0');
    expect(tour.className).toContain('min-w-0');
    expect(pied.className).toContain('gap-');
  });
});
