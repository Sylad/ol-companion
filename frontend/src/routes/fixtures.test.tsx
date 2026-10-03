import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import season from '@/test/fixtures/season-matches-2026-10-03.json';
import { FixturesPage } from './fixtures';

// L39 — le calendrier liste toutes les compétitions où l'OL joue, depuis
// /api/season-matches, et n'affiche jamais une heure qui n'est pas fixée.
// Charge : la saison que 365scores servait le 03-10-2026 (46 matchs, dont les
// 4 qualifications de Ligue des champions d'août).

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

  it('liste les 46 matchs de la saison et les compte : Tout 46, À venir 36, Joués 10', async () => {
    const fetchMock = serve();
    vi.stubGlobal('fetch', fetchMock);
    renderPage();

    expect(await screen.findAllByRole('article')).toHaveLength(46);
    const status = screen.getByRole('group', { name: 'Filtrer par statut' });
    expect(within(status).getAllByRole('button').map((b) => b.textContent)).toEqual([
      'Tout46',
      'À venir36',
      'Joués10',
    ]);
    expect(screen.getByText('Matchs listés').nextElementSibling).toHaveTextContent('46');
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

  it('montre les 4 qualifications de Ligue des champions d’août à leur date, avec leur tour, leur manche et leur score', async () => {
    vi.stubGlobal('fetch', serve());
    renderPage();
    await screen.findAllByRole('article');

    const row = (label: string) => within(block(label)).getByRole('article');

    const spartaAway = row('UEFA Champions League · 3e tour de qualification · aller');
    expect(spartaAway).toHaveTextContent('Mar. 04');
    expect(spartaAway).toHaveTextContent('08');
    expect(spartaAway).toHaveTextContent('Sparta Praha2');
    expect(spartaAway).toHaveTextContent('Lyon1');

    const spartaHome = row('UEFA Champions League · 3e tour de qualification · retour');
    expect(spartaHome).toHaveTextContent('Mar. 11');
    expect(spartaHome).toHaveTextContent('Lyon3');
    expect(spartaHome).toHaveTextContent('Sparta Praha0');

    const fenerAway = row('UEFA Champions League · Barrages · aller');
    expect(fenerAway).toHaveTextContent('Mar. 18');
    expect(fenerAway).toHaveTextContent('Fenerbahçe SK1');
    expect(fenerAway).toHaveTextContent('Lyon1');

    const fenerHome = row('UEFA Champions League · Barrages · retour');
    expect(fenerHome).toHaveTextContent('Mer. 26');
    expect(fenerHome).toHaveTextContent('Lyon1');
    expect(fenerHome).toHaveTextContent('Fenerbahçe SK2');

    for (const article of [spartaAway, spartaHome, fenerAway, fenerHome]) {
      expect(article).toHaveTextContent('Terminé');
    }
    // Bilan toutes compétitions : 5 V, 3 N, 2 D.
    const quick = screen.getByText('Vue rapide').parentElement as HTMLElement;
    expect(quick).toHaveTextContent('5V3N2D');
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
    expect(labels.slice(0, 12)).toEqual([
      'UEFA Champions League · 3e tour de qualification · aller',
      'UEFA Champions League · 3e tour de qualification · retour',
      'UEFA Champions League · Barrages · aller',
      'Ligue 1 · J1',
      'UEFA Champions League · Barrages · retour',
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
    // 92 écussons affichés ; seul l'en-tête de page interroge encore wiki-image.
    expect(screen.getAllByRole('article').flatMap((a) => within(a).getAllByRole('img'))).toHaveLength(92);
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
    expect(screen.getAllByRole('article')).toHaveLength(10);
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
      'Toutes46',
      'Ligue 134',
      'Champions4',
      'Europa8',
    ]);
    // La somme des pastilles égale « Toutes » : aucun match hors pastille.
    const [all, ...perCompetition] = within(competitions)
      .getAllByRole('button')
      .map((b) => Number(b.querySelector('span')?.textContent));
    expect(perCompetition.reduce((sum, n) => sum + n, 0)).toBe(all);

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

    await user.click(within(competitions).getByRole('button', { name: /Champions League/ }));
    expect(screen.getAllByRole('article')).toHaveLength(4);
    expect(within(status).getAllByRole('button').map((b) => b.textContent)).toEqual([
      'Tout4',
      'À venir0',
      'Joués4',
    ]);
    expect(screen.getByText('Matchs listés').nextElementSibling).toHaveTextContent('4');

    await user.click(within(competitions).getByRole('button', { name: /Toutes/ }));
    expect(screen.getAllByRole('article')).toHaveLength(46);
  });

  describe('vue rapide — cartes « Prochain » et « Dernier résultat »', () => {
    /** La carte de la vue rapide qui porte ce titre. */
    function card(title: string): HTMLElement {
      return screen.getByText(title).parentElement as HTMLElement;
    }

    /** La saison, avec le prochain match (J6 Lens–Lyon du 09-10) sans heure fixée. */
    const nextUnconfirmed = season.map((m) =>
      m.competitionCode === 'L1' && m.matchday === 6 ? { ...m, timeConfirmed: false } : m,
    );

    it('« Prochain » : l’adversaire, la date, la compétition et l’heure fixée du prochain match', async () => {
      vi.stubGlobal('fetch', serve());
      renderPage();
      await screen.findAllByRole('article');

      const next = card('Prochain');
      expect(next).toHaveTextContent('Lens');
      expect(next).toHaveTextContent('Ven. 09/10 · Ligue 1');
      expect(next).toHaveTextContent('20:45');
      expect(next).not.toHaveTextContent('Horaire à confirmer');
    });

    it('« Prochain » avec une heure non fixée : « Horaire à confirmer », aucune heure', async () => {
      vi.stubGlobal('fetch', serve(nextUnconfirmed));
      renderPage();
      await screen.findAllByRole('article');

      const next = card('Prochain');
      expect(next).toHaveTextContent('Lens');
      expect(next).toHaveTextContent('Ven. 09/10 · Ligue 1');
      expect(next).toHaveTextContent('Horaire à confirmer');
      // Ni l'heure de 365scores (20:45), ni aucune autre.
      expect(next).not.toHaveTextContent(/\d{2}:\d{2}/);
      expect(next).not.toHaveTextContent(/\d{2}h\d{2}/);
    });

    it('« Prochain » suit le filtre par compétition : Crystal Palace en Ligue Europa, rien en Ligue des champions', async () => {
      vi.stubGlobal('fetch', serve(nextUnconfirmed));
      const user = userEvent.setup();
      renderPage();
      await screen.findAllByRole('article');
      const competitions = screen.getByRole('group', { name: 'Filtrer par compétition' });

      await user.click(within(competitions).getByRole('button', { name: /Europa League/ }));
      const europa = card('Prochain');
      expect(europa).toHaveTextContent('Crystal Palace');
      expect(europa).toHaveTextContent('Jeu. 15/10 · UEFA Europa League');
      expect(europa).toHaveTextContent('18:45');
      expect(europa).not.toHaveTextContent('Lens');
      expect(card('Dernier résultat')).toHaveTextContent('Anderlecht');
      expect(card('Dernier résultat')).toHaveTextContent('1-2');

      // Ligue des champions : 4 matchs joués, aucun à venir → pas de carte « Prochain ».
      await user.click(within(competitions).getByRole('button', { name: /Champions League/ }));
      expect(screen.queryByText('Prochain')).not.toBeInTheDocument();
      const last = card('Dernier résultat');
      expect(last).toHaveTextContent('Fenerbahçe SK');
      expect(last).toHaveTextContent('Mer. 26/08 · UEFA Champions League');
      expect(last).toHaveTextContent('1-2');

      await user.click(within(competitions).getByRole('button', { name: /^Ligue 1/ }));
      expect(card('Prochain')).toHaveTextContent('Lens');
      expect(card('Prochain')).toHaveTextContent('Horaire à confirmer');
    });

    it('« Dernier résultat » affiche le score, jamais « Horaire à confirmer », même si le champ est faux sur un match joué', async () => {
      const played = season.map((m) => (m.status === 'FINISHED' ? { ...m, timeConfirmed: false } : m));
      vi.stubGlobal('fetch', serve(played));
      renderPage();
      await screen.findAllByRole('article');

      const last = card('Dernier résultat');
      expect(last).toHaveTextContent('Rennes');
      expect(last).toHaveTextContent('4-0');
      expect(last).not.toHaveTextContent('Horaire à confirmer');
    });
  });

  it('une seule compétition dans la saison : pas de filtre par compétition', async () => {
    const ligue1Only = season.filter((m) => m.competitionCode === 'L1');
    vi.stubGlobal('fetch', serve(ligue1Only));
    renderPage();

    expect(await screen.findAllByRole('article')).toHaveLength(34);
    expect(screen.queryByRole('group', { name: 'Filtrer par compétition' })).not.toBeInTheDocument();
  });
});
