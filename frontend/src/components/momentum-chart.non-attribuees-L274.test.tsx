import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MomentumChart } from './momentum-chart';
import { unattributedNote } from '@/lib/momentum-note';

/** L274 (D-4) : une part d'actions sans équipe se dit sous le graphe ; le graphe se dit reconstruction. */
const points = Array.from({ length: 90 }, (_, i) => ({ minute: i + 1, value: i % 2 ? 30 : -30 }));
const base = { points, homeName: 'Lyon', awayName: 'Lillestrom', goalMinutes: [], homeIsOl: true };

describe('Momentum — actions sans équipe (L274)', () => {
  it('dit la part non attribuée quand il y en a', () => {
    render(<MomentumChart {...base} actions={{ home: 44, away: 0, unattributed: 27 }} />);
    expect(screen.getByTestId('elan-non-attribuees').textContent).toBe(
      '27 actions sur 71 (38 %) sans équipe reconnue : absentes du graphe.',
    );
  });

  it('ne dit rien quand tout est attribué, ou sans compte', () => {
    const { rerender } = render(<MomentumChart {...base} actions={{ home: 44, away: 27, unattributed: 0 }} />);
    expect(screen.queryByTestId('elan-non-attribuees')).toBeNull();
    rerender(<MomentumChart {...base} />);
    expect(screen.queryByTestId('elan-non-attribuees')).toBeNull();
  });

  it('singulier et part sous 1 %', () => {
    expect(unattributedNote({ home: 150, away: 100, unattributed: 1 })).toBe(
      '1 action sur 251 (moins de 1 %) sans équipe reconnue : absente du graphe.',
    );
  });

  it('dit que la courbe est une reconstruction (tirs, corners, coups francs), sans possession ni occasions franches', () => {
    render(<MomentumChart {...base} />);
    const txt = screen.getByTestId('elan').textContent ?? '';
    expect(txt).toContain('Reconstruction : tirs, corners, coups francs');
    expect(txt).toContain('sans possession ni occasions franches');
    expect(txt).toContain('Vers le haut : Lyon, vers le bas : Lillestrom.');
  });
});

describe('Momentum — en-tête avec un nom long (L274)', () => {
  it("la légende des clubs passe à la ligne au lieu de chevaucher le titre (Lillestrom, 1440 px)", () => {
    render(<MomentumChart {...base} />);
    const header = screen.getByTestId('elan').querySelector('header')!;
    expect(header.className).toContain('flex-wrap');
  });
});

