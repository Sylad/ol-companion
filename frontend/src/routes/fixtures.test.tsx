import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import season from '@/test/fixtures/season-matches-2026-10-03.json';
import { FixturesPage } from './fixtures';

// L39 — le calendrier liste toutes les compétitions où l'OL joue, depuis
// /api/season-matches, et n'affiche jamais une heure qui n'est pas fixée.
// Charge : la saison que 365scores servait le 03-10-2026 (42 matchs).

const okJson = (body: unknown) => ({ ok: true, status: 200, json: async () => body });
const notFound = { ok: false, status: 404, json: async () => ({}) };

function serve(seasonMatches: unknown = season) {
  return vi.fn((url: string) => {
    if (url === '/api/season-matches') return Promise.resolve(okJson(seasonMatches));
    if (url.startsWith('/api/wiki-image')) return Promise.resolve(okJson({ imageUrl: null }));
    return Promise.resolve(notFound);
  });
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <FixturesPage />
    </QueryClientProvider>,
  );
}

/** Le bloc (carte) dont l'en-tête porte ce libellé. */
function block(label: string): HTMLElement {
  const heading = screen.getByRole('heading', { level: 3, name: label });
  return heading.parentElement as HTMLElement;
}

describe('<FixturesPage /> — toutes compétitions (L39)', () => {
  const previousTz = process.env.TZ;
  beforeAll(() => {
    process.env.TZ = 'Europe/Paris';
  });
  afterAll(() => {
    process.env.TZ = previousTz;
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('liste les 42 matchs de la saison et les compte : Tout 42, À venir 36, Joués 6', async () => {
    const fetchMock = serve();
    vi.stubGlobal('fetch', fetchMock);
    renderPage();

    expect(await screen.findAllByRole('article')).toHaveLength(42);
    const status = screen.getByRole('group', { name: 'Filtrer par statut' });
    expect(within(status).getAllByRole('button').map((b) => b.textContent)).toEqual([
      'Tout42',
      'À venir36',
      'Joués6',
    ]);
    expect(screen.getByText('Matchs listés').nextElementSibling).toHaveTextContent('42');
    // Une seule source pour un match : la page ne lit plus /api/fixtures.
    const urls = fetchMock.mock.calls.map(([url]) => url);
    expect(urls).toContain('/api/season-matches');
    expect(urls).not.toContain('/api/fixtures');
  });

  it('montre les matchs de Ligue Europa à leur date, avec leur compétition', async () => {
    vi.stubGlobal('fetch', serve());
    renderPage();
    await screen.findAllByRole('article');

    const palace = within(block('UEFA Europa League · J2')).getByRole('article');
    expect(palace).toHaveTextContent('Lyon');
    expect(palace).toHaveTextContent('Crystal Palace');
    expect(palace).toHaveTextContent('Jeu. 15');
    expect(palace).toHaveTextContent('18:45');

    const anderlecht = within(block('UEFA Europa League · J1')).getByRole('article');
    expect(anderlecht).toHaveTextContent('Anderlecht');
    expect(anderlecht).toHaveTextContent('Terminé');
  });

  it('garde la journée, le score et l’heure des matchs de Ligue 1', async () => {
    vi.stubGlobal('fetch', serve());
    renderPage();
    await screen.findAllByRole('article');

    const rennes = within(block('Ligue 1 · J5')).getByRole('article');
    expect(rennes).toHaveTextContent('Lyon4');
    expect(rennes).toHaveTextContent('Rennes0');
    expect(rennes).toHaveTextContent('Terminé');

    const lens = within(block('Ligue 1 · J6')).getByRole('article');
    expect(lens).toHaveTextContent('Ven. 09');
    expect(lens).toHaveTextContent('20:45');
  });

  it('suit l’ordre des dates, toutes compétitions mêlées', async () => {
    vi.stubGlobal('fetch', serve());
    renderPage();
    await screen.findAllByRole('article');

    const labels = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(labels.slice(0, 8)).toEqual([
      'Ligue 1 · J1',
      'Ligue 1 · J2',
      'Ligue 1 · J3',
      'Ligue 1 · J4',
      'UEFA Europa League · J1',
      'Ligue 1 · J5',
      'Ligue 1 · J6',
      'UEFA Europa League · J2',
    ]);
    expect(labels[labels.length - 1]).toBe('Ligue 1 · J34');
  });

  it('heure non fixée : « Horaire à confirmer », jamais une heure inventée', async () => {
    vi.stubGlobal('fetch', serve());
    renderPage();
    const articles = await screen.findAllByRole('article');

    // J13 Troyes–Lyon : football-data sans heure, 365scores à 18:00 de remplissage.
    const troyes = within(block('Ligue 1 · J13')).getByRole('article');
    expect(troyes).toHaveTextContent('Horaire à confirmer');
    expect(troyes).not.toHaveTextContent(/\d{2}:\d{2}/);

    // 21 matchs de Ligue 1 sans heure fixée ce jour-là ; aucun n'affiche d'heure.
    const unconfirmed = articles.filter((a) => a.textContent?.includes('Horaire à confirmer'));
    expect(unconfirmed).toHaveLength(21);
    expect(unconfirmed.some((a) => /\d{2}:\d{2}/.test(a.textContent ?? ''))).toBe(false);
    // Et « 01:00 » (minuit UTC lu à Paris) n'apparaît nulle part.
    expect(screen.queryByText('01:00')).not.toBeInTheDocument();
  });

  it('prend les écussons au CDN de 365scores, par identifiant de club, sans appel /api/wiki-image par ligne', async () => {
    const fetchMock = serve();
    vi.stubGlobal('fetch', fetchMock);
    renderPage();
    await screen.findAllByRole('article');

    const palace = within(block('UEFA Europa League · J2')).getByRole('article');
    const logos = within(palace).getAllByRole('img');
    expect(logos.map((img) => img.getAttribute('src'))).toEqual([
      // L'OL porte l'identifiant football-data (523) dans l'API : repris en 465.
      expect.stringMatching(/imagecache\.365scores\.com\/.*\/Competitors\/465$/),
      expect.stringMatching(/imagecache\.365scores\.com\/.*\/Competitors\/10$/),
    ]);
    // 84 écussons affichés ; seul l'en-tête de page interroge encore wiki-image.
    expect(screen.getAllByRole('article').flatMap((a) => within(a).getAllByRole('img'))).toHaveLength(84);
    const wikiCalls = fetchMock.mock.calls.filter(([url]) => url.startsWith('/api/wiki-image'));
    expect(wikiCalls.length).toBeLessThanOrEqual(1);
  });

  it('les onglets de statut filtrent toujours la liste', async () => {
    vi.stubGlobal('fetch', serve());
    const user = userEvent.setup();
    renderPage();
    await screen.findAllByRole('article');
    const status = screen.getByRole('group', { name: 'Filtrer par statut' });

    await user.click(within(status).getByRole('button', { name: /Joués/ }));
    expect(screen.getAllByRole('article')).toHaveLength(6);
    expect(within(status).getByRole('button', { name: /Joués/ })).toHaveAttribute('aria-pressed', 'true');

    await user.click(within(status).getByRole('button', { name: /À venir/ }));
    expect(screen.getAllByRole('article')).toHaveLength(36);
  });

  it('le filtre par compétition restreint la liste, les compteurs et la vue rapide', async () => {
    vi.stubGlobal('fetch', serve());
    const user = userEvent.setup();
    renderPage();
    await screen.findAllByRole('article');
    const competitions = screen.getByRole('group', { name: 'Filtrer par compétition' });
    expect(within(competitions).getAllByRole('button').map((b) => b.textContent)).toEqual([
      'Toutes42',
      'Ligue 134',
      'Europa8',
    ]);

    await user.click(within(competitions).getByRole('button', { name: /Europa League/ }));

    expect(screen.getAllByRole('article')).toHaveLength(8);
    const status = screen.getByRole('group', { name: 'Filtrer par statut' });
    expect(within(status).getAllByRole('button').map((b) => b.textContent)).toEqual([
      'Tout8',
      'À venir7',
      'Joués1',
    ]);
    expect(screen.getByText('Matchs listés').nextElementSibling).toHaveTextContent('8');
    expect(screen.queryByRole('heading', { level: 3, name: /Ligue 1/ })).not.toBeInTheDocument();

    await user.click(within(competitions).getByRole('button', { name: /Toutes/ }));
    expect(screen.getAllByRole('article')).toHaveLength(42);
  });

  it('une seule compétition dans la saison : pas de filtre par compétition', async () => {
    const ligue1Only = season.filter((m) => m.competitionCode === 'L1');
    vi.stubGlobal('fetch', serve(ligue1Only));
    renderPage();

    expect(await screen.findAllByRole('article')).toHaveLength(34);
    expect(screen.queryByRole('group', { name: 'Filtrer par compétition' })).not.toBeInTheDocument();
  });
});
