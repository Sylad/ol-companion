import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { LiveMatchLineup, LiveMatchLineupPlayer } from '@/types/api';
import { LineupCard } from './lineup-card';

// L136 — au retour à la ligne, « Tagliafico, 2 ⏎ Bidstrup » séparait le numéro de son nom
// et le numéro se lisait comme celui du joueur précédent. jsdom ne mesure rien : on vérifie
// que numéro et nom sont dans un même élément insécable, et que la virgule reste dehors
// (la ligne se coupe après la virgule, jamais entre le numéro et le nom).
const pl = (id: number, shortName: string, jerseyNumber: number | null): LiveMatchLineupPlayer => ({
  id, name: shortName, shortName, jerseyNumber, positionShort: 'CM', yardLine: 1, yardSide: 50, ranking: null,
});
const lineup: LiveMatchLineup = {
  formation: '4-4-2',
  starters: [],
  bench: [pl(1, 'Tagliafico', 3), pl(2, 'Bidstrup', 2), pl(3, 'De Bruyne', null)],
};

describe('L136 — banc : numéro et nom insécables', () => {
  it('chaque remplaçant tient dans un seul élément sans retour à la ligne', () => {
    render(<LineupCard lineup={lineup} teamName="OL" accent="blue" />);
    const items = screen.getAllByTestId('joueur-banc');
    expect(items).toHaveLength(3);
    items.forEach((el) => expect(el.className).toContain('whitespace-nowrap'));
    expect(items[1]).toHaveTextContent(/^2\s+Bidstrup$/);
    expect(items[2]).toHaveTextContent(/^De Bruyne$/);
  });

  it('la virgule reste hors des éléments insécables', () => {
    render(<LineupCard lineup={lineup} teamName="OL" accent="blue" />);
    expect(screen.getByTestId('banc-composition')).toHaveTextContent('3 Tagliafico, 2 Bidstrup, De Bruyne');
    screen.getAllByTestId('joueur-banc').forEach((el) => expect(el.textContent).not.toContain(','));
  });
});
