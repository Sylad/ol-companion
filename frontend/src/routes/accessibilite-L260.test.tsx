import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import season from '@/test/fixtures/season-matches-2026-10-03.json';

// L260 — mineurs de la revue UX L255, un test par point (les cibles de 24 px se mesurent dans Chromium :
// tests-navigateur/cibles-24px-L260.test.ts ; le titre de la 404 et la barre latérale : components/layout/
// app-shell-L260.test.tsx ; les émojis des faits du match : match.faits-types-L9.test.tsx).

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, params, search, activeProps, activeOptions, ...rest }: any) => (
    <a {...rest} href={`${String(to).replace('$gameId', params?.gameId)}${search?.matchupId ? `?matchupId=${search.matchupId}` : ''}`}>
      {children}
    </a>
  ),
  useRouterState: () => ({ location: { pathname: '/' } }),
}));
vi.mock('@/components/ligue1-map', () => ({ Ligue1Map: () => <div /> }));

import { FixturesPage } from './fixtures';
import { AboutPage } from './about';
import { StandingsPage } from './standings';
import { MapPage } from './map';
import { PositionTracker } from '@/components/position-tracker';
import { KnowledgeHeader } from '@/components/knowledge-header';
import { PannesProvider, RetryMessage } from '@/components/retry-message';
import { pageTitle } from '@/lib/page-title';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** fetch simulé : `/api/season-matches` sert la saison du 03-10, le reste répond 404 sauf `autres`. */
function servir(autres: Record<string, unknown> = {}) {
  vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
    const chemin = String(input).split('?')[0];
    if (chemin === '/api/season-matches') return Promise.resolve({ ok: true, status: 200, json: async () => season });
    if (chemin in autres) return Promise.resolve({ ok: true, status: 200, json: async () => autres[chemin] });
    return Promise.resolve({ ok: false, status: 404, json: async () => ({}) });
  }));
}

