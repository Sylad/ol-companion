import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StandingsTable } from './standings-table';
import type { StandingEntry } from '@/types/api';

// L37 — à 390 px, la colonne Pts sortait de la zone visible : la cellule du club,
// à largeur libre, poussait le tableau au-delà de son conteneur. Le club doit
// pouvoir rétrécir (max-w-0 + truncate) pour que Pts reste visible sans défilement.

const rows: StandingEntry[] = [
  {
    position: 1, team: 'Paris Saint-Germain Football Club', teamId: 524, played: 9, won: 7, draw: 1,
    lost: 1, goalsFor: 20, goalsAgainst: 5, goalDifference: 15, points: 22,
  },
  {
    position: 2, team: 'Olympique Lyonnais', teamId: 523, played: 9, won: 6, draw: 2,
    lost: 1, goalsFor: 18, goalsAgainst: 8, goalDifference: 10, points: 20,
  },
];

function renderTable() {
  vi.stubGlobal('fetch', vi.fn());
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <StandingsTable rows={rows} />
    </QueryClientProvider>,
  );
}

describe('<StandingsTable /> — mobile (L37)', () => {
  it('la cellule du club peut rétrécir : max-w-0 sans w-full (colonnes fixes préservées), nom tronqué', () => {
    renderTable();
    const name = screen.getByText('Paris Saint-Germain Football Club');
    expect(name).toHaveClass('truncate');
    const cell = name.closest('td')!;
    expect(cell).toHaveClass('max-w-0');
    expect(cell).not.toHaveClass('w-full');
  });

  it('la colonne Pts reste affichée sur mobile (jamais masquée ni hors flux)', () => {
    renderTable();
    const pts = screen.getByText('Pts');
    expect(pts.className).not.toMatch(/hidden/);
    expect(screen.getByText('22').closest('td')!.className).not.toMatch(/hidden/);
  });

  it('les colonnes fixes d’un téléphone tiennent dans 332 px avec un club de 100 px au moins', () => {
    renderTable();
    // largeurs déclarées des colonnes visibles sur mobile (classes w-N = N*4 px)
    const widths = Array.from(document.querySelectorAll('thead th'))
      .filter((th) => !/\bhidden\b/.test(th.className))
      .map((th) => /\bw-(\d+)\b/.exec(th.className))
      .filter((m): m is RegExpExecArray => !!m)
      .map((m) => Number(m[1]) * 4);
    const fixed = widths.reduce((a, b) => a + b, 0);
    expect(332 - fixed).toBeGreaterThanOrEqual(100);
  });
});
