import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StandingsTable } from './standings-table';
import type { StandingEntry } from '@/types/api';

// L37 — à 390 px, la colonne Pts sortait de la zone visible : la cellule du club,
// à largeur libre, poussait le tableau au-delà de son conteneur. Le club doit
// pouvoir rétrécir (max-w-0) pour que Pts reste visible sans défilement ; son nom passe à la
// ligne sur téléphone (line-clamp-3, break-words) et n’est tronqué que sur ordinateur (md:truncate).

const rows: StandingEntry[] = [
  {
    position: 1, team: 'Paris Saint-Germain Football Club', teamId: 524, played: 9, won: 7, draw: 1,
    lost: 1, goalsFor: 20, goalsAgainst: 5, goalDifference: 15, points: 22,
  },
  {
    position: 2, team: 'Olympique Lyonnais', teamId: 523, played: 9, won: 6, draw: 2,
    lost: 1, goalsFor: 18, goalsAgainst: 8, goalDifference: 10, points: 20,
  },
];

function renderTable() {
  vi.stubGlobal('fetch', vi.fn());
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <StandingsTable rows={rows} />
    </QueryClientProvider>,
  );
}

describe('<StandingsTable /> — mobile (L37)', () => {
  it('la cellule du club peut rétrécir : max-w-0 sans w-full (colonnes fixes préservées), nom tronqué seulement sur ordinateur', () => {
    renderTable();
    const name = screen.getByText('Paris Saint-Germain Football Club');
    expect(name).toHaveClass('md:truncate');
    expect(name).not.toHaveClass('truncate');
    const cell = name.closest('td')!;
    expect(cell).toHaveClass('max-w-0');
    expect(cell).not.toHaveClass('w-full');
  });

  it('max-w-0 n’annule pas le minimum du nom : la cellule du club garde logo + écart + nom + marges (116 px = 7,25 rem)', () => {
    renderTable();
    const cell = screen.getByText('Paris Saint-Germain Football Club').closest('td')!;
    // 16 (px-2 ×2) + 22 (logo) + 6 (gap) + 72 (nom 4,5 rem) : sans ce plancher, max-w-0
    // ramène la cellule sous 100 px sous ~370 px de viewport et le nom chevauche la colonne G
    expect(cell).toHaveClass('min-w-[7.25rem]');
  });

  it('la colonne Pts reste affichée sur mobile (jamais masquée ni hors flux)', () => {
    renderTable();
    const pts = screen.getByText('Pts');
    expect(pts.className).not.toMatch(/hidden/);
    expect(screen.getByText('22').closest('td')!.className).not.toMatch(/hidden/);
  });

  it('à 360 px, le nom du club garde 4,5 rem au moins une fois colonnes, marges de cellule, logo et écart soustraits', () => {
    renderTable();
    const widths = Array.from(document.querySelectorAll('thead th'))
      .filter((th) => !/\bhidden\b/.test(th.className))
      .map((th) => /\bw-(\d+)\b/.exec(th.className))
      .filter((m): m is RegExpExecArray => !!m)
      .map((m) => Number(m[1]) * 4);
    const fixed = widths.reduce((a, b) => a + b, 0);
    const name = screen.getByText('Paris Saint-Germain Football Club');
    // cellule du club : px-2 (2 × 8 px) ; contenu : logo 22 px + gap-1.5 (6 px)
    expect(name.closest('td')).toHaveClass('px-2');
    expect(name.parentElement).toHaveClass('gap-1.5');
    // conteneur à 360 px : écran − 50 px (px-5 ×2, bordure ×2, p-2 ×2, moins -mx-1 ×2)
    const available = 360 - 50 - fixed - 16 - 22 - 6;
    expect(available).toBeGreaterThanOrEqual(72);
    // largeur minimale du nom (4,5 rem = 72 px) : en dessous, le tableau défile
    expect(name).toHaveClass('min-w-[4.5rem]');
  });

  it('le nom long se lit en entier sur téléphone : retour à la ligne (3 lignes au plus), titre natif, troncature réservée à l’ordinateur', () => {
    renderTable();
    const name = screen.getByText('Paris Saint-Germain Football Club');
    expect(name).toHaveAttribute('title', 'Paris Saint-Germain Football Club');
    expect(name).toHaveClass('line-clamp-3', 'break-words', 'md:truncate');
    expect(name).not.toHaveClass('truncate');
  });

  it('le rang reste sur la ligne de son repère de couleur : marges resserrées et pas de retour à la ligne sur mobile', () => {
    renderTable();
    const cell = screen.getAllByText('1')[0].closest('td')!;
    expect(cell).toHaveClass('px-1', 'md:px-2', 'whitespace-nowrap');
    expect(cell.querySelector('span.inline-block')).toHaveClass('mr-1', 'md:mr-2');
  });
});

describe('<StandingsTable /> — écussons (L32)', () => {
  it('prend chaque écusson au CDN 365scores par identifiant : aucun appel /api/wiki-image (18 clubs d’un coup dépassaient la limite de débit)', () => {
    renderTable();
    const fetchMock = vi.mocked(globalThis.fetch);
    expect(fetchMock.mock.calls.filter(([url]) => String(url).startsWith('/api/wiki-image'))).toHaveLength(0);
    const logo = screen.getByAltText('Paris Saint-Germain Football Club');
    expect(logo.getAttribute('src')).toContain('imagecache.365scores.com');
    expect(logo.getAttribute('src')).toContain('/Competitors/524');
  });
});

