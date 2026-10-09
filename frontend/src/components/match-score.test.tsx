import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MatchScore } from './match-score';

describe('<MatchScore /> (L77)', () => {
  it('affiche « vs » et jamais « -1 » pour un match à venir', () => {
    const { container } = render(<MatchScore home={{ score: -1 }} away={{ score: -1 }} status="upcoming" />);
    expect(screen.getByText('vs')).toBeInTheDocument();
    expect(container.textContent).not.toContain('-1');
  });
  it('affiche le score d\'un match en cours', () => {
    const { container } = render(<MatchScore home={{ score: 1 }} away={{ score: 0 }} status="live" />);
    expect(container.textContent).toBe('1·0');
  });
  it('« vs » est masqué aux lecteurs d\'écran, remplacé par un libellé sr-only (match à venir)', () => {
    render(<MatchScore home={{ score: -1 }} away={{ score: -1 }} status="upcoming" />);
    expect(screen.getByText('vs')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByText('Match pas encore commencé').className).toMatch(/(^| )sr-only( |$)/);
  });
  it('ne dit jamais « pas encore commencé » pour un match commencé sans score', () => {
    render(<MatchScore home={{ score: null }} away={{ score: null }} status="ended" />);
    expect(screen.queryByText('Match pas encore commencé')).toBeNull();
    expect(screen.getByText('Score indisponible').className).toMatch(/(^| )sr-only( |$)/);
  });
});
