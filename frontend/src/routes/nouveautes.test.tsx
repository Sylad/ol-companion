import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NouveautesPage } from './nouveautes';

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

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <NouveautesPage />
    </QueryClientProvider>,
  );
}

describe('<NouveautesPage />', () => {
  afterEach(() => vi.unstubAllGlobals());

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

    // Le focus reste dans la visionneuse (aria-modal).
    await user.tab();
    expect(within(dialog).getByRole('button', { name: 'Fermer' })).toHaveFocus();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(link).toHaveFocus();
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
});
