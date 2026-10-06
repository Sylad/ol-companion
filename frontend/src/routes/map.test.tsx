import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import season from '@/test/fixtures/season-matches-2026-10-03.json';
import { MapPage } from './map';

// L40 — l'eyebrow « Saison … » de /map vient des matchs servis. Leaflet n'a pas
// de sens sous jsdom : la carte est remplacée par un bouchon.
vi.mock('@/components/ligue1-map', () => ({ Ligue1Map: () => <div /> }));
vi.mock('@/components/knowledge-header', () => ({ KnowledgeHeader: () => null }));

describe('<MapPage /> — libellé de saison (L40)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('affiche la saison des matchs servis, pas la date du jour', async () => {
    // Décalée d'un an : 2027-28, que ni un libellé en dur ni `now` (2026-27) ne donnent.
    const shifted = season.map((m) => ({
      ...m,
      date: m.date.replace(/^(\d{4})/, (y) => String(Number(y) + 1)),
    }));
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({ ok: true, status: 200, json: async () => shifted }),
      ),
    );
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <MapPage />
      </QueryClientProvider>,
    );

    expect(await screen.findByText('Saison 2027-28')).toBeInTheDocument();
  });
});
