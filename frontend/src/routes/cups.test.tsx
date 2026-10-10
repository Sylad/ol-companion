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

// Un libellé de statut apparaît dans l'onglet et dans l'en-tête de la carte.
const count = (label: string) => screen.queryAllByText(label).length;

describe('<CupsPage /> — statut des coupes (L38)', () => {
  it('« En lice » par défaut, onglet et carte', () => {
    cups = [cup({})];
    render(<CupsPage />);
    expect(count('En lice')).toBe(2);
    expect(count('En attente du tirage')).toBe(0);
  });

  it('« En attente du tirage » quand awaitingDraw, onglet et carte', () => {
    cups = [cup({ awaitingDraw: true })];
    render(<CupsPage />);
    expect(count('En attente du tirage')).toBe(2);
    expect(count('En lice')).toBe(0);
  });

  it('« Éliminé » prime sur awaitingDraw', () => {
    cups = [cup({ isEliminated: true, awaitingDraw: true })];
    render(<CupsPage />);
    expect(count('Éliminé')).toBe(2);
    expect(count('En attente du tirage')).toBe(0);
  });

  it('le statut de chaque onglet suit sa propre coupe', () => {
    cups = [cup({}), cup({ competitionId: 37, name: 'Coupe de France', awaitingDraw: true })];
    render(<CupsPage />);
    fireEvent.click(screen.getByRole('button', { name: /Coupe de France/ }));
    expect(count('En attente du tirage')).toBe(2);
    expect(count('En lice')).toBe(1);
  });

  it('le nom de la compétition n\'est pas tronqué (pas de truncate sur le titre ni l\'onglet)', () => {
    cups = [cup({ awaitingDraw: true })];
    render(<CupsPage />);
    expect(screen.getByRole('heading', { level: 2, name: 'Ligue Europa' }).className).not.toMatch(/truncate/);
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
