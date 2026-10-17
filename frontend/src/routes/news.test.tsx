import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NewsPage } from './news';

// L5 — revue UX d'Actualités (17-10-2026). Un test par règle des sous-tâches t1 à t7.

const okJson = (body: unknown) => ({ ok: true, status: 200, json: async () => body });
const ko = { ok: false, status: 500, json: async () => ({}) };

const CHANNELS = [
  { id: 'c1', name: 'Olympique Lyonnais TV', handle: '@ol', url: 'https://yt/ol', type: 'official', priority: true, description: 'Officielle' },
  { id: 'c2', name: 'Chaîne à très long nom de créateur', handle: '@x', url: 'https://yt/x', type: 'creator', priority: false, description: 'Créateur' },
];

const NEWS = [
  { title: 'OL gagne', link: 'https://ol.fr/1', pubDate: '2026-10-17T10:00:00Z', source: 'Olympique et Lyonnais', description: 'Résumé du match', image: 'https://img/1.jpg' },
  { title: 'Mercato : une piste - Le Progrès', link: 'https://gn/2', pubDate: '2026-10-17T09:00:00Z', source: 'Google News', description: 'Mercato : une piste  Le Progrès' },
  { title: 'Autre sujet - L\'Équipe', link: 'https://gn/3', pubDate: '2026-10-17T08:00:00Z', source: 'Google News', description: 'Un vrai résumé distinct' },
];

function serve(opts: { news?: unknown; channels?: unknown } = {}) {
  const news = 'news' in opts ? opts.news : NEWS;
  const channels = 'channels' in opts ? opts.channels : CHANNELS;
  return vi.fn((url: string) => {
    if (url === '/api/news') return Promise.resolve(news === 'ERR' ? ko : okJson(news));
    if (url === '/api/youtube-channels') return Promise.resolve(channels === 'ERR' ? ko : okJson(channels));
    if (url.startsWith('/api/wiki-image')) return Promise.resolve(okJson({ imageUrl: null }));
    if (url.startsWith('/api/standings')) return Promise.resolve(ko);
    return Promise.resolve(ko);
  });
}

function renderPage(fetchMock = serve()) {
  vi.stubGlobal('fetch', fetchMock);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <NewsPage />
    </QueryClientProvider>,
  );
  return fetchMock;
}

afterEach(() => vi.unstubAllGlobals());

describe('L5/t1 — cartes de chaînes YouTube contenues dans leur section', () => {
  it('la grille a une colonne explicite et la carte peut rétrécir (min-w-0), le nom passe à la ligne', async () => {
    renderPage();
    const link = await screen.findByRole('link', { name: /Olympique Lyonnais TV/ });
    expect(link.className).toMatch(/(^| )min-w-0( |$)/);
    expect(link.parentElement!.className).toMatch(/(^| )grid-cols-1( |$)/);
    const nom = within(link).getByRole('heading', { name: 'Olympique Lyonnais TV' });
    expect(nom.className).not.toMatch(/truncate/);
    expect(nom.className).toMatch(/break-words/);
  });
});
