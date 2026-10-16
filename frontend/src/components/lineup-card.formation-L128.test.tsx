import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { LiveMatchLineup, LiveMatchLineupPlayer } from '@/types/api';
import { LineupCard } from './lineup-card';

// L128 — à 320 px, un nom de club long (Fenerbahçe SK) ne doit pas couper « 4-2-3-1 » sur 2 lignes.
// jsdom ne mesure rien : on vérifie que la pastille déclare « ne pas casser, ne pas rétrécir »
// et que le titre, lui, cède la place en passant à la ligne (min-w-0, sans truncate : L160 ne tronque plus le nom du club).
const pl = (id: number, yardLine: number, yardSide: number): LiveMatchLineupPlayer => ({
  id, name: `J${id}`, shortName: `J${id}`, jerseyNumber: id, positionShort: 'CM', yardLine, yardSide, ranking: null,
});
const lineup: LiveMatchLineup = {
  formation: '4-2-3-1',
  starters: [
    pl(1, 1, 50),
    pl(2, 2, 15), pl(3, 2, 40), pl(4, 2, 60), pl(5, 2, 85),
    pl(6, 3, 35), pl(7, 3, 65),
    pl(8, 4, 20), pl(9, 4, 50), pl(10, 4, 80),
    pl(11, 5, 50),
  ],
  bench: [],
};

describe('L128 — pastille de formation sur une ligne', () => {
  it('la pastille ne se coupe pas et ne rétrécit pas, le titre cède', () => {
    render(<LineupCard lineup={lineup} teamName="Fenerbahçe SK" accent="blue" />);
    const chip = screen.getByTestId('formation-composition');
    expect(chip).toHaveTextContent('4-2-3-1');
    expect(chip.className).toContain('whitespace-nowrap');
    expect(chip.className).toContain('shrink-0');
    const title = screen.getByTestId('titre-composition');
    expect(title.className).not.toContain('truncate');
    expect(title.className).toContain('min-w-0');
  });
});
