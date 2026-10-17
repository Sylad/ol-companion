import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createMemoryHistory, createRootRoute, createRouter } from '@tanstack/react-router';
import { CupMatchRow } from './cup-match-row';
import { seasonTeamLogoUrl } from '@/lib/calendar';
import { blend, contrast, token } from '@/test/contraste';
import type { CupMatch } from '@/types/api';

// L6 — revue UX de Coupes : cartes de match (t2 contrastes, t3 lien vers /match, t4 écussons CDN).

const game = (o: Partial<CupMatch> = {}): CupMatch => ({
  id: 4672,
  date: '2026-02-03T20:00:00.000Z',
  homeTeam: 'Lyon',
  homeTeamId: 465,
  awayTeam: 'Anderlecht',
  awayTeamId: 1234,
  homeScore: 2,
  awayScore: 1,
  status: 'FINISHED',
  stage: 'Phase de ligue — J1',
  stageFr: 'Phase de ligue',
  ...o,
});

async function renderRow(m: CupMatch) {
  const root = createRootRoute({ component: () => <CupMatchRow match={m} /> });
  const router = createRouter({ routeTree: root, history: createMemoryHistory({ initialEntries: ['/'] }) });
  const view = render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  await screen.findByRole('link');
  return view;
}

describe('L6 t3 — la carte mène au détail du match', () => {
  it('t3 — la carte est un lien /match/<id>?matchupId=<dom>-<ext>-<id>', async () => {
    await renderRow(game());
    const url = new URL(screen.getByRole('link').getAttribute('href')!, 'http://x');
    expect(url.pathname).toBe('/match/4672');
    expect(url.searchParams.get('matchupId')).toBe('465-1234-4672');
  });

  it('t3 — l’OL à 523 (football-data) est écrit 465 dans matchupId', async () => {
    await renderRow(game({ homeTeamId: 523 }));
    const url = new URL(screen.getByRole('link').getAttribute('href')!, 'http://x');
    expect(url.searchParams.get('matchupId')).toBe('465-1234-4672');
  });

  it('t3 — match joué : nom « A 2, B 1 — détail du match »', async () => {
    await renderRow(game());
    expect(screen.getByRole('link', { name: 'Olympique Lyonnais 2, Anderlecht 1 — détail du match' })).toBeInTheDocument();
  });

  it('t3 — match à venir : nom « A contre B — détail du match »', async () => {
    await renderRow(game({ status: 'SCHEDULED', homeScore: null, awayScore: null }));
    expect(screen.getByRole('link', { name: 'Olympique Lyonnais contre Anderlecht — détail du match' })).toBeInTheDocument();
  });

  it('t3 — le contenu de la carte (phase, date, issue) reste lu hors du lien étiré', async () => {
    const { container } = await renderRow(game());
    const lien = screen.getByRole('link');
    expect(lien.className).toMatch(/after:absolute/);
    expect(lien.className).toMatch(/after:inset-0/);
    expect(lien.closest('.relative')).not.toBeNull();
    expect(container.textContent).toContain('Terminé');
    expect(screen.getByLabelText('Victoire')).toBeInTheDocument();
  });

  it('t3 — tirs au but : le nom du lien ajoute « , <club> qualifié aux tirs au but » (WCAG 1.4.1)', async () => {
    await renderRow(game({ homeScore: 1, awayScore: 1, olQualified: true }));
    expect(
      screen.getByRole('link', {
        name: 'Olympique Lyonnais 1, Anderlecht 1, Olympique Lyonnais qualifié aux tirs au but — détail du match',
      }),
    ).toBeInTheDocument();
  });

  it('t3 — tirs au but perdus : le qualifié est l’adversaire', async () => {
    await renderRow(game({ homeScore: 1, awayScore: 1, olQualified: false }));
    expect(
      screen.getByRole('link', {
        name: 'Olympique Lyonnais 1, Anderlecht 1, Anderlecht qualifié aux tirs au but — détail du match',
      }),
    ).toBeInTheDocument();
  });

  it('t3 — le contour de focus est visible (focus-visible:outline)', async () => {
    await renderRow(game());
    expect(screen.getByRole('link').className).toMatch(/focus-visible:outline-ol-red-bright/);
  });
});

describe('L6 t4 — écussons du CDN 365scores', () => {
  it('t4 — chaque écusson vient de seasonTeamLogoUrl, sans passer par /api/wiki-image', async () => {
    await renderRow(game());
    const imgs = screen.getAllByRole('img');
    expect(imgs.map((i) => i.getAttribute('src'))).toEqual([seasonTeamLogoUrl(465), seasonTeamLogoUrl(1234)]);
  });
});

describe('L6 t2 — contrastes ≥ 4,5:1 des cartes', () => {
  const surface = token('surface');
  const entete = blend(token('surface-2'), surface, 0.4);

  it('t2 — la ligne du perdant n’est plus atténuée par opacity, son score est en fg-muted ≥ 4,5:1', async () => {
    const { container } = await renderRow(game());
    const lignes = container.querySelectorAll('.flex.items-center.gap-3');
    const perdant = [...lignes].find((l) => l.textContent?.includes('Anderlecht'))!;
    expect(perdant.className).not.toMatch(/opacity-/);
    const score = [...perdant.querySelectorAll('span')].find((s) => s.textContent === '1')!;
    expect(score.className).toMatch(/\btext-fg-muted\b/);
    expect(contrast(token('fg-muted'), surface)).toBeGreaterThanOrEqual(4.5);
  });

  it('t2 — la pastille D est lisible : texte bg sur fond loss-fg ≥ 4,5:1', async () => {
    await renderRow(game({ homeScore: 0, awayScore: 3 }));
    const pastille = screen.getByLabelText('Défaite');
    expect(pastille.className).toMatch(/\bbg-loss-fg\b/);
    expect(pastille.className).toMatch(/\btext-bg\b/);
    expect(contrast(token('bg'), token('loss-fg'))).toBeGreaterThanOrEqual(4.5);
  });

  it('t2 — l’en-tête de la carte (date, phase) reste ≥ 4,5:1', () => {
    expect(contrast(token('fg-dim'), entete)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(token('fg-muted'), entete)).toBeGreaterThanOrEqual(4.5);
  });
});
