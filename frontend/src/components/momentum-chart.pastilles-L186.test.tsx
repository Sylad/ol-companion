import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MomentumChart } from './momentum-chart';

describe('MomentumChart — pastilles de but (L186)', () => {
  it('R16 — la couche des pastilles ne coupe pas un rond posé sur une barre au maximum (overflow visible)', () => {
    const points = Array.from({ length: 90 }, (_, i) => ({ minute: i + 1, value: i === 29 ? 100 : 20 }));
    const { container } = render(
      <MomentumChart points={points} homeName="OL" awayName="RCL" goalMinutes={[{ minute: 30, home: true }]} homeIsOl />,
    );
    const couche = container.querySelector('svg[aria-hidden="true"]');
    expect(couche).not.toBeNull();
    expect(couche!.classList.contains('overflow-visible')).toBe(true);
    expect(couche!.querySelector('circle')).not.toBeNull();
  });
});
