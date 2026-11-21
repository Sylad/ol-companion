import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import season from '@/test/fixtures/season-matches-2026-10-03.json';
import { AboutPage } from './about';
import { MapPage } from './map';
import { FixturesPage } from './fixtures';
import { DashboardPage } from './index';

// L267 — conditions de football-data.org, § 7.1 : « You agree to include the following attribution to
// Football-Data in your app or website: "Football data provided by the Football-Data.org API" »
// (docs/etudes/365scores-conditions.md § 5). La mention, mot pour mot, là où ses données s'affichent
// (heure du coup d'envoi des matchs de Ligue 1 : calendrier, accueil, carte ; page de match : voir
// match.sources-L235.test.tsx) et sur la page À propos.

const MENTION = 'Football data provided by the Football-Data.org API';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => <a href={String(to)}>{children}</a>,
}));
vi.mock('@/components/ligue1-map', () => ({ Ligue1Map: () => <div /> }));
vi.mock('@/components/knowledge-header', () => ({ KnowledgeHeader: () => null }));
vi.mock('@/components/dashboard-hero', () => ({ DashboardHero: () => null }));
vi.mock('@/components/dashboard-stats', () => ({ DashboardStats: () => null }));
vi.mock('@/components/last-result', () => ({ LastResult: () => null }));
vi.mock('@/components/live-match-card', () => ({ LiveMatchCard: () => null }));
vi.mock('@/components/season-summary', () => ({ SeasonSummary: () => null }));
vi.mock('@/components/position-tracker', () => ({ PositionTracker: () => null }));

const okJson = (body: unknown) => ({ ok: true, status: 200, json: async () => body });

function withQuery(ui: React.ReactNode) {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) =>
      Promise.resolve(url === '/api/season-matches' ? okJson(season) : okJson({ imageUrl: null })),
    ),
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

/** La mention exacte, en lien vers football-data.org, balisée en anglais (WCAG 3.1.2). */
async function expectMention(): Promise<HTMLElement> {
  const lien = await screen.findByTestId('attribution-football-data');
  expect(lien.textContent).toBe(MENTION);
  expect(lien.tagName).toBe('A');
  expect(lien.getAttribute('href')).toBe('https://www.football-data.org/');
  expect(lien.getAttribute('target')).toBe('_blank');
  expect(lien.getAttribute('rel')).toBe('noopener noreferrer');
  expect(lien.getAttribute('lang')).toBe('en');
  expect(screen.getAllByTestId('attribution-football-data')).toHaveLength(1);
  return lien;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('L267 — mention de football-data.org', () => {
  it('À propos : la mention, avec ce que football-data fournit', async () => {
    render(<AboutPage />);
    await expectMention();
    expect(screen.getByTestId('source-football-data').textContent).toMatch(/heures des coups d’envoi de Ligue 1/i);
  });

  it('Calendrier : la mention sous la liste des matchs', async () => {
    withQuery(<FixturesPage />);
    const lien = await expectMention();
    const liste = screen.getByTestId('liste-mois');
    expect(liste.compareDocumentPosition(lien) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(screen.getByTestId('source-football-data')).getByText(MENTION)).toBe(lien);
    expect(screen.getByTestId('source-football-data').textContent).toMatch(/^Heures des coups d’envoi de Ligue 1/);
  });

  it('Accueil : la mention en pied de page (heure du prochain match de Ligue 1)', async () => {
    withQuery(<DashboardPage />);
    await expectMention();
    expect(screen.getByTestId('source-football-data').className).toContain('text-fg-dim');
    // Même libellé qu'au calendrier et sur la carte : « Heures », au pluriel (revue r1 de L267).
    expect(screen.getByTestId('source-football-data').textContent).toMatch(/^Heures des coups d’envoi de Ligue 1/);
  });

  it('Carte : la mention avec les crédits de la carte', async () => {
    withQuery(<MapPage />);
    const lien = await expectMention();
    expect(lien.parentElement?.textContent).toContain('© les contributeurs d’OpenStreetMap');
  });
});
