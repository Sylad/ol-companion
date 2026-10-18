import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createMemoryHistory, createRootRoute, createRouter } from '@tanstack/react-router';
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

// La carte est un lien vers /match (L6 t3) : elle vit dans un routeur.
async function renderRow(m: CupMatch) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const root = createRootRoute({ component: () => <CupMatchRow match={m} /> });
  const router = createRouter({ routeTree: root, history: createMemoryHistory({ initialEntries: ['/'] }) });
  const view = render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  await screen.findByRole('link');
  return view;
}

describe('<CupMatchRow /> (L101)', () => {
  it('écrit l\'heure d\'un match à venir « 21h00 », jamais « 21:00 »', async () => {
    const { container } = await renderRow(match('SCHEDULED', new Date(2026, 10, 3, 21, 0)));
    expect(container.textContent).toContain('21h00');
    expect(container.textContent).not.toMatch(/\d{2}:\d{2}/);
  });
  it('garde les minutes sur deux chiffres « 18h05 »', async () => {
    const { container } = await renderRow(match('SCHEDULED', new Date(2026, 10, 3, 18, 5)));
    expect(container.textContent).toContain('18h05');
  });
});

describe('<CupMatchRow /> — tirs au but (L140)', () => {
  const done = (o: Partial<CupMatch>) => ({ ...match('FINISHED', new Date(2026, 1, 3, 21, 0)), homeScore: 1, awayScore: 1, ...o });
  it('un nul gagné aux tirs au but : badge « Victoire », « t.a.b. » écrit', async () => {
    const { getByLabelText, container } = await renderRow(done({ olQualified: true }));
    expect(getByLabelText('Victoire')).toHaveTextContent('V');
    expect(container.textContent).toContain('t.a.b.');
  });
  it('la pastille a un rôle (img) : son aria-label est lu par les lecteurs d\'écran', async () => {
    const { getByRole } = await renderRow(done({ olQualified: false }));
    expect(getByRole('img', { name: 'Défaite' })).toHaveTextContent('D');
  });
  it('un nul perdu aux tirs au but : badge « Défaite »', async () => {
    const { getByLabelText } = await renderRow(done({ olQualified: false }));
    expect(getByLabelText('Défaite')).toHaveTextContent('D');
  });
  it('l\'infobulle de « t.a.b. » dit la même chose que la pastille', async () => {
    const won = await renderRow(done({ olQualified: true }));
    expect(won.container.querySelector('abbr')).toHaveAttribute('title', 'Qualifié aux tirs au but');
    won.unmount();
    const lost = await renderRow(done({ olQualified: false }));
    expect(lost.container.querySelector('abbr')).toHaveAttribute('title', 'Éliminé aux tirs au but');
  });
  // jsdom ne pose pas la mise en page : on vérifie que les porteurs d'infobulle sont positionnés
  // au-dessus du lien étiré (z-10), sinon la souris ne les atteint pas (elementFromPoint → le lien).
  it('la pastille et « t.a.b. » passent au-dessus du lien étiré : leurs infobulles restent atteignables', async () => {
    const { getByLabelText, container } = await renderRow(done({ olQualified: true }));
    for (const el of [getByLabelText('Victoire'), container.querySelector('abbr')!]) {
      expect(el).toHaveClass('relative');
      expect(el).toHaveClass('z-20');
    }
    expect(getByLabelText('Victoire')).toHaveAttribute('title', 'Qualifié aux tirs au but');
  });
  it('un nul sans qualifié : badge « Match nul », pas de « t.a.b. »', async () => {
    const { getByLabelText, container } = await renderRow(done({}));
    expect(getByLabelText('Match nul')).toHaveTextContent('N');
    expect(container.textContent).not.toContain('t.a.b.');
  });
});

