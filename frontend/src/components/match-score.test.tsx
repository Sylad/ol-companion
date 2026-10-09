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
});
