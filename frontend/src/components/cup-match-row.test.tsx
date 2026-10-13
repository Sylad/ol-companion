import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CupMatchRow } from './cup-match-row';
import type { CupMatch } from '@/types/api';

// Heure locale construite à la main : le test ne dépend pas du fuseau de la machine.
const match = (status: CupMatch['status'], date: Date): CupMatch => ({
  id: 1,
  date: date.toISOString(),
  homeTeam: 'Lyon',
  homeTeamId: 523,
  awayTeam: 'Lille',
  awayTeamId: 79,
  homeScore: null,
  awayScore: null,
  status,
  stage: 'Quarts',
  stageFr: 'Quarts de finale',
});

function renderRow(m: CupMatch) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <CupMatchRow match={m} />
    </QueryClientProvider>,
  );
}

describe('<CupMatchRow /> (L101)', () => {
  it('écrit l\'heure d\'un match à venir « 21h00 », jamais « 21:00 »', () => {
    const { container } = renderRow(match('SCHEDULED', new Date(2026, 10, 3, 21, 0)));
    expect(container.textContent).toContain('21h00');
    expect(container.textContent).not.toMatch(/\d{2}:\d{2}/);
  });
  it('garde les minutes sur deux chiffres « 18h05 »', () => {
    const { container } = renderRow(match('SCHEDULED', new Date(2026, 10, 3, 18, 5)));
    expect(container.textContent).toContain('18h05');
  });
});

describe('<CupMatchRow /> — tirs au but (L140)', () => {
  const done = (o: Partial<CupMatch>) => ({ ...match('FINISHED', new Date(2026, 1, 3, 21, 0)), homeScore: 1, awayScore: 1, ...o });
  it('un nul gagné aux tirs au but : badge « Victoire », « t.a.b. » écrit', () => {
    const { getByLabelText, container } = renderRow(done({ olQualified: true }));
    expect(getByLabelText('Victoire')).toHaveTextContent('V');
    expect(container.textContent).toContain('t.a.b.');
  });
  it('un nul perdu aux tirs au but : badge « Défaite »', () => {
    const { getByLabelText } = renderRow(done({ olQualified: false }));
    expect(getByLabelText('Défaite')).toHaveTextContent('D');
  });
  it('un nul sans qualifié : badge « Match nul », pas de « t.a.b. »', () => {
    const { getByLabelText, container } = renderRow(done({}));
    expect(getByLabelText('Match nul')).toHaveTextContent('N');
    expect(container.textContent).not.toContain('t.a.b.');
  });
});

