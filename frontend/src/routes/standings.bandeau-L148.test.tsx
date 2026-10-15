import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// L148 — données présentes + échec de rafraîchissement ou cache de plus d'1 h : pas de bloc
// rouge, un bandeau role=status sous l'en-tête de la carte, tableau intact, date du cache en méta.

const etat = vi.hoisted(() => ({
  value: { data: undefined as unknown, isLoading: false, isError: false, isFetching: false, refetch: vi.fn() },
}));
vi.mock('@/hooks/use-standings', () => ({ useStandings: () => etat.value }));
vi.mock('@/components/knowledge-header', () => ({ KnowledgeHeader: () => null }));
vi.mock('@/components/position-tracker', () => ({ PositionTracker: () => null }));
vi.mock('@/components/standings-table', () => ({ StandingsTable: () => <div data-testid="table" /> }));

import { StandingsPage } from './standings';

const MAINTENANT = new Date('2026-10-14T16:40:00+02:00');

function donnees(updatedAt: string) {
  return { updatedAt, currentMatchday: 8, table: [{ position: 1 }] };
}

describe('StandingsPage — bandeau d\'état (L148)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(MAINTENANT);
    etat.value = { data: undefined, isLoading: false, isError: false, isFetching: false, refetch: vi.fn() };
  });
  afterEach(() => vi.useRealTimers());

  it('échec de rafraîchissement : bandeau status avec la date du cache, tableau intact, pas d\'alerte', () => {
    etat.value.isError = true;
    etat.value.data = donnees('2026-10-14T16:25:00+02:00');
    render(<StandingsPage />);
    const bandeau = screen.getByRole('status');
    expect(bandeau.textContent).toBe('Rafraîchissement impossible — classement du 14 oct. à 16:25');
    expect(bandeau.querySelector('svg')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByTestId('table')).toBeTruthy();
  });

  it('cache de plus d\'1 h sans erreur : « Classement d\'il y a 3 j »', () => {
    etat.value.data = donnees('2026-10-11T16:25:00+02:00');
    render(<StandingsPage />);
    expect(screen.getByRole('status').textContent).toBe("Classement d'il y a 3 j");
    expect(screen.getByTestId('table')).toBeTruthy();
  });

  it('la méta de l\'en-tête montre la date du cache quand le bandeau est là', () => {
    etat.value.isError = true;
    etat.value.data = donnees('2026-10-14T16:25:00+02:00');
    const { container } = render(<StandingsPage />);
    expect(container.querySelector('header')?.textContent).toContain('14 oct. à 16:25');
  });

  it('données fraîches (< 1 h), sans erreur : aucun bandeau', () => {
    etat.value.data = donnees('2026-10-14T16:25:00+02:00');
    render(<StandingsPage />);
    expect(screen.queryByRole('status')).toBeNull();
  });
});
