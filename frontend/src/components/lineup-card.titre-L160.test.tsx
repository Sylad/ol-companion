import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { LiveMatchLineup } from '@/types/api';
import { LineupCard } from './lineup-card';

// L160 — revue UX de conformité : à 1440, le titre « Composition · club » était tronqué (« COMPOSITION · CRYSTA… »)
// dès que le nom du club dépassait 7 caractères. Le nom d'un club n'est jamais tronqué : le titre passe à la ligne.
const lineup: LiveMatchLineup = { formation: '4-2-3-1', starters: [], bench: [] };

describe('LineupCard — titre jamais tronqué (L160)', () => {
  it('R12 — le titre n\'est ni tronqué ni coupé (pas de truncate, line-clamp ni text-ellipsis) et peut rétrécir pour passer à la ligne', () => {
    render(<LineupCard lineup={lineup} teamName="Crystal Palace" accent="blue" />);
    const title = screen.getByTestId('titre-composition');
    expect(title).toHaveTextContent('Composition · Crystal Palace');
    expect(title.className).not.toMatch(/truncate|line-clamp|text-ellipsis|whitespace-nowrap|overflow-hidden/);
    expect(title.className).toContain('min-w-0');
  });

  it('R12 — même jeu de classes que les autres titres h2 (l\'apparence ne diffère pas d\'un bloc à l\'autre)', () => {
    render(<LineupCard lineup={lineup} teamName="Lyon" accent="red" />);
    expect(screen.getByTestId('titre-composition').className).toBe('eyebrow min-w-0');
  });

  it('R6 — l\'en-tête réserve la place de deux lignes à 1440, pour que les deux terrains restent à la même ordonnée quand un seul titre passe à la ligne', () => {
    render(<LineupCard lineup={lineup} teamName="Lyon" accent="red" />);
    const header = screen.getByTestId('titre-composition').closest('header') as HTMLElement;
    expect(header.className).toMatch(/min-\[1440px\]:min-h-\[/);
  });
});
