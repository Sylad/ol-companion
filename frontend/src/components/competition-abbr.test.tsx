import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CompetitionAbbr } from './competition-abbr';

describe('<CompetitionAbbr />', () => {
  it.each([
    ['UCL', 'C1', 'Ligue des champions'],
    ['UEL', 'C3', 'Ligue Europa'],
    ['CDF', 'CdF', 'Coupe de France'],
    ['L1', 'L1', 'Ligue 1'],
  ] as const)('%s : affiche « %s », nom long « %s » en infobulle', (code, short, long) => {
    render(<CompetitionAbbr code={code} />);
    expect(screen.getByText(short)).toHaveAttribute('title', long);
  });
});
