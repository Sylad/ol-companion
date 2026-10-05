import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PlanPage } from './plan';

// L23 — page « Plan de travail » (portage de la page de finance-tracker).

// Les liens passent par le routeur ; un <a> suffit ici.
vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, hash, children, ...rest }: { to: string; hash?: string; children: React.ReactNode }) => (
    <a href={hash ? `${to}#${hash}` : to} {...rest}>{children}</a>
  ),
}));

const plan = {
  version: 1,
  project: 'ol-companion',
  lots: [
    { id: 'L18', title: 'Une page Nouveautés', status: 'done', started: '2026-09-28', finished: '2026-09-28' },
    { id: 'L21', title: 'Un tableau de bord plus lisible', status: 'done', started: '2026-09-28', finished: '2026-09-28',
      tasks: [{ title: 'Textes plus contrastés', status: 'done' }, { title: 'Graphiques légendés', status: 'done' }] },
    { id: 'L3', title: 'Très ancien', status: 'done', finished: '2026-06-01' },
    { id: 'L22', title: 'Une pastille pour ce qui est nouveau', status: 'todo' },
    { id: 'L23', title: 'Une page Plan de travail', status: 'doing', started: '2026-10-01',
      tasks: [{ status: 'done' }, { status: 'todo' }] },
  ],
};
const news = { project: 'ol-companion', generated: 'x', entries: [{ slug: '2026-09-28-tableau', title: 'T', date: '2026-09-28', lots: ['L21'], captures: [], html: '' }] };

function renderPage(client = new QueryClient({ defaultOptions: { queries: { retry: false } } })) {
  return render(
    <QueryClientProvider client={client}>
      <PlanPage />
    </QueryClientProvider>,
  );
}

const okJson = (body: unknown) => ({ ok: true, status: 200, json: async () => body });
const serve = (planRes: unknown, newsRes: unknown = okJson(news)) =>
  vi.fn((url: string) => Promise.resolve(url.startsWith('/plan-data') ? planRes : newsRes));

