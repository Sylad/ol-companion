import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render } from '@testing-library/react';
import { Ligue1Map } from './ligue1-map';
import type { SeasonMatch } from '@/types/api';

// L91 — la fiche d'un club range le match en cours sous « En direct » avec son score, jamais sous « À venir ».

const matchs = vi.hoisted(() => ({ value: [] as unknown[] }));
vi.mock('@/hooks/use-season-matches', () => ({ useSeasonMatches: () => ({ data: matchs.value }) }));
vi.mock('@/hooks/use-standings', () => ({ useStandings: () => ({ data: undefined }) }));

const base = { competitionCode: 'L1' as const, competitionId: 35, competition: 'Ligue 1', matchday: 1 };
const aller: SeasonMatch = {
  ...base, id: 1, date: '2026-09-01T18:00:00Z', status: 'FINISHED', homeScore: 2, awayScore: 0,
  homeTeamId: 523, awayTeamId: 469, homeTeam: 'Lyon', awayTeam: 'Marseille',
};
const retour = (extra: Partial<SeasonMatch>): SeasonMatch => ({
  ...base, id: 2, date: '2026-10-09T18:00:00Z', status: 'IN_PLAY', homeScore: 1, awayScore: 2,
  homeTeamId: 469, awayTeamId: 523, homeTeam: 'Marseille', awayTeam: 'Lyon', ...extra,
});

function fiche(club: string): HTMLElement {
  const { container } = render(<Ligue1Map />);
  const el = [...container.querySelectorAll<HTMLElement>('.leaflet-marker-icon')].find((m) => m.title === club)!;
  act(() => {
    fireEvent.click(el);
  });
  return container.querySelector<HTMLElement>('.leaflet-popup')!;
}

function titres(popup: HTMLElement): string[] {
  return [...popup.querySelectorAll('div.uppercase')].map((d) => d.textContent ?? '');
}

describe('<Ligue1Map /> — match en cours dans la fiche (L91)', () => {
  afterEach(() => {
    matchs.value = [];
  });

  it('R1 — un match IN_PLAY est sous « En direct » avec le score du côté de l’OL, pas sous « À venir »', () => {
    matchs.value = [aller, retour({})];
    const popup = fiche('Olympique de Marseille');
    expect(titres(popup)).toContain('En direct');
    expect(titres(popup)).not.toContain('À venir');
    const ligne = popup.querySelector('[data-testid="match-en-direct"]')!;
    expect(ligne.textContent).toContain('Extérieur');
    expect(ligne.textContent).toContain('2–1');
  });

  it('R2 — le match en cours n’entre pas dans le bilan V N D, qui ne compte que les matchs finis', () => {
    matchs.value = [aller, retour({})];
    const texte = fiche('Olympique de Marseille').textContent ?? '';
    expect(texte).toMatch(/1\s*V\s*0\s*N\s*0\s*D/);
  });

  it('R3 — sans score connu, la ligne dit « en direct » au lieu d’un score vide', () => {
    matchs.value = [aller, retour({ homeScore: null, awayScore: null })];
    const ligne = fiche('Olympique de Marseille').querySelector('[data-testid="match-en-direct"]')!;
    expect(ligne.textContent).toContain('en direct');
    expect(ligne.textContent).not.toMatch(/\d–\d/);
  });

  it('R4 — un match à venir reste sous « À venir » et ne produit pas de ligne en direct', () => {
    matchs.value = [aller, retour({ status: 'SCHEDULED', homeScore: null, awayScore: null })];
    const popup = fiche('Olympique de Marseille');
    expect(titres(popup)).toContain('À venir');
    expect(titres(popup)).not.toContain('En direct');
    expect(popup.querySelector('[data-testid="match-en-direct"]')).toBeNull();
  });
});
