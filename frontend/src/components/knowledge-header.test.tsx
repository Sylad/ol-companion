import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { KnowledgeHeader } from './knowledge-header';

vi.mock('@/hooks/use-wiki-image', () => ({ useWikiImage: () => ({ data: undefined }) }));
vi.mock('@/hooks/use-standings', () => ({ useStandings: () => ({ data: undefined }) }));

// tailwind-merge retire un `leading-*` placé avant une taille de police (`text-base`, `text-2xl`, `lg:text-[34px]`) :
// ces tests verrouillent l'ordre des classes pour que le bandeau reste identique au bureau (≥ lg).
describe.each([
  ['compact', true],
  ['non compact', false],
])('L50 — bandeau au bureau inchangé : %s', (_nom, compact) => {
  it('le titre garde 34 px et leading-tight au bureau', () => {
    render(<KnowledgeHeader compact={compact} />);
    const classes = screen.getByRole('heading', { level: 1 }).className.split(/\s+/);
    expect(classes).toContain('lg:text-[34px]');
    expect(classes).toContain('lg:leading-tight');
  });

  it('le sous-titre est à 14 px au bureau', () => {
    render(<KnowledgeHeader compact={compact} />);
    const sous = screen.getByText('Ligue 1 · saison en cours');
    const classes = sous.className.split(/\s+/);
    if (compact) {
      expect(classes).toContain('text-xs');
      expect(classes).toContain('lg:text-sm');
    } else {
      expect(classes).toContain('text-sm');
    }
  });
});
