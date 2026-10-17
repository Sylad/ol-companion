import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { CupInfo } from '@/types/api';

// L38 — statut d'une coupe : « Éliminé » prime, puis « En attente du tirage », sinon « En lice » ;
// le libellé ne coupe pas le nom de la compétition (WCAG 1.4.10, 320 px).

const cup = (over: Partial<CupInfo>): CupInfo => ({
  competitionId: 573,
  name: 'Ligue Europa',
  currentStageFr: 'Phase de ligue',
  isEliminated: false,
  matches: [],
  ...over,
});

let cups: CupInfo[] = [];
vi.mock('@/hooks/use-cups', () => ({
  useCups: () => ({ data: cups, isLoading: false, isError: false }),
}));
vi.mock('@/components/knowledge-header', () => ({ KnowledgeHeader: () => null }));
vi.mock('@/components/bracket', () => ({ Bracket: () => null }));
vi.mock('@/components/cup-match-row', () => ({ CupMatchRow: () => null }));

import { CupsPage } from './cups';

// Un libellé de statut n'apparaît que dans l'onglet (L6 t7 : plus répété dans l'en-tête de la carte).
const count = (label: string) => screen.queryAllByText(label).length;

describe('<CupsPage /> — statut des coupes (L38)', () => {
  it('« En lice » par défaut, onglet', () => {
    cups = [cup({})];
    render(<CupsPage />);
    expect(count('En lice')).toBe(1);
    expect(count('En attente du tirage')).toBe(0);
  });

  it('« En attente du tirage » quand awaitingDraw, onglet', () => {
    cups = [cup({ awaitingDraw: true })];
    render(<CupsPage />);
    expect(count('En attente du tirage')).toBe(1);
    expect(count('En lice')).toBe(0);
  });

  it('« Éliminé » prime sur awaitingDraw', () => {
    cups = [cup({ isEliminated: true, awaitingDraw: true })];
    render(<CupsPage />);
    expect(count('Éliminé')).toBe(1);
    expect(count('En attente du tirage')).toBe(0);
  });

  it('le statut de chaque onglet suit sa propre coupe', () => {
    cups = [cup({}), cup({ competitionId: 37, name: 'Coupe de France', awaitingDraw: true })];
    render(<CupsPage />);
    fireEvent.click(screen.getByRole('button', { name: /Coupe de France/ }));
    expect(count('En attente du tirage')).toBe(1);
    expect(count('En lice')).toBe(1);
  });

  it('le nom de la compétition n\'est pas tronqué (pas de truncate sur le titre ni l\'onglet)', () => {
    cups = [cup({ awaitingDraw: true })];
    render(<CupsPage />);
    expect(screen.getByRole('heading', { level: 3, name: 'Ligue Europa' }).className).not.toMatch(/truncate/);
    expect(screen.getAllByText('Ligue Europa').every((el) => !/truncate/.test(el.className))).toBe(true);
  });
});

// L111 — onglets de coupe : état annoncé (WCAG 4.1.2) ; pastille « En lice » en bordure seule,
// sans fond teinté (WCAG 1.4.3, 4,39–4,49:1 mesurés avec le fond).
describe('<CupsPage /> — accessibilité des onglets et de la pastille (L111)', () => {
  it('chaque onglet porte aria-pressed, vrai pour la coupe affichée seulement', () => {
    cups = [cup({}), cup({ competitionId: 37, name: 'Coupe de France' })];
    render(<CupsPage />);
    const europa = screen.getByRole('button', { name: /Ligue Europa/ });
    const cdf = screen.getByRole('button', { name: /Coupe de France/ });
    expect(europa.getAttribute('aria-pressed')).toBe('true');
    expect(cdf.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(cdf);
    expect(europa.getAttribute('aria-pressed')).toBe('false');
    expect(cdf.getAttribute('aria-pressed')).toBe('true');
  });

  it('la pastille « En lice » de l\'onglet est en bordure seule, sans fond teinté', () => {
    cups = [cup({})];
    render(<CupsPage />);
    const pill = screen.getAllByText('En lice')[0];
    expect(pill.className).toMatch(/\bborder\b/);
    expect(pill.className).not.toMatch(/\bbg-/);
  });
});

describe('<CupsPage /> — bilan V N D et tirs au but (L140)', () => {
  const game = (id: number, o: object) => ({
    id, date: '2026-02-01T19:00:00Z', homeTeam: 'Lyon', homeTeamId: 523, awayTeam: 'Lille', awayTeamId: 79,
    homeScore: 1, awayScore: 1, status: 'FINISHED' as const, stage: 'x', stageFr: 'x', ...o,
  });
  const stat = (label: string) => screen.getAllByText(label).find((e) => e.previousElementSibling?.classList.contains('num'))?.previousElementSibling?.textContent;
  it('un nul gagné aux tirs au but compte en victoire, un nul perdu en défaite, un nul simple en nul', () => {
    cups = [cup({ matches: [game(1, { olQualified: true }), game(2, { olQualified: false }), game(3, {}), game(4, { homeScore: 3, awayScore: 0 })] })];
    render(<CupsPage />);
    expect(stat('V')).toBe('2');
    expect(stat('N')).toBe('1');
    expect(stat('D')).toBe('1');
  });
});

