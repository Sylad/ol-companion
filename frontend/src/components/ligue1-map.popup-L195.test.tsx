import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render } from '@testing-library/react';
import L from 'leaflet';
import { Ligue1Map } from './ligue1-map';
import type { SeasonMatch } from '@/types/api';

// L195 — la fiche d'un club : le focus y entre à l'ouverture, Échap la ferme et rend le focus au marqueur,
// « D » n'abrège plus Domicile.

const matchs = vi.hoisted(() => ({ value: [] as unknown[] }));
vi.mock('@/hooks/use-season-matches', () => ({ useSeasonMatches: () => ({ data: matchs.value }) }));
vi.mock('@/hooks/use-standings', () => ({ useStandings: () => ({ data: undefined }) }));

function marqueur(container: HTMLElement, club: string): HTMLElement {
  const el = [...container.querySelectorAll<HTMLElement>('.leaflet-marker-icon')].find((m) => m.title === club);
  if (!el) throw new Error(`marqueur ${club} introuvable`);
  return el;
}

function ouvrir(container: HTMLElement, club: string): HTMLElement {
  act(() => {
    fireEvent.click(marqueur(container, club));
  });
  const popup = container.querySelector<HTMLElement>('.leaflet-popup');
  if (!popup) throw new Error('fiche non ouverte');
  return popup;
}

describe('<Ligue1Map /> — fiche du club (L195)', () => {
  it('R1 — à l’ouverture, le focus entre dans la fiche', () => {
    const { container } = render(<Ligue1Map />);
    const popup = ouvrir(container, 'Olympique de Marseille');
    expect(popup.contains(document.activeElement)).toBe(true);
    expect(document.activeElement).not.toBe(document.body);
  });

  it('R2 — Échap ferme la fiche et rend le focus au marqueur', () => {
    const { container } = render(<Ligue1Map />);
    const icone = marqueur(container, 'Olympique de Marseille');
    const popup = ouvrir(container, 'Olympique de Marseille');
    act(() => {
      fireEvent.keyDown(popup, { key: 'Escape', keyCode: 27 });
    });
    expect(container.querySelector('.leaflet-popup')).toBeNull();
    expect(document.activeElement).toBe(icone);
  });

  it('R3 — le × ferme la fiche et rend aussi le focus au marqueur', () => {
    const { container } = render(<Ligue1Map />);
    const icone = marqueur(container, 'Olympique de Marseille');
    const popup = ouvrir(container, 'Olympique de Marseille');
    act(() => {
      fireEvent.click(popup.querySelector('.leaflet-popup-close-button')!);
    });
    expect(container.querySelector('.leaflet-popup')).toBeNull();
    expect(document.activeElement).toBe(icone);
  });

  it('R4 — la fiche est un dialogue nommé par le club', () => {
    const { container } = render(<Ligue1Map />);
    const popup = ouvrir(container, 'Olympique de Marseille');
    expect(popup.getAttribute('role')).toBe('dialog');
    expect(popup.getAttribute('aria-label')).toBe('Olympique de Marseille');
  });

  it('R5 — « D » n’abrège plus Domicile : un match joué à domicile ou à l’extérieur est écrit en toutes lettres', () => {
    const base = { competitionCode: 'L1' as const, competitionId: 35, competition: 'Ligue 1', homeScore: 2, awayScore: 1, status: 'FINISHED' as const, matchday: 1 };
    matchs.value = [
      { ...base, id: 1, date: '2025-09-01T18:00:00Z', homeTeamId: 523, awayTeamId: 469, homeTeam: 'Lyon', awayTeam: 'Marseille' },
      { ...base, id: 2, date: '2026-02-01T18:00:00Z', homeTeamId: 469, awayTeamId: 523, homeTeam: 'Marseille', awayTeam: 'Lyon' },
    ] satisfies SeasonMatch[];
    const { container } = render(<Ligue1Map />);
    const popup = ouvrir(container, 'Olympique de Marseille');
    const texte = popup.textContent ?? '';
    expect(texte).toContain('Domicile');
    expect(texte).toContain('Extérieur');
    const lieux = [...popup.querySelectorAll('li > span.text-fg-muted')].map((s) => s.textContent);
    expect(lieux).toEqual(['Domicile', 'Extérieur']);
    matchs.value = [];
  });

  it('R6 — les limites de glisser sont levées le temps de la fiche (les clubs du nord y tiennent) puis remises', () => {
    const setView = vi.spyOn(L.Map.prototype, 'setView');
    const { container } = render(<Ligue1Map />);
    const carte = setView.mock.contexts[0] as L.Map;
    setView.mockRestore();
    expect(carte.options.maxBounds).toBeTruthy();
    const popup = ouvrir(container, 'Lille');
    expect(carte.options.maxBounds).toBeNull();
    act(() => {
      fireEvent.keyDown(popup, { key: 'Escape', keyCode: 27 });
    });
    expect(carte.options.maxBounds).toBeTruthy();
  });

  it('R7 — les écouteurs ne s’accumulent pas : après trois ouvertures, Échap ne rend le focus qu’une fois', () => {
    const setView = vi.spyOn(L.Map.prototype, 'setView');
    const { container } = render(<Ligue1Map />);
    const carte = setView.mock.contexts[0] as L.Map;
    setView.mockRestore();
    const icone = marqueur(container, 'Lille');
    let popup = ouvrir(container, 'Lille');
    for (let i = 0; i < 2; i++) {
      act(() => {
        carte.closePopup();
      });
      popup = ouvrir(container, 'Lille');
    }
    const focus = vi.spyOn(icone, 'focus');
    act(() => {
      fireEvent.keyDown(popup, { key: 'Escape', keyCode: 27 });
    });
    expect(focus).toHaveBeenCalledTimes(1);
  });

  it('R8 — le × et les lieux à venir sont en français et cohérents', () => {
    const base = { competitionCode: 'L1' as const, competitionId: 35, competition: 'Ligue 1', homeScore: null, awayScore: null, status: 'SCHEDULED' as const, matchday: 30 };
    matchs.value = [
      { ...base, id: 3, date: '2099-02-01T18:00:00Z', homeTeamId: 523, awayTeamId: 469, homeTeam: 'Lyon', awayTeam: 'Marseille' },
      { ...base, id: 4, date: '2099-03-01T18:00:00Z', homeTeamId: 469, awayTeamId: 523, homeTeam: 'Marseille', awayTeam: 'Lyon' },
    ] as unknown as SeasonMatch[];
    const { container } = render(<Ligue1Map />);
    const popup = ouvrir(container, 'Olympique de Marseille');
    expect(popup.querySelector('.leaflet-popup-close-button')?.getAttribute('aria-label')).toBe('Fermer la fiche');
    const lieux = [...popup.querySelectorAll('li > span.text-fg-muted')].map((s) => s.textContent);
    expect(lieux).toEqual(['Domicile', 'Extérieur']);
    matchs.value = [];
  });
});
