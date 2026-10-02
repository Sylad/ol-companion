import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NouveautesPage } from './nouveautes';
import { NEWS_SEEN_EVENT, NEWS_SEEN_KEY } from '@/lib/news-badge';

const NEWS = {
  project: 'ol-companion',
  generated: '2026-10-01 22:00',
  entries: [
    {
      slug: '2026-10-01-page',
      title: 'Une page Nouveautés',
      date: '2026-10-01',
      lots: ['L13'],
      captures: ['captures/L13-page.png'],
      html: '<p>Le <strong>journal</strong> des changements.</p>',
    },
    {
      slug: '2026-09-28-ancienne',
      title: 'Une nouveauté plus ancienne',
      date: '2026-09-28',
      lots: ['L17'],
      captures: ['captures/L17-a.png', 'captures/L17-b.png'],
      html: '<p>Avant.</p>',
    },
  ],
};
const SIZES = {
  'captures/L13-page.png': [390, 844],
  'captures/L17-a.png': [1136, 354],
  'captures/L17-b.png': [800, 400],
};

function stubFetch({ news = NEWS as unknown, sizes = SIZES as unknown, newsOk = true, sizesOk = true } = {}) {
  const fetchMock = vi.fn(async (url: string) => {
    if (url.endsWith('/nouveautes.json')) return { ok: newsOk, status: newsOk ? 200 : 404, json: async () => news };
    if (url.endsWith('/tailles.json')) return { ok: sizesOk, status: sizesOk ? 200 : 404, json: async () => sizes };
    throw new Error(`fetch inattendu : ${url}`);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function renderPage(client = new QueryClient({ defaultOptions: { queries: { retry: false } } })) {
  return render(
    <QueryClientProvider client={client}>
      <NouveautesPage />
    </QueryClientProvider>,
  );
}

describe('<NouveautesPage />', () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState(null, '', '/nouveautes');
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
    window.history.replaceState(null, '', '/');
  });

  it('affiche les entrées du JSON cadence dans son ordre (la plus récente en haut), avec date et captures', async () => {
    const fetchMock = stubFetch();
    renderPage();

    expect(await screen.findByRole('heading', { level: 2, name: 'Une page Nouveautés' })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith('/nouveautes-data/nouveautes.json', expect.anything());
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Ce qui a changé');

    const titles = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(titles).toEqual(['Une page Nouveautés', 'Une nouveauté plus ancienne']);

    expect(screen.getByText('journal').tagName).toBe('STRONG');
    expect(screen.getByText('1 octobre 2026').closest('time')).toHaveAttribute('dateTime', '2026-10-01');

    const img = screen.getByRole('img', { name: "Capture d'écran : Une page Nouveautés" });
    expect(img).toHaveAttribute('src', '/nouveautes-data/captures/L13-page.png');
    expect(screen.getByRole('img', { name: "Capture d'écran 2 sur 2 : Une nouveauté plus ancienne" })).toHaveAttribute(
      'src',
      '/nouveautes-data/captures/L17-b.png',
    );
  });

  it('réserve la place de chaque capture avant chargement (aspect-ratio issu de tailles.json)', async () => {
    stubFetch();
    renderPage();
    const img = await screen.findByRole('img', { name: "Capture d'écran : Une page Nouveautés" });
    expect(img).toHaveAttribute('width', '390');
    expect(img).toHaveAttribute('height', '844');
    expect(img.style.aspectRatio).toBe('390 / 844');
    // Le lien prend min(largeur dispo, largeur naturelle, largeur donnant 32rem de haut).
    // (jsdom simplifie le calc : 32 × 390 / 844 = 14,787rem.)
    expect(img.closest('a')!.style.width).toMatch(/^min\(100%, 390px, (calc\(32rem \* 390 \/ 844\)|14\.78\d*rem)\)$/);
  });

  // Revue UX L13 : à 320 px la pastille « LIVE RECONNECTE » (fixe, en haut à droite, 170 px)
  // recouvrait la fin du sur-titre de 8 px. Mesuré avec /api/events coupé ; ici, les classes
  // qui le garantissent : marge droite de la pastille (pr-44) et icône décorative masquée < 640 px.
  it('au téléphone, le sur-titre laisse la place de la pastille LIVE la plus longue', async () => {
    stubFetch();
    renderPage();
    const eyebrow = (await screen.findByTestId('nouveautes-entete')).querySelector('p')!;
    expect(eyebrow.className).toMatch(/(^| )pr-44( |$)/);
    expect(eyebrow.className).toMatch(/lg:pr-0/);
    const icon = eyebrow.querySelector('svg')!;
    expect(icon.getAttribute('class')).toMatch(/(^| )hidden( |$)/);
    expect(icon.getAttribute('class')).toMatch(/sm:block/);
  });

  it('sans tailles.json, les captures restent affichées (taille naturelle)', async () => {
    stubFetch({ sizesOk: false });
    renderPage();
    const img = await screen.findByRole('img', { name: "Capture d'écran : Une page Nouveautés" });
    expect(img.style.aspectRatio).toBe('');
  });

  it('Entrée au clavier sur une capture ouvre la visionneuse (pas le PNG brut), Échap la ferme et rend le focus', async () => {
    stubFetch();
    const user = userEvent.setup();
    renderPage();
    const img = await screen.findByRole('img', { name: "Capture d'écran : Une page Nouveautés" });
    const link = img.closest('a')!;
    expect(link).toHaveAccessibleName(/Agrandir la capture/);

    link.focus();
    await user.keyboard('{Enter}');
    const dialog = screen.getByRole('dialog', { name: "Capture d'écran : Une page Nouveautés" });
    // Rendue sous <body> (portail) : hors du contexte d'empilement de <main> (z-10),
    // sinon la barre du bas et la pastille LIVE passent par-dessus la visionneuse.
    expect(dialog.parentElement).toBe(document.body);
    expect(within(dialog).getByRole('img')).toHaveAttribute('src', '/nouveautes-data/captures/L13-page.png');
    expect(within(dialog).getByRole('button', { name: 'Fermer' })).toHaveFocus();

    // Le focus reste dans la visionneuse (aria-modal) : « Fermer » ↔ zone de défilement.
    const close = within(dialog).getByRole('button', { name: 'Fermer' });
    const zone = within(dialog).getByRole('region', { name: /faire défiler/ });
    await user.tab();
    expect(zone).toHaveFocus();
    await user.tab();
    expect(close).toHaveFocus();
    await user.tab({ shift: true });
    expect(zone).toHaveFocus();
    expect(document.body.style.overflow).toBe('hidden');

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(link).toHaveFocus();
  });

  // Revue UX L13 : au téléphone, une capture large (1136×354) n'était agrandie que ×1,19.
  // Sous 640 px l'image prend sa largeur naturelle (au plus 2 largeurs d'écran) dans une
  // zone qui défile ; « Fermer » reste hors de cette zone, donc toujours visible.
  it('visionneuse : image à sa largeur naturelle (≤ 200vw) dans une zone qui défile, « Fermer » hors zone', async () => {
    stubFetch();
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('img', { name: "Capture d'écran 1 sur 2 : Une nouveauté plus ancienne" }));
    const dialog = screen.getByRole('dialog');
    const zone = within(dialog).getByRole('region', { name: /faire défiler/ });
    expect(zone).toHaveAttribute('tabindex', '0');
    expect(zone.className).toMatch(/overflow-auto/);
    const img = within(zone).getByRole('img');
    expect(img.style.getPropertyValue('--cap-w')).toBe('1136px');
    expect(img.className).toMatch(/w-\[min\(var\(--cap-w\),200vw\)\]/);
    expect(img.className).toMatch(/max-w-none/);
    expect(zone).not.toContainElement(within(dialog).getByRole('button', { name: 'Fermer' }));
    await user.keyboard('{Escape}');
    expect(document.body.style.overflow).toBe('');
  });

  it('clic sur une capture : visionneuse ; bouton Fermer et clic sur le voile la referment', async () => {
    stubFetch();
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('img', { name: "Capture d'écran 1 sur 2 : Une nouveauté plus ancienne" }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Fermer' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(screen.getByRole('img', { name: "Capture d'écran 1 sur 2 : Une nouveauté plus ancienne" }));
    await user.click(screen.getByTestId('capture-viewer-backdrop'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('dit clairement quand le journal est absent', async () => {
    stubFetch({ newsOk: false });
    renderPage();
    expect(await screen.findByText(/Aucune nouveauté publiée/)).toBeInTheDocument();
  });

  // ── L22 : pastille « nouveau » (dernière visite, localStorage) ──────────────
  const remember = (v: unknown) => localStorage.setItem(NEWS_SEEN_KEY, JSON.stringify(v));
  const stored = () => JSON.parse(localStorage.getItem(NEWS_SEEN_KEY) ?? 'null');

  it('premier visiteur : aucune marque « Nouveau », aucune annonce ; la visite est mémorisée et annoncée à la navigation', async () => {
    stubFetch();
    const seenEvent = vi.fn();
    window.addEventListener(NEWS_SEEN_EVENT, seenEvent);
    renderPage();
    await screen.findByRole('heading', { level: 2, name: /Une page Nouveautés/ });
    await waitFor(() => expect(stored()).toMatchObject({ date: '2026-10-01', slugs: ['2026-10-01-page'] }));
    expect(seenEvent).toHaveBeenCalled();
    window.removeEventListener(NEWS_SEEN_EVENT, seenEvent);
    expect(screen.queryByText('Nouveau')).toBeNull();
    expect(screen.getByTestId('nouveautes-depuis')).toHaveTextContent('');
    expect(screen.queryByTestId('nouveautes-deja-vu')).toBeNull();
  });

  it('après une visite ancienne : « Nouveau » en toutes lettres sur chaque entrée non vue et annonce role=status', async () => {
    stubFetch();
    remember({ date: '2026-01-01', slugs: [], at: '2026-01-01T10:00:00.000Z' });
    renderPage();
    await screen.findByRole('heading', { level: 2, name: /Une page Nouveautés/ });
    expect(screen.getAllByText('Nouveau')).toHaveLength(2);
    const since = screen.getByTestId('nouveautes-depuis');
    expect(since).toHaveAttribute('role', 'status');
    expect(since).toHaveTextContent('2 nouveautés depuis votre dernière visite');
    // Toutes les entrées sont non vues : pas de séparateur « Déjà vu ».
    expect(screen.queryByTestId('nouveautes-deja-vu')).toBeNull();
    // La marque reste affichée pendant la visite, même une fois tout mémorisé comme vu.
    await waitFor(() => expect(stored().date).toBe('2026-10-01'));
    expect(screen.getAllByText('Nouveau')).toHaveLength(2);
  });

  it('séparateur « Déjà vu lors de votre visite du … » avant la première entrée déjà vue', async () => {
    stubFetch();
    const at = '2026-09-29T08:30:00.000Z';
    remember({ date: '2026-09-28', slugs: ['2026-09-28-ancienne'], at });
    renderPage();
    await screen.findByRole('heading', { level: 2, name: /Une page Nouveautés/ });
    expect(screen.getAllByText('Nouveau')).toHaveLength(1);
    expect(screen.getByTestId('nouveautes-depuis')).toHaveTextContent('1 nouveauté depuis votre dernière visite');
    const sep = screen.getByTestId('nouveautes-deja-vu');
    const when = new Date(at).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' });
    expect(sep).toHaveTextContent(`Déjà vu lors de votre visite du ${when}`);
    expect(sep.nextElementSibling).toHaveAttribute('id', '2026-09-28-ancienne');
    const first = document.getElementById('2026-10-01-page')!;
    expect(within(first).getByText('Nouveau')).toBeInTheDocument();
  });

  // ── L22 : lien permanent /nouveautes#<slug> ─────────────────────────────────
  it('le titre de chaque entrée est un lien vers son ancre, atteignable au clavier, avec un anneau de focus visible', async () => {
    stubFetch();
    const user = userEvent.setup();
    renderPage();
    const link = await screen.findByRole('link', { name: 'Une page Nouveautés' });
    expect(link).toHaveAttribute('href', '#2026-10-01-page');
    expect(link.closest('h2')).toHaveAttribute('id', '2026-10-01-page-titre');
    expect(link.className).toMatch(/focus-visible:ring-2/);
    await user.tab();
    expect(link).toHaveFocus();
  });

  it('clic sur le titre : l’URL complète est copiée et annoncée ; sans presse-papiers, l’annonce le dit', async () => {
    stubFetch();
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const user = userEvent.setup();
    renderPage();
    const link = await screen.findByRole('link', { name: 'Une page Nouveautés' });
    // userEvent installe son propre presse-papiers : on remet le nôtre après setup.
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    await user.click(link);
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/nouveautes#2026-10-01-page`);
    const article = document.getElementById('2026-10-01-page')!;
    expect(await within(article).findByRole('status')).toHaveTextContent('Lien copié dans le presse-papiers');

    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn(async () => Promise.reject(new Error('refusé'))) },
      configurable: true,
    });
    const other = screen.getByRole('link', { name: 'Une nouveauté plus ancienne' });
    await user.click(other);
    const second = document.getElementById('2026-09-28-ancienne')!;
    expect(await within(second).findByRole('status')).toHaveTextContent("Lien affiché dans la barre d'adresse");
  });

  it('arrivée sur /nouveautes#<slug> : l’entrée visée est signalée et reçoit le focus une fois le journal chargé', async () => {
    stubFetch();
    window.history.replaceState(null, '', '/nouveautes#2026-09-28-ancienne');
    renderPage();
    await screen.findByRole('heading', { level: 2, name: /Une nouveauté plus ancienne/ });
    const target = document.getElementById('2026-09-28-ancienne')!;
    await waitFor(() => expect(target).toHaveFocus());
    expect(target).toHaveAttribute('data-target', 'true');
    expect(target).toHaveAttribute('tabindex', '-1');
    expect(document.getElementById('2026-10-01-page')).not.toHaveAttribute('data-target');
  });

  it('changement d’ancre (hashchange) : la nouvelle entrée est signalée ; ancre inconnue : aucune', async () => {
    stubFetch();
    renderPage();
    await screen.findByRole('heading', { level: 2, name: /Une page Nouveautés/ });
    act(() => {
      window.history.replaceState(null, '', '/nouveautes#2026-10-01-page');
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    expect(document.getElementById('2026-10-01-page')).toHaveAttribute('data-target', 'true');
    act(() => {
      window.history.replaceState(null, '', '/nouveautes#inconnu');
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    expect(document.querySelector('[data-target]')).toBeNull();
  });

  // Revue L22 : un rechargement du journal en arrière-plan (staleTime, retour sur
  // l'onglet) ne doit pas ramener la page à l'ancre ni voler le focus.
  it('un rechargement du journal ne refait ni défilement ni focus vers l’ancre déjà visée', async () => {
    const fetchMock = stubFetch();
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    window.history.replaceState(null, '', '/nouveautes#2026-09-28-ancienne');
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    renderPage(client);
    await screen.findByRole('heading', { level: 2, name: /plus ancienne/ });
    await waitFor(() => expect(document.getElementById('2026-09-28-ancienne')).toHaveFocus());
    expect(scroll).toHaveBeenCalledTimes(1);

    // Le lecteur est ailleurs ; le journal revient avec une entrée de plus (données
    // réellement changées : le partage structurel de TanStack ne garde pas l'ancienne
    // référence).
    const elsewhere = screen.getByRole('link', { name: 'Une page Nouveautés' });
    elsewhere.focus();
    const calls = fetchMock.mock.calls.length;
    const extra = { ...NEWS.entries[0], slug: '2026-10-02-plus-recente', title: 'Plus récente', captures: [] };
    stubFetch({ news: { ...NEWS, entries: [extra, ...NEWS.entries] } });
    await act(async () => {
      await client.refetchQueries();
    });
    expect(fetchMock.mock.calls.length).toBe(calls);
    expect(await screen.findByRole('heading', { level: 2, name: 'Plus récente' })).toBeInTheDocument();
    expect(elsewhere).toHaveFocus();
    expect(scroll).toHaveBeenCalledTimes(1);
    expect(document.getElementById('2026-09-28-ancienne')).toHaveAttribute('data-target', 'true');
  });
});
