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

describe('L5/t2 — erreur des articles', () => {
  it('/api/news en 500 : un seul message en role=alert, Réessayer relance l\'appel, aucun message « Aucun article »', async () => {
    const fetchMock = renderPage(serve({ news: 'ERR' }));
    const alerte = await screen.findByTestId('news-erreur');
    expect(alerte).toHaveAttribute('role', 'alert');
    expect(alerte).toHaveTextContent('Impossible de charger les articles.');
    expect(screen.queryByText(/Aucun article/)).toBeNull();
    const avant = fetchMock.mock.calls.filter(([u]) => u === '/api/news').length;
    const bouton = screen.getByTestId('news-reessayer');
    expect(bouton.className).toMatch(/min-h-\[44px\]/);
    await userEvent.click(bouton);
    await vi.waitFor(() => expect(fetchMock.mock.calls.filter(([u]) => u === '/api/news').length).toBe(avant + 1));
  });
});

describe('L5/t4 — chaînes YouTube en erreur ou vides, articles vides', () => {
  it('chaînes en erreur : message + Réessayer qui relance', async () => {
    const fetchMock = renderPage(serve({ channels: 'ERR' }));
    const alerte = await screen.findByTestId('chaines-erreur');
    expect(alerte).toHaveAttribute('role', 'alert');
    const avant = fetchMock.mock.calls.filter(([u]) => u === '/api/youtube-channels').length;
    await userEvent.click(screen.getByTestId('chaines-reessayer'));
    await vi.waitFor(() => expect(fetchMock.mock.calls.filter(([u]) => u === '/api/youtube-channels').length).toBe(avant + 1));
  });

  it('chaînes vides : un message qui dit quoi faire', async () => {
    renderPage(serve({ channels: [] }));
    expect(await screen.findByTestId('chaines-vide')).toHaveTextContent(/Aucune chaîne.*reviens|revenez/i);
  });

  it('articles vides : un message qui dit quoi faire, sans parler de la source « Tous »', async () => {
    renderPage(serve({ news: [] }));
    const vide = await screen.findByTestId('news-vide');
    expect(vide).toHaveTextContent(/Aucun article pour le moment/);
    expect(vide).not.toHaveTextContent('Tous');
  });
});

describe('L5/t3 — pastilles de source', () => {
  it('groupe nommé, aria-pressed juste, anneau sur la pastille choisie, retour à la ligne, cibles 40 px sous lg', async () => {
    renderPage();
    const groupe = await screen.findByRole('group', { name: 'Filtrer par source' });
    expect(groupe.className).toMatch(/flex-wrap/);
    expect(groupe.className).not.toMatch(/overflow-x-auto/);
    const tous = within(groupe).getByRole('button', { name: 'Tous' });
    const gn = within(groupe).getByRole('button', { name: 'Google News' });
    expect(tous).toHaveAttribute('aria-pressed', 'true');
    expect(gn).toHaveAttribute('aria-pressed', 'false');
    expect(tous.className).toMatch(/ring-1/);
    expect(tous.className).toMatch(/ring-fg-muted/);
    expect(gn.className).not.toMatch(/ring-1/);
    expect(gn.className).toMatch(/min-h-10/);
    await userEvent.click(gn);
    expect(gn).toHaveAttribute('aria-pressed', 'true');
    expect(tous).toHaveAttribute('aria-pressed', 'false');
  });

  it('pas de pastille « Tous » seule : le groupe n\'existe qu\'avec des articles', async () => {
    renderPage(serve({ news: 'ERR' }));
    await screen.findByTestId('news-erreur');
    expect(screen.queryByRole('group', { name: 'Filtrer par source' })).toBeNull();
  });
});

describe('L5/t5 — premier écran au téléphone', () => {
  it('en-tête compact et articles avant les chaînes YouTube (ordre du DOM = ordre visuel)', async () => {
    renderPage();
    await screen.findByRole('heading', { name: 'Chaînes YouTube recommandées' });
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1.closest('header')).toHaveAttribute('data-compact');
    const titres = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(titres).toEqual(['À la une', 'Chaînes YouTube recommandées']);
  });
});
