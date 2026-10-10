import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import season from '@/test/fixtures/season-matches-2026-10-03.json';
import { FixturesPage } from './fixtures';

// Pas de routeur dans ce test : Link rend un <a> dont on lit `to`, `params` et `search` (L96).
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, params, search, ...rest }: any) => (
    <a
      {...rest}
      href={`${String(to).replace('$gameId', params?.gameId)}?matchupId=${search?.matchupId}`}
    >
      {children}
    </a>
  ),
}));

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

    const palace = within(block('Ligue Europa · J2')).getByRole('article');
    expect(palace).toHaveTextContent('Lyon');
    expect(palace).toHaveTextContent('Crystal Palace');
    expect(palace).toHaveTextContent('Jeu. 15');
    expect(palace).toHaveTextContent('18h45');

    const anderlecht = within(block('Ligue Europa · J1')).getByRole('article');
    expect(anderlecht).toHaveTextContent('Anderlecht');
    expect(anderlecht).toHaveTextContent('Terminé');
  });

  it('montre les 4 qualifications de Ligue des champions d’août à leur date, avec leur tour, leur manche et leur score', async () => {
    vi.stubGlobal('fetch', serve());
    renderPage();
    await screen.findAllByRole('article');

    const row = (label: string) => within(block(label)).getByRole('article');

    const spartaAway = row('Ligue des champions · 3e tour de qualification · aller');
    expect(spartaAway).toHaveTextContent('Mar. 04');
    expect(spartaAway).toHaveTextContent('août');
    expect(spartaAway).toHaveTextContent('Sparta Praha2');
    expect(spartaAway).toHaveTextContent('Lyon1');

    const spartaHome = row('Ligue des champions · 3e tour de qualification · retour');
    expect(spartaHome).toHaveTextContent('Mar. 11');
    expect(spartaHome).toHaveTextContent('Lyon3');
    expect(spartaHome).toHaveTextContent('Sparta Praha0');

    const fenerAway = row('Ligue des champions · Barrages · aller');
    expect(fenerAway).toHaveTextContent('Mar. 18');
    expect(fenerAway).toHaveTextContent('Fenerbahçe SK1');
    expect(fenerAway).toHaveTextContent('Lyon1');

    const fenerHome = row('Ligue des champions · Barrages · retour');
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

  it('les libellés V/N/D de la vue rapide sont en fg-muted (≥ 4,5:1), jamais en fg-dim (4,23:1 en 10 px)', async () => {
    vi.stubGlobal('fetch', serve());
    renderPage();
    await screen.findAllByRole('article');

    const quick = screen.getByText('Vue rapide').parentElement as HTMLElement;
    for (const l of ['V', 'N', 'D']) {
      const label = within(quick).getByText(l, { selector: 'div' });
      expect(label).toHaveClass('text-fg-muted');
      expect(label).not.toHaveClass('text-fg-dim');
    }
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
    expect(lens).toHaveTextContent('20h45');
  });

  it('suit l’ordre des dates, toutes compétitions mêlées', async () => {
    vi.stubGlobal('fetch', serve());
    renderPage();
    await screen.findAllByRole('article');

    const labels = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(labels.slice(0, 12)).toEqual([
      'Ligue des champions · 3e tour de qualification · aller',
      'Ligue des champions · 3e tour de qualification · retour',
      'Ligue des champions · Barrages · aller',
      'Ligue 1 · J1',
      'Ligue des champions · Barrages · retour',
      'Ligue 1 · J2',
      'Ligue 1 · J3',
      'Ligue 1 · J4',
      'Ligue Europa · J1',
      'Ligue 1 · J5',
      'Ligue 1 · J6',
      'Ligue Europa · J2',
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

    // Le jour n'est pas plus fixé que l'heure : le samedi de remplissage (5 déc.)
    // ne s'affiche pas comme une date ferme (L47).
    expect(troyes).toHaveTextContent('Week-end');
    expect(troyes).toHaveTextContent('du 05/12');
    // « Week-end » ne se coupe pas au trait d'union dans la colonne date (L100).
    expect(within(troyes).getByText('Week-end').closest('div')).toHaveClass('whitespace-nowrap');
    expect(troyes).not.toHaveTextContent('Sam. 05');

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

    const palace = within(block('Ligue Europa · J2')).getByRole('article');
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

  it('une légende visible donne le nom long des sigles de compétition, sans survol ni lecteur d’écran', async () => {
    vi.stubGlobal('fetch', serve());
    renderPage();
    await screen.findAllByRole('article');
    const legend = screen.getByText(/^Comp\. :/);
    expect(legend).toHaveTextContent(
      'Comp. : L1 = Ligue 1 · C1 = Ligue des champions · C3 = Ligue Europa',
    );
    expect(legend).not.toHaveClass('sr-only');
  });

  // jsdom ne mesure pas : on vérifie la classe qui porte la cible de 40 px sous lg (WCAG 2.5.8, L97).
  it('les pastilles de filtre font 40 px de haut au toucher (sous lg), sans changer le bureau', async () => {
    vi.stubGlobal('fetch', serve());
    renderPage();
    await screen.findAllByRole('article');
    for (const name of ['Filtrer par compétition', 'Filtrer par statut']) {
      const buttons = within(screen.getByRole('group', { name })).getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(1);
      for (const b of buttons) expect(b).toHaveClass('min-h-10', 'lg:min-h-0');
    }
  });

  it('le filtre par compétition restreint la liste, les compteurs et la vue rapide', async () => {
    vi.stubGlobal('fetch', serve());
    const user = userEvent.setup();
    renderPage();
    await screen.findAllByRole('article');
    const competitions = screen.getByRole('group', { name: 'Filtrer par compétition' });
    expect(within(competitions).getAllByRole('button').map((b) => b.textContent)).toEqual([
      'Toutes46',
      'L134',
      'C14',
      'C38',
    ]);
    // Nom court affiché, nom long en infobulle et dans le nom accessible.
    expect(within(competitions).getByRole('button', { name: 'C1 — Ligue des champions · 4 matchs' })).toBeInTheDocument();
    expect(within(competitions).getByTitle('Ligue Europa')).toHaveTextContent('C3');
    // La somme des pastilles égale « Toutes » : aucun match hors pastille.
    const [all, ...perCompetition] = within(competitions)
      .getAllByRole('button')
      .map((b) => Number(b.querySelector('span')?.textContent));
    expect(perCompetition.reduce((sum, n) => sum + n, 0)).toBe(all);

    await user.click(within(competitions).getByRole('button', { name: /Ligue Europa/ }));

    expect(screen.getAllByRole('article')).toHaveLength(8);
    const status = screen.getByRole('group', { name: 'Filtrer par statut' });
    expect(within(status).getAllByRole('button').map((b) => b.textContent)).toEqual([
      'Tout8',
      'À venir7',
      'Joués1',
    ]);
    expect(screen.getByText('Matchs listés').nextElementSibling).toHaveTextContent('8');
    expect(screen.queryByRole('heading', { level: 3, name: /Ligue 1/ })).not.toBeInTheDocument();

    // L104 : « Matchs listés » compte les lignes affichées, filtre de statut compris.
    await user.click(within(status).getByRole('button', { name: /Joués/ }));
    expect(screen.getAllByRole('article')).toHaveLength(1);
    expect(screen.getByText('Matchs listés').nextElementSibling).toHaveTextContent('1');
    await user.click(within(status).getByRole('button', { name: /Tout/ }));

    await user.click(within(competitions).getByRole('button', { name: /Ligue des champions/ }));
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
      expect(next).toHaveTextContent('20h45');
      expect(next).not.toHaveTextContent('Horaire à confirmer');
    });

    it('« Prochain » avec une heure non fixée : « Horaire à confirmer », aucune heure', async () => {
      vi.stubGlobal('fetch', serve(nextUnconfirmed));
      renderPage();
      await screen.findAllByRole('article');

      const next = card('Prochain');
      expect(next).toHaveTextContent('Lens');
      // Vendredi 09/10 est une date de remplissage : le week-end, pas un jour ferme.
      expect(next).toHaveTextContent('Week-end du 10/10 · Ligue 1');
      expect(next).not.toHaveTextContent('Ven. 09/10');
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

      await user.click(within(competitions).getByRole('button', { name: /Ligue Europa/ }));
      const europa = card('Prochain');
      expect(europa).toHaveTextContent('Crystal Palace');
      expect(europa).toHaveTextContent('Jeu. 15/10 · Ligue Europa');
      expect(europa).toHaveTextContent('18h45');
      expect(europa).not.toHaveTextContent('Lens');
      expect(card('Dernier résultat')).toHaveTextContent('Anderlecht');
      expect(card('Dernier résultat')).toHaveTextContent('1-2');

      // Ligue des champions : 4 matchs joués, aucun à venir → pas de carte « Prochain ».
      await user.click(within(competitions).getByRole('button', { name: /Ligue des champions/ }));
      expect(screen.queryByText('Prochain')).not.toBeInTheDocument();
      const last = card('Dernier résultat');
      expect(last).toHaveTextContent('Fenerbahçe SK');
      expect(last).toHaveTextContent('Mer. 26/08 · Ligue des champions');
      expect(last).toHaveTextContent('1-2');

      await user.click(within(competitions).getByRole('button', { name: /^L1 — Ligue 1/ }));
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

  describe('jour non fixé — branches de formatDateParts (L47)', () => {
    it('un horaire non fixé un jour de semaine : « Date à confirmer » dans la ligne et dans la carte Prochain', async () => {
      // Mercredi : ni vendredi, ni samedi, ni dimanche → pas de « Week-end ».
      const midweek = season.map((m) => {
        if (m.competitionCode !== 'L1') return m;
        if (m.matchday === 13) return { ...m, date: '2026-12-02T17:00:00Z', timeConfirmed: false };
        if (m.matchday === 6) return { ...m, date: '2026-10-07T17:00:00Z', timeConfirmed: false };
        return m;
      });
      vi.stubGlobal('fetch', serve(midweek));
      renderPage();
      await screen.findAllByRole('article');

      const row = within(block('Ligue 1 · J13')).getByRole('article');
      expect(row).toHaveTextContent('Dateà confirmer');
      expect(row).not.toHaveTextContent('Week-end');
      expect(row).not.toHaveTextContent('Mer. 02');

      const next = screen.getByText('Prochain').parentElement as HTMLElement;
      expect(next).toHaveTextContent('Date à confirmer · Ligue 1');
      expect(next).not.toHaveTextContent('Week-end');
      expect(next).not.toHaveTextContent('Mer. 07/10');
    });

    // jsdom ne mesure pas : on vérifie la structure qui évite que « À CONFIRMER » (64 px) déborde la
    // colonne de 40 px sous 360 px (L48) — forme courte à l'écran, forme entière pour les lecteurs d'écran.
    it('« Date à confirmer » : forme courte sous 360 px, forme entière conservée pour les lecteurs d’écran', async () => {
      const midweek = season.map((m) =>
        m.competitionCode === 'L1' && m.matchday === 13 ? { ...m, date: '2026-12-02T17:00:00Z', timeConfirmed: false } : m,
      );
      vi.stubGlobal('fetch', serve(midweek));
      renderPage();
      await screen.findAllByRole('article');

      const month = within(block('Ligue 1 · J13')).getByRole('article').children[0].children[1] as HTMLElement;
      const [long, short] = Array.from(month.children) as HTMLElement[];
      expect(long).toHaveTextContent('à confirmer');
      expect(long.className.split(' ')).toContain('max-[359px]:sr-only');
      expect(short).toHaveTextContent('à conf.');
      expect(short.className.split(' ')).toEqual(expect.arrayContaining(['hidden', 'max-[359px]:inline']));
      expect(short).toHaveAttribute('aria-hidden', 'true');
    });

    it('un match joué un week-end garde sa date ferme, même si timeConfirmed est faux', async () => {
      const played = season.map((m) => (m.status === 'FINISHED' ? { ...m, timeConfirmed: false } : m));
      vi.stubGlobal('fetch', serve(played));
      renderPage();
      await screen.findAllByRole('article');

      // Lyon–Rennes 4-0, samedi 19/09.
      const last = screen.getByText('Dernier résultat').parentElement as HTMLElement;
      expect(last).toHaveTextContent('Sam. 19/09');
      expect(last).not.toHaveTextContent('Week-end');
      const rennes = screen.getAllByRole('article').find((a) => a.textContent?.includes('Rennes')) as HTMLElement;
      expect(rennes).toHaveTextContent('Sam. 19');
      expect(rennes).not.toHaveTextContent('Week-end');
    });

    it('la date « du 05/12 » d’une ligne non fixée est en fg-muted (WCAG 1.4.3), pas fg-dim', async () => {
      vi.stubGlobal('fetch', serve());
      renderPage();
      await screen.findAllByRole('article');

      const row = within(block('Ligue 1 · J13')).getByRole('article');
      const date = within(row).getByText('du 05/12');
      expect(date).toHaveClass('text-fg-muted');
      expect(date).not.toHaveClass('text-fg-dim');
    });
  });

  describe('lisibilité — revue UX du calendrier', () => {
    it('L94 — le score et le nom du perdant ne portent aucune opacité (WCAG 1.4.3)', async () => {
      vi.stubGlobal('fetch', serve());
      renderPage();
      await screen.findAllByRole('article');

      const rennes = screen.getAllByRole('article').find((a) => a.textContent?.includes('Rennes')) as HTMLElement;
      const score = within(rennes).getByText('0');
      expect(score).toHaveClass('text-fg-muted');
      let el: HTMLElement | null = score;
      while (el && el !== rennes) {
        expect(el.className).not.toMatch(/opacity-/);
        el = el.parentElement;
      }
      const name = within(rennes).getByText('Rennes');
      for (let n: HTMLElement | null = name; n && n !== rennes; n = n.parentElement) {
        expect(n.className).not.toMatch(/opacity-/);
      }
    });

    /** Le conteneur d'écusson (celui qui porte l'éventuelle opacité) de la ligne de ce club. */
    function logoWrap(row: HTMLElement, club: string): HTMLElement {
      const name = within(row).getByText(club);
      const line = name.closest('div.flex') as HTMLElement;
      return line.firstElementChild as HTMLElement;
    }

    it('L94 — l’écusson du perdant porte opacity-55, celui du vainqueur non', async () => {
      vi.stubGlobal('fetch', serve());
      renderPage();
      await screen.findAllByRole('article');

      const rennes = screen.getAllByRole('article').find((a) => a.textContent?.includes('Rennes')) as HTMLElement;
      expect(logoWrap(rennes, 'Rennes')).toHaveClass('opacity-55');
      expect(logoWrap(rennes, 'Lyon')).not.toHaveClass('opacity-55');
    });

    it('L94 — sur un match nul, les deux écussons sont atténués et les deux scores en fg-muted, sans opacité sur le texte', async () => {
      const draw = season.map((m) =>
        m.status === 'FINISHED' && m.awayTeam.includes('Rennes') ? { ...m, homeScore: 1, awayScore: 1 } : m,
      );
      vi.stubGlobal('fetch', serve(draw));
      renderPage();
      await screen.findAllByRole('article');

      const rennes = screen.getAllByRole('article').find((a) => a.textContent?.includes('Rennes')) as HTMLElement;
      expect(logoWrap(rennes, 'Rennes')).toHaveClass('opacity-55');
      expect(logoWrap(rennes, 'Lyon')).toHaveClass('opacity-55');
      const scores = within(rennes).getAllByText('1');
      expect(scores).toHaveLength(2);
      for (const sc of scores) {
        expect(sc).toHaveClass('text-fg-muted');
        expect(sc.className).not.toMatch(/opacity-/);
      }
    });

    /** Le bloc « Horaire à confirmer » (deux lignes) contenu dans cet élément. */
    function tbd(container: HTMLElement): HTMLElement {
      return within(container).getByText('Horaire').parentElement as HTMLElement;
    }

    it('« Horaire à confirmer » est écrit en fg-muted (≥ 4,5:1 sur le fond), jamais en fg-dim, et reste plus discret qu’une heure', async () => {
      const nextUnconfirmed = season.map((m) =>
        m.competitionCode === 'L1' && m.matchday === 6 ? { ...m, timeConfirmed: false } : m,
      );
      vi.stubGlobal('fetch', serve(nextUnconfirmed));
      renderPage();
      await screen.findAllByRole('article');

      const inRow = tbd(within(block('Ligue 1 · J13')).getByRole('article'));
      const inNextCard = tbd(screen.getByText('Prochain').parentElement as HTMLElement);
      for (const el of [inRow, inNextCard]) {
        expect(el).toHaveTextContent('Horaire à confirmer');
        expect(el).toHaveClass('text-fg-muted');
        expect(el).not.toHaveClass('text-fg-dim');
        // 10 px en capitales, sans graisse : plus discret qu'une heure (14 px, gras).
        expect(el).toHaveClass('text-[10px]', 'uppercase');
        expect(el.className).not.toMatch(/font-(semi)?bold/);
      }
    });

    const names = (group: HTMLElement) =>
      within(group).getAllByRole('button').map((b) => b.getAttribute('aria-label'));

    it('pastilles de statut : nom accessible « libellé · n matchs », comme les pastilles de compétition', async () => {
      vi.stubGlobal('fetch', serve());
      const user = userEvent.setup();
      renderPage();
      await screen.findAllByRole('article');
      const status = screen.getByRole('group', { name: 'Filtrer par statut' });
      const competitions = screen.getByRole('group', { name: 'Filtrer par compétition' });

      expect(names(status)).toEqual(['Tout · 46 matchs', 'À venir · 36 matchs', 'Joués · 10 matchs']);
      // Le nom est celui que lit un lecteur d'écran, pas « À venir36 ».
      expect(within(status).getByRole('button', { name: 'À venir · 36 matchs' })).toBeInTheDocument();
      expect(names(competitions)).toEqual([
        'Toutes les compétitions · 46 matchs',
        'L1 — Ligue 1 · 34 matchs',
        'C1 — Ligue des champions · 4 matchs',
        'C3 — Ligue Europa · 8 matchs',
      ]);

      // Singulier jusqu'à 1, comme les pastilles de compétition.
      await user.click(within(competitions).getByRole('button', { name: /Ligue Europa/ }));
      expect(names(status)).toEqual(['Tout · 8 matchs', 'À venir · 7 matchs', 'Joués · 1 match']);
      await user.click(within(competitions).getByRole('button', { name: /Ligue des champions/ }));
      expect(names(status)).toEqual(['Tout · 4 matchs', 'À venir · 0 match', 'Joués · 4 matchs']);
    });

    it('pastille choisie : aria-pressed et un anneau fg-muted (≥ 3:1 sur le groupe), pas la seule clarté du texte', async () => {
      vi.stubGlobal('fetch', serve());
      const user = userEvent.setup();
      renderPage();
      await screen.findAllByRole('article');
      const status = screen.getByRole('group', { name: 'Filtrer par statut' });
      const competitions = screen.getByRole('group', { name: 'Filtrer par compétition' });

      /** Dans chaque groupe, la seule pastille choisie porte l'état et l'anneau. */
      const expectSelected = (group: HTMLElement, name: RegExp) => {
        const buttons = within(group).getAllByRole('button');
        const pressed = buttons.filter((b) => b.getAttribute('aria-pressed') === 'true');
        expect(pressed).toHaveLength(1);
        expect(pressed[0]).toHaveAccessibleName(name);
        for (const b of buttons) {
          expect(b).toHaveAttribute('aria-pressed', b === pressed[0] ? 'true' : 'false');
          if (b === pressed[0]) expect(b).toHaveClass('ring-1', 'ring-fg-muted');
          else expect(b.className.replace(/focus-visible:\S+/g, '')).not.toMatch(/\bring-/);
        }
      };

      expectSelected(status, /^Tout ·/);
      expectSelected(competitions, /^Toutes les compétitions ·/);

      await user.click(within(status).getByRole('button', { name: /À venir/ }));
      await user.click(within(competitions).getByRole('button', { name: /Ligue Europa/ }));
      expectSelected(status, /^À venir ·/);
      expectSelected(competitions, /^C3 — Ligue Europa ·/);
    });

    it('au clavier (focus-visible) : anneau rouge 2 px, distinct de l\'anneau gris de la pastille choisie (WCAG 2.4.7)', async () => {
      vi.stubGlobal('fetch', serve());
      renderPage();
      await screen.findAllByRole('article');
      for (const name of ['Filtrer par statut', 'Filtrer par compétition']) {
        const buttons = within(screen.getByRole('group', { name })).getAllByRole('button');
        for (const b of buttons) {
          expect(b).toHaveClass(
            'focus-visible:outline',
            'focus-visible:outline-2',
            'focus-visible:outline-offset-1',
            'focus-visible:outline-ol-red-bright',
          );
          // Pas de ring au focus : il écraserait l'anneau gris (même box-shadow) de la pastille choisie.
          expect(b.className).not.toMatch(/focus-visible:ring/);
        }
      }
    });

    it('la vue rapide reste collante : aucun ancêtre en overflow-hidden (qui annule sticky), la section coupe en overflow-clip', async () => {
      vi.stubGlobal('fetch', serve());
      const { container } = renderPage();
      await screen.findAllByRole('article');

      const panel = screen.getByText('Vue rapide').closest('aside') as HTMLElement;
      expect(panel).toHaveClass('lg:sticky', 'lg:top-6', 'lg:self-start');

      // overflow: hidden fait de l'ancêtre le conteneur de défilement du sticky ;
      // overflow: clip coupe pareil (coins arrondis) sans le devenir.
      const ancestors: HTMLElement[] = [];
      for (let el = panel.parentElement; el && el !== container; el = el.parentElement) ancestors.push(el);
      expect(ancestors.length).toBeGreaterThan(0);
      for (const el of ancestors) {
        expect(el.className).not.toMatch(/\boverflow-(hidden|auto|scroll)\b/);
      }
      const section = panel.closest('section') as HTMLElement;
      expect(section).toHaveClass('overflow-clip', 'rounded-md');
    });

    it('compteurs des pastilles en fg-muted (≥ 4,5:1), choisie ou non, jamais en fg-dim', async () => {
      vi.stubGlobal('fetch', serve());
      renderPage();
      await screen.findAllByRole('article');

      const counters = ['Filtrer par statut', 'Filtrer par compétition'].flatMap((label) =>
        within(screen.getByRole('group', { name: label }))
          .getAllByRole('button')
          .map((b) => b.querySelector('span') as HTMLElement),
      );
      expect(counters).toHaveLength(7);
      for (const counter of counters) {
        expect(counter).toHaveClass('text-fg-muted');
        expect(counter).not.toHaveClass('text-fg-dim');
      }
    });
  });

  it('une seule compétition dans la saison : pas de filtre par compétition', async () => {
    const ligue1Only = season.filter((m) => m.competitionCode === 'L1');
    vi.stubGlobal('fetch', serve(ligue1Only));
    renderPage();

    expect(await screen.findAllByRole('article')).toHaveLength(34);
    expect(screen.queryByRole('group', { name: 'Filtrer par compétition' })).not.toBeInTheDocument();
  });

  it("l'eyebrow « Saison … » suit la saison des matchs servis, pas la date du jour (L40)", async () => {
    // Saison décalée d'un an : 2027-28, que ni un libellé en dur ni `now` (2026-27) ne donnent.
    const shifted = season.map((m) => ({
      ...m,
      date: m.date.replace(/^(\d{4})/, (y) => String(Number(y) + 1)),
    }));
    vi.stubGlobal('fetch', serve(shifted));
    renderPage();

    await screen.findAllByRole('article');
    expect(screen.getByText('Saison 2027-28')).toBeInTheDocument();
    // À 768 px l'en-tête passe en ligne : le libellé ne se coupe pas (L100).
    expect(screen.getByText('Saison 2027-28')).toHaveClass('whitespace-nowrap');
  });
});

// L48 — au téléphone (390 px, 320 px), la ligne compacte laisse la place au nom
// des clubs : colonne date 56 px, nom en 1fr, colonne d'état à sa largeur utile.
describe('<FixturesPage /> — date lisible : mois nommé et année (L98)', () => {
  it('une date ferme porte le nom du mois abrégé et un <time datetime> avec l’année', async () => {
    vi.stubGlobal('fetch', serve());
    renderPage();
    await screen.findAllByRole('article');

    const row = within(block('Ligue des champions · 3e tour de qualification · aller')).getByRole('article');
    const time = row.querySelector('time') as HTMLTimeElement;
    expect(time).toHaveAttribute('datetime', '2026-08-04');
    expect(time).toHaveTextContent('Mar. 04');
    expect(time).toHaveTextContent('août');
    expect(time).not.toHaveTextContent('Mar. 04 08');
    expect(time).toHaveAttribute('title', 'mardi 4 août 2026');
    expect(row).not.toHaveTextContent(/\b08\b/);
  });

  it('une date non fixée n’est pas balisée comme un instant', async () => {
    vi.stubGlobal('fetch', serve());
    renderPage();
    await screen.findAllByRole('article');
    const row = within(block('Ligue 1 · J13')).getByRole('article');
    expect(row.querySelector('time')).toBeNull();
  });
});

describe('<FixturesPage /> — ligne compacte au téléphone (L48)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('range date / clubs / état dans une grille 56px 1fr auto', async () => {
    vi.stubGlobal('fetch', serve());
    renderPage();
    const [row] = await screen.findAllByRole('article');
    expect(row.className).toContain('grid-cols-[56px_1fr_auto]');
    expect(row.className).not.toContain('72px');
    const state = row.lastElementChild as HTMLElement;
    expect(state.className).not.toContain('min-w-[72px]');
  });

  it("affiche « Marseille » et non « Olympique de Marseille »", async () => {
    vi.stubGlobal('fetch', serve());
    renderPage();
    await screen.findAllByRole('article');
    const rows = screen.getAllByRole('article').filter((a) => /Marseille/.test(a.textContent ?? ''));
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) expect(r).not.toHaveTextContent('Olympique de Marseille');
  });

  it("resserre la colonne de la date sous 360 px pour laisser la place aux noms", async () => {
    vi.stubGlobal('fetch', serve());
    renderPage();
    const [row] = await screen.findAllByRole('article');
    expect(row.className).toContain('max-[359px]:grid-cols-[40px_1fr_auto]');
    expect(row.className).toContain('max-[359px]:px-2');
  });

  // jsdom n'a pas de mise en page : ce test vérifie la structure qui évite la coupe en plein mot
  // (un nom de plusieurs mots = un bloc tronquable par mot, un mot seul = ellipse, nom entier en
  // title). La largeur réelle à 320 px se mesure dans un navigateur (Playwright, voir la Nouveauté L48).
  it("structure des noms : mots séparés et tronquables, mot seul à l'ellipse, nom entier en title", async () => {
    vi.stubGlobal('fetch', serve());
    renderPage();
    const rows = await screen.findAllByRole('article');
    const names = rows.flatMap((r) => Array.from(r.querySelectorAll('span.min-w-0.flex-1')) as HTMLElement[]);
    expect(names.length).toBeGreaterThan(2);
    let multi = 0;
    for (const n of names) {
      expect(n.className).not.toContain('break-words');
      expect(n.getAttribute('title')).toBeTruthy();
      const words = Array.from(n.children) as HTMLElement[];
      if (/\s/.test(n.textContent ?? '')) {
        multi++;
        // chaque mot est entier dans son propre bloc, tronquable seul par une ellipse :
        // `truncate` n'agit que sur une boîte en bloc ou inline-block, bornée par max-w-full
        expect(words.length).toBeGreaterThan(1);
        expect(words.map((w) => w.textContent).join(' ')).toBe(n.textContent);
        for (const w of words) {
          expect(w.className.split(' ')).toEqual(expect.arrayContaining(['inline-block', 'max-w-full', 'truncate']));
          expect(w.textContent).not.toMatch(/\s/);
        }
      } else {
        expect(words).toHaveLength(0);
        expect(n.className.split(' ')).toContain('truncate');
      }
    }
    expect(multi).toBeGreaterThan(0);
  });
});

describe('<FixturesPage /> — lien vers la page du match (L96)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('chaque ligne est un lien /match/<id>?matchupId=, nommé par la rencontre', async () => {
    vi.stubGlobal('fetch', serve());
    renderPage();
    const rows = await screen.findAllByRole('article');
    for (const row of rows) {
      const link = within(row).getByRole('link');
      expect(link.getAttribute('href')).toMatch(/^\/match\/\d+\?matchupId=\d+-\d+-\d+$/);
      expect(link).toHaveAccessibleName(/ contre .* — détail du match$/);
    }
  });

  it("l'OL est 465 dans matchupId (identifiant 365scores), jamais 523", async () => {
    vi.stubGlobal('fetch', serve());
    renderPage();
    const rows = await screen.findAllByRole('article');
    for (const row of rows) {
      const href = within(row).getByRole('link').getAttribute('href')!;
      const [home, away] = href.split('matchupId=')[1].split('-');
      expect([home, away]).toContain('465');
      expect([home, away]).not.toContain('523');
    }
  });

  it('les cartes Prochain et Dernier résultat mènent aussi à leur match', async () => {
    vi.stubGlobal('fetch', serve());
    renderPage();
    await screen.findAllByRole('article');
    const aside = screen.getByText('Vue rapide').closest('aside') as HTMLElement;
    const links = within(aside).getAllByRole('link');
    expect(links).toHaveLength(2);
    for (const l of links) expect(l.getAttribute('href')).toMatch(/^\/match\/\d+\?matchupId=/);
  });

  it("la zone cliquable passe au-dessus des écussons atténués et du LIVE animé (z-10), et l'infobulle donne la rencontre entière", async () => {
    vi.stubGlobal('fetch', serve());
    renderPage();
    const rows = await screen.findAllByRole('article');
    for (const row of rows) {
      const link = within(row).getByRole('link');
      expect(link.className).toContain('after:z-10');
      expect(link.getAttribute('title')).toMatch(/ contre /);
    }
  });
});