// L144 — WCAG 1.4.1 : la zone (LdC, Europa…) ne tient plus à la seule couleur de la barre.
describe('<StandingsTable /> — zones sans la couleur (L144)', () => {
  const mk = (position: number): StandingEntry => ({
    position, team: `Club ${position}`, teamId: 1000 + position, played: 9, won: 1, draw: 1,
    lost: 1, goalsFor: 1, goalsAgainst: 1, goalDifference: 0, points: 4,
  });
  const all = Array.from({ length: 18 }, (_, i) => mk(i + 1));

  function renderAll() {
    vi.stubGlobal('fetch', vi.fn());
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
      <QueryClientProvider client={client}>
        <StandingsTable rows={all} />
      </QueryClientProvider>,
    );
  }

  const rowOf = (n: number) => screen.getByText(`Club ${n}`).closest('tr')!;

  it('la cellule position porte la zone en texte sr-only, et rien pour le milieu de tableau', () => {
    renderAll();
    const zoneOf = (n: number) => rowOf(n).querySelector('td .sr-only')?.textContent?.replace(/ : $/, '') ?? null;
    expect(zoneOf(1)).toBe('Ligue des champions');
    expect(zoneOf(3)).toBe('Ligue des champions');
    expect(zoneOf(4)).toBe('Ligue Europa');
    expect(zoneOf(6)).toBe('Ligue Conférence');
    expect(zoneOf(10)).toBeNull();
    expect(zoneOf(16)).toBe('Barrage de relégation');
    expect(zoneOf(17)).toBe('Relégation');
    expect(zoneOf(18)).toBe('Relégation');
  });

  it('un filet sépare deux zones voisines, aucun à l’intérieur d’une zone ni sur la première ligne', () => {
    renderAll();
    const hasRule = (n: number) => rowOf(n).querySelector('td')!.classList.contains('border-t');
    for (const n of [4, 6, 7, 16, 17]) expect(hasRule(n), `ligne ${n}`).toBe(true);
    for (const n of [1, 2, 3, 5, 8, 15, 18]) expect(hasRule(n), `ligne ${n}`).toBe(false);
  });
});

// L145 — DB négatif (text-loss, 3,85:1) et lettre L (text-bg sur bg-loss, 4,07:1) sous 4,5:1 (WCAG 1.4.3).
describe('<StandingsTable /> — contrastes (L145)', () => {
  const lossRows: StandingEntry[] = [
    { ...rows[0], goalDifference: -7, recentForm: ['L', 'W', 'D'] },
  ];
  function renderLoss() {
    vi.stubGlobal('fetch', vi.fn());
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
      <QueryClientProvider client={client}>
        <StandingsTable rows={lossRows} />
      </QueryClientProvider>,
    );
  }

  it('la différence de buts négative passe sur le token text-loss-fg', () => {
    renderLoss();
    const cell = screen.getByText('-7').closest('td')!;
    expect(cell).toHaveClass('text-loss-fg');
    expect(cell).not.toHaveClass('text-loss');
  });

  it('la lettre L est blanche sur la pastille rouge', () => {
    renderLoss();
    const dot = screen.getByLabelText('Défaite');
    expect(dot).toHaveClass('bg-loss', 'text-white');
    expect(dot).not.toHaveClass('text-bg');
  });
});

// L147 — la forme s'affichait en lettres anglaises (W/D/L : « D » se lisait Défaite) sur un span
// sans rôle portant un aria-label (ignoré). Lettres françaises V/N/D, role=img (WCAG 1.1.1, 4.1.2).
describe('<StandingsTable /> — forme V/N/D (L147)', () => {
  const formRows: StandingEntry[] = [{ ...rows[0], recentForm: ['W', 'D', 'L'] }];
  function renderForm() {
    vi.stubGlobal('fetch', vi.fn());
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
      <QueryClientProvider client={client}>
        <StandingsTable rows={formRows} />
      </QueryClientProvider>,
    );
  }

  it('chaque pastille est une image nommée, avec la lettre française', () => {
    renderForm();
    const win = screen.getByRole('img', { name: 'Victoire' });
    const draw = screen.getByRole('img', { name: 'Match nul' });
    const loss = screen.getByRole('img', { name: 'Défaite' });
    expect(win).toHaveTextContent(/^V$/);
    expect(draw).toHaveTextContent(/^N$/);
    expect(loss).toHaveTextContent(/^D$/);
  });
});

// L153 — revue UX L4 : le wrapper `overflow-x-auto` faisait du <div> le conteneur de
// défilement des <th sticky top-0> : l'en-tête se collait à ce div (qui ne défile jamais
// en vertical) et non à la fenêtre. Le tableau tient déjà sans défilement à 320/390 px (L37) :
// aucun ancêtre ne doit être un conteneur de défilement.
describe('StandingsTable — en-tête collant (L153)', () => {
  it('aucun ancêtre de l’en-tête collant ne crée un conteneur de défilement', () => {
    const { container } = renderTable();
    const th = container.querySelector('th')!;
    expect(th.className).toMatch(/(^| )sticky( |$)/);
    for (let el = th.parentElement; el && el !== document.body; el = el.parentElement) {
      expect(el.className).not.toMatch(/overflow-(x-)?(auto|scroll|hidden)/);
    }
  });
});

// L64 — la ligne de la pastille du direct (z-30) colle en haut sous 1024 px : l'en-tête collant du tableau se pose
// dessous, sinon elle recouvre Club, G, N, P, DB et Pts.
describe('<StandingsTable /> — en-tête sous la ligne collante du direct (L64)', () => {
  it("R4 — l'en-tête colle sous la ligne de la pastille et le bandeau démo, pas à top-0", () => {
    renderTable();
    for (const th of document.querySelectorAll('thead th')) {
      expect(th).toHaveClass('sticky');
      expect(th).toHaveClass('top-[calc(var(--bandeau-demo-h,0px)+var(--ligne-direct-h,0px))]');
      expect(th).not.toHaveClass('top-0');
    }
  });
});
