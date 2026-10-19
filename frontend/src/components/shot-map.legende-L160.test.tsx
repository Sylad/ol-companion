import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ShotMap } from './shot-map';

// L160 — revue UX de conformité : la légende répétait le nom (« LYO LYON · REN RENNES ») quand 365scores ne donne pas de sigle.
const shot = (side: number, line: number) =>
  ({ playerId: 1, competitorId: 10, time: 5, line, side, xg: 0.2, outcome: 'Saved' }) as never;

const renderMap = (props: { homeIsOl: boolean; homeName: string; awayName: string; homeSymbol?: string; awaySymbol?: string }) =>
  render(
    <ShotMap
      shots={[shot(92, 50), shot(8, 50)]}
      homeId={10}
      homeIsOl={props.homeIsOl}
      homeName={props.homeName}
      awayName={props.awayName}
      homeSymbol={props.homeSymbol ?? ''}
      awaySymbol={props.awaySymbol ?? ''}
    />,
  );

describe('ShotMap — légende réduite au nom quand le sigle n\'est qu\'un repli (L160)', () => {
  it('R5 — sans sigle de 365scores : « OL Lyon · Rennes », pas « LYO LYON · REN RENNES »', () => {
    renderMap({ homeIsOl: true, homeName: 'Lyon', awayName: 'Rennes' });
    const carte = screen.getByTestId('carte-tirs');
    const entete = within(carte).getByRole('heading', { level: 2 }).closest('header') as HTMLElement;
    expect(within(entete).getByText('OL Lyon')).toBeTruthy();
    expect(within(entete).getByText('Rennes')).toBeTruthy();
    expect(entete.textContent).not.toMatch(/LYO|REN\b/);
  });

  it('R5 — avec un vrai sigle adverse, la légende garde « RCL Lens »', () => {
    renderMap({ homeIsOl: true, homeName: 'Lyon', awayName: 'Lens', homeSymbol: 'OL', awaySymbol: 'RCL' });
    const carte = screen.getByTestId('carte-tirs');
    expect(within(carte).getByText('OL Lyon')).toBeTruthy();
    expect(within(carte).getByText('RCL Lens')).toBeTruthy();
    expect(within(carte).getByText(/RCL attaque ↑|↓ RCL attaque/)).toBeTruthy();
  });
});