describe('<PlanPage />', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-01T10:00:00'));
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    window.location.hash = '';
  });

  it('montre En cours, Prévu puis Récemment livré, avec le résumé en évolutions', async () => {
    const fetchMock = serve(okJson(plan));
    vi.stubGlobal('fetch', fetchMock);
    renderPage();

    const headings = await screen.findAllByRole('heading', { level: 2 });
    expect(headings.map((h) => h.textContent)).toEqual([
      expect.stringContaining('En cours'),
      expect.stringContaining('Prévu'),
      expect.stringContaining('Récemment livré'),
    ]);
    expect(fetchMock).toHaveBeenCalledWith('/plan-data/plan.json', expect.anything());
    expect(screen.getByText('1 évolution en cours, 1 prévue, 2 livrées ces 30 derniers jours.')).toBeInTheDocument();

    const done = screen.getByRole('region', { name: /Récemment livré/ });
    expect(within(done).queryByText('Très ancien')).not.toBeInTheDocument();
    expect(within(done).getByText(/1 évolution livrée plus ancienne/)).toBeInTheDocument();
    expect(within(done).getByRole('link', { name: /voir les Nouveautés/ })).toHaveAttribute('href', '/nouveautes');
  });

  it('carte : surtitle badge · date, id ancre, titre, barre n/m étapes nommée, actions', async () => {
    vi.stubGlobal('fetch', serve(okJson(plan)));
    renderPage();

    const card = (await screen.findByRole('heading', { level: 3, name: 'Une page Plan de travail' })).closest('li')!;
    expect(card).toHaveAttribute('id', 'L23');
    expect(within(card).getByText('En cours')).toBeInTheDocument();
    expect(within(card).getByText('Démarré le 1 octobre 2026')).toBeInTheDocument();
    // Revue UX : l'identifiant de lot n'est pas montré aux visiteurs (il reste l'ancre /plan#L23).
    expect(within(card).queryByText('L23')).toBeNull();
    expect(card.textContent).not.toMatch(/\bL\d+\b/);
    const bar = within(card).getByRole('progressbar', { name: 'Avancement : Une page Plan de travail' });
    expect(bar).toHaveAttribute('aria-valuetext', '1 étape faite sur 2');
    expect(within(card).getByText('1/2 étapes')).toBeInTheDocument();
    // Étapes sans titre public : compteur seulement, pas de dépliage.
    expect(within(card).queryByRole('button', { name: /étapes/ })).toBeNull();

    const l21 = document.getElementById('L21')!;
    expect(within(l21).getByText('Livré le 28 septembre 2026')).toBeInTheDocument();
    expect(within(l21).getByRole('progressbar')).toHaveAttribute('aria-valuetext', '2 étapes faites sur 2');
    const link = await within(l21).findByRole('link', { name: 'Voir la nouveauté : Un tableau de bord plus lisible' });
    expect(link).toHaveAttribute('href', '/nouveautes#2026-09-28-tableau');
  });

  it('« Voir les étapes » déplie les étapes publiques puis devient « Masquer les étapes »', async () => {
    vi.stubGlobal('fetch', serve(okJson(plan)));
    renderPage();
    const l21 = (await screen.findByRole('heading', { level: 3, name: 'Un tableau de bord plus lisible' })).closest('li')!;
    const toggle = within(l21).getByRole('button', { name: 'Voir les étapes : Un tableau de bord plus lisible' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(within(l21).queryByText('Textes plus contrastés')).toBeNull();
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(toggle).toHaveAccessibleName('Masquer les étapes : Un tableau de bord plus lisible');
    expect(within(l21).getByText('Textes plus contrastés')).toBeInTheDocument();
  });

  it('défile jusqu’à la carte de l’ancre /plan#<id>', async () => {
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    window.location.hash = '#L21';
    vi.stubGlobal('fetch', serve(okJson(plan)));
    renderPage();
    await screen.findByRole('heading', { level: 3, name: 'Un tableau de bord plus lisible' });
    expect(scroll).toHaveBeenCalled();
    expect(scroll.mock.contexts[0]).toBe(document.getElementById('L21'));
    // Revue UX : le focus suit l'ancre (activeElement restait BODY).
    const card = document.getElementById('L21')!;
    expect(card).toHaveAttribute('tabindex', '-1');
    await waitFor(() => expect(card).toHaveFocus());
    expect(card).toHaveAttribute('data-target', 'true');
  });

  it('un rechargement du plan ne refait ni défilement ni focus vers l’ancre déjà visée', async () => {
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    window.location.hash = '#L21';
    vi.stubGlobal('fetch', serve(okJson(plan)));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    renderPage(client);
    await waitFor(() => expect(document.getElementById('L21')).toHaveFocus());
    expect(scroll).toHaveBeenCalledTimes(1);
    const elsewhere = screen.getByRole('button', { name: /Voir les étapes/ });
    elsewhere.focus();
    // Plan réellement changé (nouveau lot) : nouvelle référence de données.
    vi.stubGlobal('fetch', serve(okJson({ ...plan, lots: [...plan.lots, { id: 'L40', title: 'Nouveau lot', status: 'todo' }] })));
    await act(async () => {
      await client.refetchQueries();
    });
    expect(await screen.findByRole('heading', { level: 3, name: 'Nouveau lot' })).toBeInTheDocument();
    expect(elsewhere).toHaveFocus();
    expect(scroll).toHaveBeenCalledTimes(1);
  });

  it('changement d’ancre (retour arrière, adresse modifiée) : la nouvelle carte est amenée à l’écran et reçoit le focus', async () => {
    Element.prototype.scrollIntoView = vi.fn();
    vi.stubGlobal('fetch', serve(okJson(plan)));
    renderPage();
    await screen.findByRole('heading', { level: 3, name: 'Une page Plan de travail' });
    act(() => {
      window.history.replaceState(null, '', '#L22');
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    await waitFor(() => expect(document.getElementById('L22')).toHaveFocus());
  });

  it('404 : « Aucun plan publié »', async () => {
    vi.stubGlobal('fetch', serve({ ok: false, status: 404 }));
    renderPage();
    expect(await screen.findByText(/Aucun plan publié/)).toBeInTheDocument();
  });

  it('panne (500, non JSON) : message d’erreur et « Réessayer » qui recharge', async () => {
    const fetchMock = serve({ ok: true, status: 200, json: async () => { throw new SyntaxError('Unexpected token <'); } });
    vi.stubGlobal('fetch', fetchMock);
    renderPage();
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent("Le plan n'a pas pu être chargé");
    const calls = fetchMock.mock.calls.filter(([u]) => u.startsWith('/plan-data')).length;
    fetchMock.mockImplementation((url: string) => Promise.resolve(url.startsWith('/plan-data') ? okJson(plan) : okJson(news)));
    await userEvent.click(within(alert).getByRole('button', { name: /Réessayer/ }));
    expect(await screen.findByRole('heading', { level: 3, name: 'Une page Plan de travail' })).toBeInTheDocument();
    expect(fetchMock.mock.calls.filter(([u]) => u.startsWith('/plan-data')).length).toBe(calls + 1);
  });

  it('les trois groupes vides : un seul état vide avec lien vers les Nouveautés', async () => {
    vi.stubGlobal('fetch', serve(okJson({ ...plan, lots: [plan.lots[2]] })));
    renderPage();
    expect(await screen.findByText("Rien en préparation pour l'instant.")).toBeInTheDocument();
    expect(screen.queryAllByRole('heading', { level: 2 })).toHaveLength(0);
    expect(screen.getByRole('link', { name: /Nouveautés/ })).toHaveAttribute('href', '/nouveautes');
  });

  it('dit « rien » dans un groupe vide', async () => {
    vi.stubGlobal('fetch', serve(okJson({ ...plan, lots: plan.lots.filter((l) => l.status !== 'doing') }), { ok: false, status: 404 }));
    renderPage();
    const doing = await screen.findByRole('region', { name: /En cours/ });
    expect(within(doing).getByText(/Rien en cours/)).toBeInTheDocument();
  });

  it('en-tête de la page : titre de niveau 1 et sur-titre « Plan de travail »', async () => {
    vi.stubGlobal('fetch', serve(okJson(plan)));
    renderPage();
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('Ce qui se prépare');
    expect(screen.getByTestId('plan-entete')).toHaveTextContent(/Plan de travail/);
  });

  it('le sur-titre ne réserve plus de place à la pastille LIVE (elle a sa ligne, L30) et garde son icône', async () => {
    vi.stubGlobal('fetch', serve(okJson(plan)));
    renderPage();
    const eyebrow = (await screen.findByTestId('plan-entete')).querySelector('p')!;
    expect(eyebrow.className).not.toMatch(/pr-44/);
    expect(eyebrow.querySelector('svg')!.getAttribute('class')).not.toMatch(/(^| )hidden( |$)/);
  });

  it('l’état d’un lot est dit en toutes lettres (jamais par la seule couleur)', async () => {
    vi.stubGlobal('fetch', serve(okJson(plan)));
    renderPage();
    await screen.findByRole('heading', { level: 3, name: 'Une page Plan de travail' });
    expect(within(document.getElementById('L22')!).getByText('Prévu')).toBeInTheDocument();
    expect(within(document.getElementById('L21')!).getByText('Livré')).toBeInTheDocument();
  });

  it('une étape abandonnée n’est ni comptée ni listée « à faire »', async () => {
    const withDropped = { ...plan, lots: [{ id: 'L30', title: 'Avec abandon', status: 'doing', started: '2026-10-01',
      tasks: [{ title: 'Étape abandonnée', status: 'dropped' }, { title: 'Étape faite', status: 'done' }] }] };
    vi.stubGlobal('fetch', serve(okJson(withDropped)));
    renderPage();
    const card = (await screen.findByRole('heading', { level: 3, name: 'Avec abandon' })).closest('li')!;
    expect(within(card).getByRole('progressbar')).toHaveAttribute('aria-valuetext', '1 étape faite sur 1');
    await userEvent.click(within(card).getByRole('button', { name: /Voir les étapes/ }));
    expect(within(card).queryByText('Étape abandonnée')).toBeNull();
    expect(within(card).getByText('Étape faite')).toBeInTheDocument();
  });

  // Revue UX L23 : à 390/320 la ligne état + date passait à la ligne avec un « · »
  // orphelin en tête ; l'écart entre les deux vient désormais du gap flex.
  it('ligne état + date sans séparateur « · » (écart porté par le gap, pas d’orphelin au retour à la ligne)', async () => {
    vi.stubGlobal('fetch', serve(okJson(plan)));
    renderPage();
    const card = (await screen.findByRole('heading', { level: 3, name: 'Une page Plan de travail' })).closest('li')!;
    const meta = within(card).getByText('Démarré le 1 octobre 2026').closest('div')!;
    expect(meta.textContent).not.toContain('·');
    expect(meta.className).toMatch(/gap-x-/);
  });

  // Revue UX L23 : « 1/3 étapes » mais 2 étapes listées. Le décompte reste celui de
  // toutes les étapes (l'avancement réel) ; la liste dit combien ne sont pas détaillées.
  it('étapes sans titre public : comptées dans n/m et annoncées « + N étape(s) non détaillée(s) » dans la liste', async () => {
    const mixed = { ...plan, lots: [{ id: 'L31', title: 'Mixte', status: 'doing', started: '2026-10-01',
      tasks: [{ title: 'Étape A', status: 'done' }, { status: 'todo' }, { title: 'Étape C', status: 'todo' }, { status: 'done' }] }] };
    vi.stubGlobal('fetch', serve(okJson(mixed)));
    renderPage();
    const card = (await screen.findByRole('heading', { level: 3, name: 'Mixte' })).closest('li')!;
    expect(within(card).getByText('2/4 étapes')).toBeInTheDocument();
    await userEvent.click(within(card).getByRole('button', { name: /Voir les étapes/ }));
    const list = card.querySelector('#L31-etapes')!;
    expect([...list.children].map((li) => li.textContent?.replace(/\s+/g, ' ').trim())).toEqual([
      '✓Étape A (faite)',
      '○Étape C (à faire)',
      '+ 2 étapes non détaillées',
    ]);
  });

  it('une seule étape non détaillée : accord au singulier', async () => {
    const one = { ...plan, lots: [{ id: 'L32', title: 'Une', status: 'doing', started: '2026-10-01',
      tasks: [{ title: 'Étape A', status: 'done' }, { status: 'todo' }] }] };
    vi.stubGlobal('fetch', serve(okJson(one)));
    renderPage();
    const card = (await screen.findByRole('heading', { level: 3, name: 'Une' })).closest('li')!;
    await userEvent.click(within(card).getByRole('button', { name: /Voir les étapes/ }));
    expect(within(card).getByText('+ 1 étape non détaillée')).toBeInTheDocument();
  });
});
