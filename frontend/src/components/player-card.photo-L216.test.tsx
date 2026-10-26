import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { LineupPlayer } from '@/types/api';
import { PlayerCard } from './player-card';

// L216 — photo 365scores en 404 : la carte compacte du banc et la carte de l'Effectif remplacent l'<img> cassée par les initiales.

const joueur: LineupPlayer = {
  id: 1, athleteId: 266757, name: 'Angel García', shortName: 'Angel García', jerseyNumber: 14, position: 'Milieu',
  positionShort: 'MID', imageVersion: 7, yardLine: 0, yardSide: 0, ranking: null, isStarting: false,
};

describe('<PlayerCard /> — photo indisponible (L216)', () => {
  it.each([[true, 'banc (compacte)'], [false, 'Effectif']])('R1 — %s : l’image en erreur est remplacée par les initiales, sans <img>', (compact) => {
    const { container } = render(<PlayerCard player={joueur} compact={compact} />);
    fireEvent.error(screen.getByRole('img', { name: 'Angel García' }));
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText('AG')).toBeTruthy();
  });

  it('R2 — tant que la photo charge, l’<img> est affichée sans initiales', () => {
    const { container } = render(<PlayerCard player={joueur} compact />);
    expect(container.querySelector('img')).not.toBeNull();
    expect(screen.queryByText('AG')).toBeNull();
  });

  it.each([true, false])('L218 R2 — compact=%s : les initiales viennent du nom complet, pas de shortName', (compact) => {
    render(<PlayerCard player={{ ...joueur, name: 'Corentin Tolisso', shortName: 'Tolisso' }} compact={compact} />);
    fireEvent.error(screen.getByRole('img', { name: 'Corentin Tolisso' }));
    expect(screen.getByText('CT')).toBeTruthy();
  });
});

describe('<PlayerCard /> — version d’image 1 (L223)', () => {
  it.each([true, false])('R5 — compact=%s : imageVersion 1 = athlète sans image, initiales d’emblée, aucune <img> demandée', (compact) => {
    const { container } = render(<PlayerCard player={{ ...joueur, imageVersion: 1 }} compact={compact} />);
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText('AG')).toBeTruthy();
  });
});