function rendre(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

/** Niveaux des titres dans l'ordre du document, et les sauts (« h1 → h3 »). */
function sautsDeTitres(): string[] {
  const niveaux = [...document.querySelectorAll('h1, h2, h3, h4, h5, h6')].map((h) => Number(h.tagName[1]));
  const sauts: string[] = [];
  if (niveaux[0] !== 1) sauts.push(`premier titre h${niveaux[0]}`);
  for (let i = 1; i < niveaux.length; i++) if (niveaux[i] > niveaux[i - 1] + 1) sauts.push(`h${niveaux[i - 1]} → h${niveaux[i]}`);
  return sauts;
}

describe('L260 — ordre des titres : h1 puis h2, sans saut (WCAG 1.3.1)', () => {
  it('/fixtures : les mois sont des h2 sous le h1 « Calendrier »', async () => {
    servir();
    rendre(<FixturesPage />);
    await screen.findByTestId('liste-mois');
    expect(screen.getAllByTestId('titre-mois')[0].closest('h1, h2, h3')?.tagName).toBe('H2');
    expect(sautsDeTitres()).toEqual([]);
  });

  it('/about : « Notifications de match » et les sections sont des h2, les groupes de la pile des h3', () => {
    rendre(<AboutPage />);
    expect(screen.getByRole('heading', { level: 2, name: 'Notifications de match' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Mes autres sites' })).toBeInTheDocument();
    expect(sautsDeTitres()).toEqual([]);
  });

  it('/standings : h1 « Classement » avant le h2 de l’évolution du classement', async () => {
    servir();
    rendre(<StandingsPage />);
    await screen.findByRole('heading', { level: 1, name: 'Classement' });
    expect(sautsDeTitres()).toEqual([]);
  });
});

describe('L260 — logos qui répètent le nom voisin : alt vide (WCAG 1.1.1)', () => {
  it('bandeau de l’OL : l’écusson à côté de « Olympique Lyonnais » a un alt vide', async () => {
    servir({ '/api/wiki-image': { imageUrl: 'https://wiki.example/ol.png' } });
    rendre(<KnowledgeHeader />);
    await waitFor(() => expect(document.querySelector('img[src="https://wiki.example/ol.png"]')).not.toBeNull());
    expect(document.querySelector('img[src="https://wiki.example/ol.png"]')).toHaveAttribute('alt', '');
    expect(screen.getByText('Olympique Lyonnais')).toBeInTheDocument();
  });

  it('calendrier : aucun écusson ne porte de nom (le nom du club est écrit à côté)', async () => {
    servir();
    rendre(<FixturesPage />);
    await screen.findByTestId('liste-mois');
    const nommes = [...document.querySelectorAll('img')].filter((i) => i.alt !== '').map((i) => i.alt);
    expect(nommes).toEqual([]);
  });

  it('/about : l’icône de l’appli, décorative, a un alt vide', () => {
    rendre(<AboutPage />);
    expect(document.querySelector('img[src="/icon.png"]')).toHaveAttribute('alt', '');
  });
});

describe('L260 — libellés anglais restants traduits', () => {
  // Hors mentions balisées lang="en" (titre d'À propos, « Made with curiosity », mention exigée par football-data).
  const ANGLAIS = /\b(Dashboard|Tracker|contributors|Frontend|Backend|Infra|Opt-in|live updates|desktop|review|switch|cards|sidebar|Pattern)\b/;
  const texteHorsAnglaisBalise = (racine: Element) => {
    const copie = racine.cloneNode(true) as Element;
    copie.querySelectorAll('[lang="en"]').forEach((n) => n.remove());
    return copie.textContent ?? '';
  };

  it('titre de l’accueil : « Accueil · OL Companion »', () => {
    expect(pageTitle('/')).toBe('Accueil · OL Companion');
  });

  it('évolution du classement : plus de « Tracker de classement »', () => {
    servir();
    const { container } = rendre(<PositionTracker />);
    expect(screen.getByRole('heading', { level: 2, name: 'Évolution du classement' })).toBeInTheDocument();
    expect(texteHorsAnglaisBalise(container)).not.toMatch(ANGLAIS);
  });

  it('/about : pile technique, notifications et inspirations en français', () => {
    const { container } = rendre(<AboutPage />);
    expect(texteHorsAnglaisBalise(container)).not.toMatch(ANGLAIS);
    expect(screen.getByRole('heading', { level: 3, name: 'Interface (frontend)' })).toBeInTheDocument();
  });

  it('/map : attribution OpenStreetMap en français', () => {
    servir();
    const { container } = rendre(<MapPage />);
    expect(container.textContent).toContain('© les contributeurs d’OpenStreetMap');
    expect(texteHorsAnglaisBalise(container)).not.toMatch(ANGLAIS);
  });
});

describe('L260 — émojis décoratifs masqués aux lecteurs d’écran', () => {
  it('/about : les pictogrammes des autres sites sont aria-hidden', () => {
    rendre(<AboutPage />);
    const lus = [...document.querySelectorAll('main *, div *')]
      .filter((e) => [...e.childNodes].some((n) => n.nodeType === 3 && /\p{Extended_Pictographic}/u.test(n.textContent ?? '')))
      .filter((e) => !e.closest('[aria-hidden="true"]'))
      .map((e) => e.textContent);
    expect(lus).toEqual([]);
    const lien = screen.getByRole('link', { name: /Evatosorus/ });
    expect(lien.textContent).toContain('🦖');
  });
});

describe('L260 — « Cliquez » au téléphone : verbe neutre', () => {
  it('/map : la consigne ne dit plus « Cliquez »', () => {
    servir();
    const { container } = rendre(<MapPage />);
    expect(container.textContent).not.toMatch(/cliqu/i);
    expect(container.textContent).toContain('Choisissez un club');
  });

  it('/about : « désactivable en un clic » n’existe plus', () => {
    const { container } = rendre(<AboutPage />);
    expect(container.textContent).not.toMatch(/\bclic\b/i);
  });
});

describe('L260 — une panne sans cause : un seul « Réessayer » par page, qui dit ce qui a échoué', () => {
  function Page({ relances }: { relances: string[] }) {
    return (
      <main>
        <PannesProvider>
          <RetryMessage message="Impossible de charger le prochain match." onRetry={() => relances.push('matchs')} messageTestId="m1" buttonTestId="b1" />
          <RetryMessage message="Impossible de charger le classement." onRetry={() => relances.push('classement')} messageTestId="m2" buttonTestId="b2" />
          <RetryMessage message="Impossible de charger l'évolution du classement." onRetry={() => relances.push('evolution')} messageTestId="m3" buttonTestId="b3" />
        </PannesProvider>
      </main>
    );
  }

  it('trois blocs en panne : un seul bouton, le premier, qui relance les trois appels', () => {
    const relances: string[] = [];
    render(<Page relances={relances} />);
    expect(screen.getAllByRole('button', { name: 'Réessayer' })).toHaveLength(1);
    expect(screen.getByTestId('b1')).toBeInTheDocument();
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    fireEvent.click(screen.getByTestId('b1'));
    expect(relances).toEqual(['matchs', 'classement', 'evolution']);
  });

  it('le message du bouton dit ce qui a échoué ailleurs sur la page', () => {
    render(<Page relances={[]} />);
    expect(screen.getByTestId('pannes-groupees')).toHaveTextContent(
      "Impossible aussi de charger le classement et l'évolution du classement. « Réessayer » relance tout.",
    );
    // Chaque bloc garde son propre message.
    expect(screen.getByTestId('m2')).toHaveTextContent('Impossible de charger le classement.');
    expect(screen.getByTestId('m3')).toHaveTextContent("Impossible de charger l'évolution du classement.");
  });

  it('un seul bloc en panne : son « Réessayer » reste, sans phrase de regroupement', () => {
    render(
      <PannesProvider>
        <RetryMessage message="Impossible de charger les coupes." onRetry={() => {}} messageTestId="m" buttonTestId="b" />
      </PannesProvider>,
    );
    expect(screen.getAllByRole('button', { name: 'Réessayer' })).toHaveLength(1);
    expect(screen.queryByTestId('pannes-groupees')).toBeNull();
  });

  it('un bloc qui se rétablit : l’autre retrouve son « Réessayer »', () => {
    const { rerender } = render(<Page relances={[]} />);
    rerender(
      <main>
        <PannesProvider>
          <RetryMessage message="Impossible de charger le classement." onRetry={() => {}} messageTestId="m2" buttonTestId="b2" />
        </PannesProvider>
      </main>,
    );
    expect(screen.getByTestId('b2')).toBeInTheDocument();
  });

  it('/fixtures dit ce qui a échoué (plus « Erreur de chargement. » ; /cups : cups.ux-L6.test.tsx)', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: false, status: 503, json: async () => ({}) })));
    rendre(<FixturesPage />);
    expect(await screen.findByTestId('message-erreur')).toHaveTextContent('Impossible de charger le calendrier.');
  });

});
