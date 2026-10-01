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
});
