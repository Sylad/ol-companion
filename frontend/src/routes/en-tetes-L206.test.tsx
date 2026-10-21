import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement } from 'react';

// L206 — WCAG 2.4.6 / 1.3.1 : chaque page a UN h1 qui porte le nom de la page ; le bandeau
// « Olympique Lyonnais » (KnowledgeHeader) n'est plus un titre. Les requêtes échouent (503) :
// le h1 doit être là aussi quand les données manquent. Leaflet n'a pas de sens sous jsdom.
vi.mock('@tanstack/react-router', () => ({
  useSearch: () => ({}),
  useNavigate: () => vi.fn(),
  useParams: () => ({}),
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => <a href={to}>{children}</a>,
}));
vi.mock('@/components/ligue1-map', () => ({ Ligue1Map: () => <div /> }));

import { DashboardPage } from './index';
import { FixturesPage } from './fixtures';
import { StandingsPage } from './standings';
import { PlayersPage } from './players';
import { NewsPage } from './news';
import { CupsPage } from './cups';
import { MapPage } from './map';

const PAGES: [nom: string, page: () => ReactElement, h1: string][] = [
  ['Dashboard', () => <DashboardPage />, 'Dashboard'],
  ['Calendrier', () => <FixturesPage />, 'Calendrier'],
  ['Classement', () => <StandingsPage />, 'Classement'],
  ['Joueurs', () => <PlayersPage />, 'Joueurs'],
  ['Actu', () => <NewsPage />, 'Actu'],
  ['Coupes', () => <CupsPage />, 'Coupes'],
  ['Carte L1', () => <MapPage />, 'Carte Ligue 1'],
];

function rendre(page: () => ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{page()}</QueryClientProvider>);
}

describe('L206 — un h1 par page, au nom de la page', () => {
  afterEach(() => vi.unstubAllGlobals());

  it.each(PAGES)('R1 — %s : un seul h1, le nom de la page (pas « Olympique Lyonnais »)', async (_nom, page, h1) => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: false, status: 503, json: async () => ({}) })));
    rendre(page);
    const titres = screen.getAllByRole('heading', { level: 1 });
    expect(titres).toHaveLength(1);
    expect(titres[0]).toHaveAccessibleName(h1);
  });

  it.each(PAGES)('R2 — %s : le bandeau OL reste à l’écran, hors des titres', async (_nom, page) => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: false, status: 503, json: async () => ({}) })));
    const { container } = rendre(page);
    const bandeau = container.querySelector('header')!;
    expect(bandeau).toHaveTextContent('Olympique Lyonnais');
    expect(bandeau.querySelector('h1, h2, h3')).toBeNull();
  });

  it('R3 — Joueurs : le titre « Joueurs » est visible (pas sr-only)', () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: false, status: 503, json: async () => ({}) })));
    rendre(() => <PlayersPage />);
    expect(screen.getByRole('heading', { level: 1, name: 'Joueurs' }).className).not.toMatch(/sr-only/);
  });
});
