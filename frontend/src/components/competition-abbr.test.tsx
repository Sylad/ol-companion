import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CompetitionAbbr } from './competition-abbr';

describe('<CompetitionAbbr />', () => {
  it.each([
    ['UCL', 'C1', 'Ligue des champions'],
    ['UEL', 'C3', 'Ligue Europa'],
    ['CDF', 'CdF', 'Coupe de France'],
    ['L1', 'L1', 'Ligue 1'],
  ] as const)('%s : affiche « %s », nom long « %s » en infobulle et en texte masqué', (code, short, long) => {
    render(<CompetitionAbbr code={code} />);
    expect(screen.getByText(short)).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByTitle(long)).toBeInTheDocument();
  });

  it('expose le nom long au lecteur d\'écran, sans lire le sigle', () => {
    const { container } = render(<CompetitionAbbr code="UCL" />);
    expect(screen.getByText('Ligue des champions')).toHaveClass('sr-only');
    expect(screen.getByText('C1')).toHaveAttribute('aria-hidden', 'true');
    expect(container.querySelector('abbr')).not.toHaveClass('no-underline');
  });
});
