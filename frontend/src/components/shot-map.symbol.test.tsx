import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ShotMap } from './shot-map';

describe('ShotMap — sigle vide', () => {
  it('R5 — les libellés d\'attaque portent le club même si 365scores renvoie un sigle vide', () => {
    const shot = { playerId: 1, competitorId: 10, time: 5, line: 50, side: 80, xg: 0.2, outcome: 'Saved' } as never;
    render(<ShotMap shots={[shot]} homeId={10} homeIsOl homeName="Lyon" awayName="Lens" homeSymbol="" awaySymbol="" />);
    expect(screen.getByText(/← LEN attaque/)).toBeTruthy();
    expect(screen.getByText(/OL attaque →/)).toBeTruthy();
  });
});
