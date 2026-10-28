import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import season from '@/test/fixtures/season-matches-2026-10-03.json';
import { FixturesPage } from './fixtures';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, params, search, ...rest }: any) => (
    <a {...rest} href={`${String(to).replace('$gameId', params?.gameId)}?matchupId=${search?.matchupId}`}>
      {children}
    </a>
  ),
}));

// L228 — focus et annonces du calendrier (WCAG 2.4.3, 4.1.3, 2.4.7).

const okJson = (body: unknown) => ({ ok: true, status: 200, json: async () => body });

function serve() {
  return vi.fn((url: string) =>
    Promise.resolve(url === '/api/season-matches' ? okJson(season) : { ok: false, status: 404, json: async () => ({}) }),
  );
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <main>
        <FixturesPage />
      </main>
    </QueryClientProvider>,
  );
}

afterEach(() => vi.unstubAllGlobals());

describe('<FixturesPage /> — focus et annonces (L228)', () => {
  it('R1 — « Afficher tous les matchs » : le bouton disparaît, le focus passe au titre de la page, pas à body', async () => {
    vi.stubGlobal('fetch', serve());
    renderPage();
    await screen.findByTestId('liste-mois');
    const user = userEvent.setup();
    await user.click(within(screen.getByTestId('filtre-competition')).getByRole('button', { name: /^C1 — / }));
    await user.click(within(screen.getByTestId('filtre-statut')).getByRole('button', { name: /^À venir · / }));
    await user.click(await screen.findByRole('button', { name: 'Afficher tous les matchs' }));
    await screen.findByTestId('liste-mois');
    expect(screen.queryByRole('button', { name: 'Afficher tous les matchs' })).toBeNull();
    expect(document.activeElement).toBe(screen.getByTestId('titre-page'));
  });

  it('R2 — « Chargement des matchs… » est dans une zone role=status déjà présente avant son texte', async () => {
    let appels = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url !== '/api/season-matches') return Promise.resolve({ ok: false, status: 404, json: async () => ({}) });
        appels += 1;
        return appels === 1 ? Promise.resolve({ ok: false, status: 500, json: async () => ({}) }) : new Promise(() => {});
      }),
    );
    renderPage();
    await screen.findByTestId('message-erreur');
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Réessayer' }));
    const chargement = await screen.findByTestId('message-chargement');
    expect(chargement.closest('[role="status"]')).not.toBeNull();
  });

  it('R3 — le bouton « Réessayer » porte le contour de focus ol-red-bright', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string) => Promise.resolve({ ok: false, status: url === '/api/season-matches' ? 500 : 404, json: async () => ({}) })));
    renderPage();
    const bouton = await screen.findByRole('button', { name: 'Réessayer' });
    expect(bouton.className).toContain('focus-visible:outline-ol-red-bright');
  });
});
