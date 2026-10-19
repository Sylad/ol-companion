import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import L from 'leaflet';
import { Ligue1Map } from './ligue1-map';

// L192 — la molette fait défiler la page sans zoomer ; le bouton « Recentrer » rejoue le cadrage.

vi.mock('@/hooks/use-season-matches', () => ({ useSeasonMatches: () => ({ data: [] }) }));
vi.mock('@/hooks/use-standings', () => ({ useStandings: () => ({ data: undefined }) }));

describe('<Ligue1Map /> — cadrage (L192)', () => {
  it('R8 — la molette ne zoome pas la carte : la page défile', () => {
    const setView = vi.spyOn(L.Map.prototype, 'setView');
    render(<Ligue1Map />);
    // La carte est l'objet sur lequel FrameFrance a posé la vue.
    const map = setView.mock.contexts[0] as L.Map;
    expect(map.scrollWheelZoom.enabled()).toBe(false);
    setView.mockRestore();
  });

  it('R9 — le bouton « Recentrer » recadre la France avec animation', () => {
    const setView = vi.spyOn(L.Map.prototype, 'setView');
    render(<Ligue1Map />);
    setView.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Recentrer' }));
    expect(setView).toHaveBeenCalledTimes(1);
    expect(setView.mock.calls[0][2]).toMatchObject({ animate: true });
    setView.mockRestore();
  });
});
