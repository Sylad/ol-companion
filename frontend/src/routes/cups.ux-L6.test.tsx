import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { blend, contrast, token } from '@/test/contraste';
import type { CupInfo } from '@/types/api';

// L6 — revue UX de Coupes : page (t1 échec + Réessayer, t2 contrastes, t6 onglets, t7 téléphone).

const cup = (o: Partial<CupInfo> = {}): CupInfo => ({
  competitionId: 573, name: 'Ligue Europa', currentStageFr: 'Phase de ligue', isEliminated: false, matches: [], ...o,
});
const refetch = vi.fn();
let state: { data?: CupInfo[]; isLoading: boolean; isError: boolean } = { isLoading: false, isError: false };
vi.mock('@/hooks/use-cups', () => ({ useCups: () => ({ ...state, refetch }) }));
const header = vi.fn();
vi.mock('@/components/knowledge-header', () => ({ KnowledgeHeader: (p: object) => { header(p); return null; } }));
vi.mock('@/components/bracket', () => ({ Bracket: () => null }));
vi.mock('@/components/cup-match-row', () => ({ CupMatchRow: () => null }));

import { CupsPage } from './cups';

beforeEach(() => {
  refetch.mockClear();
  header.mockClear();
  state = { isLoading: false, isError: false };
});

describe('L6 t1 — échec de /api/cups', () => {
  it('t1 — message en role=alert et bouton « Réessayer » de 44 px qui relance la requête', () => {
    state = { isLoading: false, isError: true };
    render(<CupsPage />);
    expect(screen.getByRole('alert')).toHaveTextContent('Erreur de chargement des données coupes.');
    const bouton = screen.getByRole('button', { name: 'Réessayer' });
    expect(bouton.className).toMatch(/min-h-\[44px\]/);
    fireEvent.click(bouton);
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('t1 — le message est ≥ 4,5:1 sur le fond du panneau (ol-red-bright sur surface)', () => {
    expect(contrast(token('ol-red-bright'), token('surface'))).toBeGreaterThanOrEqual(4.5);
    state = { isLoading: false, isError: true };
    render(<CupsPage />);
    expect(screen.getByRole('alert').className).toMatch(/text-ol-red-bright/);
  });

  it('t1 — le message est dans un panneau (fond surface), pas posé sur la photo de fond', () => {
    state = { isLoading: false, isError: true };
    render(<CupsPage />);
    expect(screen.getByRole('alert').closest('section')?.className).toMatch(/bg-surface/);
  });
});

describe('L6 t2 — contrastes de la page', () => {
  const fond = blend(token('surface-2'), token('surface'), 0.25);

  it('t2 — le compteur D est en loss-fg, ≥ 4,5:1 sur l’en-tête de la carte', () => {
    state = { data: [cup()], isLoading: false, isError: false };
    render(<CupsPage />);
    const d = screen.getByText('D').previousElementSibling!;
    expect(d.className).toMatch(/\btext-loss-fg\b/);
    expect(contrast(token('loss-fg'), fond)).toBeGreaterThanOrEqual(4.5);
  });

  it('t2 — le texte de chargement est en fg (≥ 4,5:1), plus en fg-dim', () => {
    state = { isLoading: true, isError: false };
    render(<CupsPage />);
    const texte = screen.getByText('Chargement des coupes…');
    expect(texte.parentElement!.className).toMatch(/\btext-fg\b/);
    expect(texte.parentElement!.className).not.toMatch(/text-fg-dim/);
  });
});

describe('L6 t6 — onglets de coupe', () => {
  it('t6 — groupe nommé, sans défilement horizontal, onglets sans largeur minimale de 220 px', () => {
    state = { data: [cup(), cup({ competitionId: 37, name: 'Coupe de France' })], isLoading: false, isError: false };
    render(<CupsPage />);
    const groupe = screen.getByRole('group', { name: 'Choisir une coupe' });
    expect(groupe.className).not.toMatch(/overflow-x/);
    expect(groupe.className).toMatch(/\bflex-wrap\b/);
    for (const onglet of screen.getAllByRole('button', { pressed: false }).concat(screen.getAllByRole('button', { pressed: true }))) {
      expect(onglet.className).not.toMatch(/min-w-\[220px\]/);
    }
    expect(groupe.querySelectorAll('button')).toHaveLength(2);
  });

  it('t6 — l’onglet a un contour de focus rouge', () => {
    state = { data: [cup()], isLoading: false, isError: false };
    render(<CupsPage />);
    expect(screen.getByRole('button', { pressed: true }).className).toMatch(/focus-visible:outline-ol-red-bright/);
  });
});

describe('L6 t7 — téléphone', () => {
  it('t7 — l’en-tête de page est compact (KnowledgeHeader compact)', () => {
    state = { data: [cup()], isLoading: false, isError: false };
    render(<CupsPage />);
    expect(header).toHaveBeenCalledWith({ compact: true });
  });

  it('t7 — nom, statut, phase et nombre de matchs ne sont écrits qu’une fois', () => {
    state = { data: [cup({ matches: [{ id: 1 } as never] })], isLoading: false, isError: false };
    render(<CupsPage />);
    expect(screen.getAllByText('Ligue Europa')).toHaveLength(2); // onglet + titre masqué (sr-only) pour les lecteurs d'écran
    expect(screen.getAllByText('En lice')).toHaveLength(1);
    expect(screen.getAllByText(/Phase de ligue/)).toHaveLength(1);
    expect(screen.getAllByText(/1 match/)).toHaveLength(1);
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(1); // « Parcours en coupes »
  });

  it('t7 — le titre de la coupe affichée est un h3 réservé aux lecteurs d’écran', () => {
    state = { data: [cup()], isLoading: false, isError: false };
    render(<CupsPage />);
    const h3 = screen.getByRole('heading', { level: 3, name: 'Ligue Europa' });
    expect(h3.className).toMatch(/\bsr-only\b/);
  });
});
