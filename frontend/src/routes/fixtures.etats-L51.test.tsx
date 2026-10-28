import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
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

// L51 — états du calendrier : chargement sans pastille, erreur annoncée, vide actionnable, cumul du match retour.

const SPARTA_ALLER = 4779514;
const SPARTA_RETOUR = 4779515;

const okJson = (body: unknown) => ({ ok: true, status: 200, json: async () => body });

/** La saison du 03-10, avec le cumul que le backend donne au retour contre le Sparta (aller 1-2, retour 3-0 : 4-2). */
const withAggregate = season.map((m) => (m.id === SPARTA_RETOUR ? { ...m, aggregateScore: { home: 4, away: 2 } } : m));

function serve(body: unknown = withAggregate) {
  return vi.fn((url: string) =>
    Promise.resolve(url === '/api/season-matches' ? okJson(body) : { ok: false, status: 404, json: async () => ({}) }),
  );
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <FixturesPage />
    </QueryClientProvider>,
  );
}

function rowById(id: number): HTMLElement {
  const row = screen
    .getAllByRole('article')
    .find((a) => within(a).getByRole('link').getAttribute('href')?.startsWith(`/match/${id}?`));
  if (!row) throw new Error(`ligne du match ${id} introuvable`);
  return row;
}

const pill = (group: string, name: RegExp) => within(screen.getByTestId(group)).getByRole('button', { name });

afterEach(() => vi.unstubAllGlobals());

describe('<FixturesPage /> — états (L51)', () => {
  it('chargement : ni pastille ni compteur « 0 » avant la réponse', async () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
    renderPage();
    expect(await screen.findByTestId('message-chargement')).toBeInTheDocument();
    expect(screen.queryByTestId('filtre-competition')).toBeNull();
    expect(screen.queryByTestId('filtre-statut')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('erreur : annoncée aux lecteurs d’écran (role=alert) en couleur lisible (pas --loss, 3,85:1)', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: false, status: 500, json: async () => ({}) })));
    renderPage();
    const message = await screen.findByTestId('message-erreur');
    expect(message).toHaveAttribute('role', 'alert');
    expect(message).toHaveTextContent('Erreur de chargement.');
    expect(message.className).not.toContain('text-loss');
    expect(message.className).toContain('text-ol-red-bright');
  });

  it('R2 — erreur : un bouton « Réessayer » relance /api/season-matches et rend le calendrier quand l’appel réussit', async () => {
    let appels = 0;
    const fetchMock = vi.fn((url: string) => {
      if (url !== '/api/season-matches') return Promise.resolve({ ok: false, status: 404, json: async () => ({}) });
      appels += 1;
      return Promise.resolve(appels === 1 ? { ok: false, status: 500, json: async () => ({}) } : okJson(withAggregate));
    });
    vi.stubGlobal('fetch', fetchMock);
    renderPage();
    const message = await screen.findByTestId('message-erreur');
    expect(message).toHaveAttribute('role', 'alert');
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(await screen.findByTestId('liste-mois')).toBeInTheDocument();
    expect(appels).toBe(2);
    expect(screen.queryByTestId('message-erreur')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Réessayer' })).toBeNull();
  });

  it('R2 — erreur : un rafraîchissement en échec ne retire pas le calendrier déjà chargé (ni message, ni « Réessayer »)', async () => {
    let appels = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url !== '/api/season-matches') return Promise.resolve({ ok: false, status: 404, json: async () => ({}) });
        appels += 1;
        return Promise.resolve(appels === 1 ? okJson(withAggregate) : { ok: false, status: 500, json: async () => ({}) });
      }),
    );
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <FixturesPage />
      </QueryClientProvider>,
    );
    await screen.findByTestId('liste-mois');
    await client.refetchQueries();
    expect(appels).toBe(2);
    await waitFor(() => expect(client.getQueryState(['season-matches'])?.status).toBe('error'));
    expect(screen.getByTestId('liste-mois')).toBeInTheDocument();
    expect(screen.queryByTestId('message-erreur')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Réessayer' })).toBeNull();
  });

  it('vide : le message est dans une zone role=status, avec un bouton qui rend tous les matchs', async () => {
    vi.stubGlobal('fetch', serve());
    renderPage();
    await screen.findByTestId('liste-mois');
    const user = userEvent.setup();
    await user.click(pill('filtre-competition', /^C1 — /));
    await user.click(pill('filtre-statut', /^À venir · /));
    const message = await screen.findByTestId('message-vide');
    expect(within(screen.getByRole('status')).getByTestId('message-vide')).toBe(message);
    await user.click(screen.getByRole('button', { name: 'Afficher tous les matchs' }));
    expect(await screen.findByTestId('liste-mois')).toBeInTheDocument();
    expect(screen.queryByTestId('message-vide')).toBeNull();
    expect(pill('filtre-competition', /^Toutes · /)).toHaveAttribute('aria-pressed', 'true');
    expect(pill('filtre-statut', /^Tout · /)).toHaveAttribute('aria-pressed', 'true');
  });

  it('vide : la zone role=status existe avant le message (une zone ajoutée avec son texte n’est pas annoncée) et reste vide sinon', async () => {
    vi.stubGlobal('fetch', serve());
    renderPage();
    await screen.findByTestId('liste-mois');
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
    expect(screen.queryByRole('button', { name: 'Afficher tous les matchs' })).toBeNull();
  });

  it('cumul : la manche retour jouée affiche « Cumul 4-2 », lu aussi par le lecteur d’écran ; l’aller n’en affiche pas', async () => {
    vi.stubGlobal('fetch', serve());
    renderPage();
    await screen.findByTestId('liste-mois');
    const retour = within(rowById(SPARTA_RETOUR)).getByTestId('cumul-match');
    expect(retour).toHaveTextContent('Cumul 4-2');
    expect(within(rowById(SPARTA_RETOUR)).getByRole('link')).toHaveAccessibleName(/cumul 4 à 2/i);
    expect(within(rowById(SPARTA_ALLER)).queryByTestId('cumul-match')).toBeNull();
  });
});
