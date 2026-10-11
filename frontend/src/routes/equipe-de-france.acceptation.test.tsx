import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createMemoryHistory, createRootRoute, createRouter } from '@tanstack/react-router';
import { BottomNav } from '@/components/layout/bottom-nav';
import { NAV_ITEMS, Sidebar } from '@/components/layout/sidebar';

// Acceptation L113 — écran « Équipe de France » (/equipe-de-france), écrit d'après la fiche et la maquette.
// Page : composant exporté par src/routes/equipe-de-france.tsx (premier export fonction).

type Team = { id: number; name: string };
const FR: Team = { id: 5061, name: 'France' };
const team = (name: string, id = 1): Team => ({ id, name });

const iso = (offsetDays: number, hour = 20, min = 45) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  d.setHours(hour, min, 0, 0);
  return d.toISOString();
};
const result = (over: Record<string, unknown>) => ({
  id: 1,
  date: '2026-10-10T20:45:00.000Z',
  home: FR,
  away: team('Ukraine', 2),
  homeScore: 2,
  awayScore: 0,
  franceIsHome: true,
  competition: 'Qualifications Coupe du monde',
  ...over,
});
const player = (name: string, position: string, age: number, id = 1) => ({ id, name, position, age });

const RESULTS = [
  result({ id: 1, date: '2026-10-10T20:45:00.000Z', home: FR, away: team('Ukraine', 2), homeScore: 2, awayScore: 0 }),
  result({ id: 2, date: '2026-09-03T20:45:00.000Z', home: team('Bosnie-Herzégovine', 3), away: FR, homeScore: 1, awayScore: 1, franceIsHome: false }),
  result({ id: 3, date: '2026-06-06T20:45:00.000Z', home: FR, away: team('Italie', 4), homeScore: 3, awayScore: 1, competition: 'Ligue des nations' }),
  result({ id: 4, date: '2026-06-02T20:45:00.000Z', home: team('Croatie', 5), away: FR, homeScore: 2, awayScore: 1, franceIsHome: false, competition: 'Ligue des nations' }),
  result({ id: 5, date: '2026-03-28T20:45:00.000Z', home: FR, away: team('Belgique', 6), homeScore: 2, awayScore: 1, competition: 'Match amical' }),
];
const SQUAD = [
  player('Mike Maignan', 'Goalkeeper', 31, 1),
  player('Brice Samba', 'Goalkeeper', 32, 2),
  player('William Saliba', 'Defender', 25, 3),
  player('Jules Koundé', 'Defender', 27, 4),
  player('Lucas Digne', 'Defender', 33, 5),
  player('Aurélien Tchouaméni', 'Midfielder', 26, 6),
  player("N'Golo Kanté", 'Midfielder', 35, 7),
  player('Kylian Mbappé', 'Attacker', 27, 8),
];
const NEXT = {
  id: 10,
  date: iso(3),
  timeConfirmed: true,
  home: FR,
  away: team('Azerbaïdjan', 9),
  competition: 'Qualifications Coupe du monde',
};
const FULL = { nextMatch: NEXT, results: RESULTS, squad: SQUAD };

let calls: string[] = [];
let handler: () => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;
const okJson = (body: unknown) => async () => ({ ok: true, status: 200, json: async () => body });

beforeEach(() => {
  calls = [];
  handler = okJson(FULL);
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      calls.push(String(url));
      if (String(url).includes('/france')) return handler();
      return { ok: false, status: 404, json: async () => null };
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

const franceCalls = () => calls.filter((u) => u.includes('/france'));

async function renderAt(path: string, Component: () => JSX.Element) {
  const rootRoute = createRootRoute({ component: Component });
  const router = createRouter({ routeTree: rootRoute, history: createMemoryHistory({ initialEntries: [path] }) });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

// import.meta.glob : le fichier absent ne casse pas la collecte, chaque test échoue séparément.
const pageModule = Object.values((import.meta as unknown as { glob: (p: string, o: object) => Record<string, unknown> }).glob('./equipe-de-france.tsx', { eager: true }))[0] ?? {};

function PageComponent(): JSX.Element {
  const Comp = Object.values(pageModule as Record<string, unknown>).find((v) => typeof v === 'function') as (() => JSX.Element) | undefined;
  if (!Comp) throw new Error('equipe-de-france.tsx doit exporter le composant de page');
  return <Comp />;
}
const renderPage = () => renderAt('/equipe-de-france', PageComponent);
const tid = (id: string) => screen.getByTestId(id);
const loaded = async () => screen.findByTestId('prochain-match');
const DATA_BLOCKS = ['prochain-match', 'derniers-resultats', 'effectif'];

describe('R1 — chargement', () => {
  beforeEach(() => {
    handler = () => new Promise(() => {});
  });
  it("R1 — chargement : le message s'affiche, aucun bloc de données", async () => {
    await renderPage();
    expect(await screen.findByTestId('message-chargement')).toHaveTextContent('Chargement de l’équipe de France…');
    expect(tid('titre-page')).toHaveTextContent('Équipe de France');
    expect(tid('sous-titre-page')).toBeInTheDocument();
    for (const id of DATA_BLOCKS) expect(screen.queryByTestId(id)).toBeNull();
  });
  it('R1 — le message est dans un conteneur role=status', async () => {
    await renderPage();
    const msg = await screen.findByTestId('message-chargement');
    expect(msg.closest('[role="status"]')).not.toBeNull();
    expect(document.querySelector('[aria-busy="true"]')).not.toBeNull();
  });
});

describe('R2 — erreur', () => {
  beforeEach(() => {
    handler = async () => ({ ok: false, status: 500, json: async () => null });
  });
  it('R2 — erreur : message et bouton Réessayer', async () => {
    await renderPage();
    expect(await screen.findByTestId('message-erreur')).toHaveTextContent('Impossible de charger l’équipe de France.');
    expect(tid('bouton-reessayer')).toHaveTextContent('Réessayer');
    for (const id of DATA_BLOCKS) expect(screen.queryByTestId(id)).toBeNull();
  });
  it("R2 — Réessayer relance l'appel", async () => {
    const user = userEvent.setup();
    await renderPage();
    await screen.findByTestId('message-erreur');
    const before = franceCalls().length;
    handler = okJson(FULL);
    await user.click(tid('bouton-reessayer'));
    await waitFor(() => expect(franceCalls().length).toBeGreaterThan(before));
    expect(await screen.findByTestId('prochain-match')).toBeInTheDocument();
    expect(screen.queryByTestId('message-erreur')).toBeNull();
  });
});

describe('R3 — vide', () => {
  it("R3 — vide : le message s'affiche, pas de bloc", async () => {
    handler = okJson({ nextMatch: null, results: [], squad: [] });
    await renderPage();
    expect(await screen.findByTestId('message-vide')).toHaveTextContent('Aucune donnée sur l’équipe de France pour le moment.');
    for (const id of DATA_BLOCKS) expect(screen.queryByTestId(id)).toBeNull();
  });
  it('R3 — un seul bloc renseigné : pas d’état vide', async () => {
    handler = okJson({ nextMatch: null, results: [], squad: SQUAD });
    await renderPage();
    expect(await screen.findByTestId('effectif')).toBeInTheDocument();
    expect(screen.queryByTestId('message-vide')).toBeNull();
  });
});

describe('R4 — chargé', () => {
  it('R4 — chargé : prochain match, derniers résultats et effectif présents', async () => {
    await renderPage();
    await loaded();
    expect(tid('titre-page')).toHaveTextContent('Équipe de France');
    expect(tid('sous-titre-page')).toBeInTheDocument();
    for (const id of ['surtitre-prochain-match', 'titre-prochain-match', 'prochain-match-domicile', 'prochain-match-exterieur', 'prochain-match-date', 'prochain-match-competition', 'derniers-resultats', 'surtitre-derniers-resultats', 'titre-derniers-resultats', 'effectif', 'surtitre-effectif', 'titre-effectif']) {
      expect(tid(id)).toBeInTheDocument();
    }
    expect(tid('titre-prochain-match')).toHaveTextContent('Prochain match');
    expect(tid('titre-derniers-resultats')).toHaveTextContent('Derniers résultats');
    expect(tid('titre-effectif')).toHaveTextContent('Effectif');
    expect(tid('prochain-match-domicile')).toHaveTextContent('France');
    expect(tid('prochain-match-exterieur')).toHaveTextContent('Azerbaïdjan');
    expect(tid('prochain-match-competition')).toHaveTextContent('Qualifications Coupe du monde');
    expect(screen.getAllByTestId('resultat-ligne').length).toBeGreaterThan(0);
    expect(screen.getAllByTestId('joueur-ligne').length).toBe(SQUAD.length);
    expect(screen.queryByTestId('message-chargement')).toBeNull();
    expect(screen.queryByTestId('message-vide')).toBeNull();
  });
  it("R4 — la page n'appelle qu'un seul endpoint", async () => {
    await renderPage();
    await loaded();
    const api = calls.filter((u) => u.includes('/api/') || u.includes('/france'));
    expect(api).toHaveLength(1);
    expect(api[0]).toMatch(/\/api\/france$/);
  });
});

describe('R5 — derniers résultats', () => {
  it('R5 — 5 lignes du plus récent au plus ancien', async () => {
    await renderPage();
    await loaded();
    const rows = screen.getAllByTestId('resultat-ligne');
    expect(rows).toHaveLength(5);
    expect(rows.map((r) => within(r).getByTestId('resultat-rencontre').textContent)).toEqual([
      'France – Ukraine',
      'Bosnie-Herzégovine – France',
      'France – Italie',
      'Croatie – France',
      'France – Belgique',
    ]);
  });
  it('R5 — match à l’extérieur : France en second, score domicile-extérieur', async () => {
    await renderPage();
    await loaded();
    const row = screen.getAllByTestId('resultat-ligne')[3];
    expect(within(row).getByTestId('resultat-rencontre')).toHaveTextContent('Croatie – France');
    expect(within(row).getByTestId('resultat-score')).toHaveTextContent('2-1');
    expect(within(row).getByTestId('resultat-competition')).toHaveTextContent('Ligue des nations');
    expect(within(row).getByTestId('resultat-date')).toBeInTheDocument();
  });
  it('R5 — badge V/N/D selon le score de la France', async () => {
    await renderPage();
    await loaded();
    const letters = screen.getAllByTestId('resultat-ligne').map((r) => within(r).getByTestId('resultat-badge').textContent);
    expect(letters.map((t) => t?.replace(/Victoire|Match nul|Défaite/, ''))).toEqual(['V', 'N', 'V', 'D', 'V']);
  });
  it('R5 — le badge a un nom accessible par texte masqué', async () => {
    await renderPage();
    await loaded();
    const badges = screen.getAllByTestId('resultat-badge');
    expect(badges.map((b) => b.textContent)).toEqual(['VictoireV', 'Match nulN', 'VictoireV', 'DéfaiteD', 'VictoireV']);
    for (const b of badges) {
      expect(b).not.toHaveAttribute('aria-label');
      expect(b.querySelector('[aria-hidden="true"]')).not.toBeNull();
    }
  });
  it('R5 — nom long : retour à la ligne, pas de troncature à 320 px', async () => {
    await renderPage();
    await loaded();
    const t = within(screen.getAllByTestId('resultat-ligne')[1]).getByTestId('resultat-rencontre');
    expect(t).toHaveTextContent('Bosnie-Herzégovine – France');
    let el: HTMLElement | null = t;
    while (el && el.dataset.testid !== 'derniers-resultats') {
      expect(el.className).not.toMatch(/truncate|text-ellipsis|whitespace-nowrap/);
      el = el.parentElement;
    }
  });
});

describe('R6 — sans match à venir', () => {
  it('R6 — sans match à venir : message dans le bloc, résultats et effectif présents', async () => {
    handler = okJson({ ...FULL, nextMatch: null });
    await renderPage();
    const block = await loaded();
    expect(within(block).getByTestId('titre-prochain-match')).toHaveTextContent('Prochain match');
    expect(within(block).getByTestId('message-aucun-match')).toHaveTextContent('Aucun match programmé.');
    for (const id of ['prochain-match-domicile', 'prochain-match-exterieur', 'prochain-match-date', 'prochain-match-competition']) {
      expect(screen.queryByTestId(id)).toBeNull();
    }
    expect(tid('derniers-resultats')).toBeInTheDocument();
    expect(tid('effectif')).toBeInTheDocument();
  });
});

describe('R7 — heure du prochain match', () => {
  // Prochain vendredi/samedi/dimanche, ou lundi-jeudi, à plus de 14 jours.
  const farDate = (wanted: (dow: number) => boolean) => {
    for (let n = 20; n < 40; n++) {
      const d = new Date(iso(n, 17, 0));
      if (wanted(d.getDay())) return d;
    }
    throw new Error('jour introuvable');
  };
  const dd = (d: Date) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;

  it('R7 — match dans plus de 14 jours : « Week-end du JJ/MM · Horaire à confirmer » sans heure', async () => {
    const d = farDate((w) => w === 6);
    handler = okJson({ ...FULL, nextMatch: { ...NEXT, date: d.toISOString(), timeConfirmed: false } });
    await renderPage();
    await loaded();
    const date = tid('prochain-match-date');
    expect(date.textContent).toBe(`Week-end du ${dd(d)} · Horaire à confirmer`);
    expect(within(date).getByTestId('message-heure-a-confirmer')).toHaveTextContent('Horaire à confirmer');
    expect(date.textContent).not.toMatch(/\d{1,2}h\d{2}/);
  });
  it('R7 — jour hors week-end : « Date et horaire à confirmer »', async () => {
    const d = farDate((w) => w >= 1 && w <= 4);
    handler = okJson({ ...FULL, nextMatch: { ...NEXT, date: d.toISOString(), timeConfirmed: false } });
    await renderPage();
    await loaded();
    const date = tid('prochain-match-date');
    expect(date).toHaveTextContent('Date et horaire à confirmer');
    expect(date.textContent).not.toMatch(/\d{1,2}h\d{2}/);
  });
  it("R7 — match proche : l'heure s'affiche", async () => {
    handler = okJson({ ...FULL, nextMatch: { ...NEXT, date: iso(3, 20, 45), timeConfirmed: true } });
    await renderPage();
    await loaded();
    expect(tid('prochain-match-date')).toHaveTextContent(/20h45/);
    expect(screen.queryByTestId('message-heure-a-confirmer')).toBeNull();
  });
});

describe('R8 — effectif', () => {
  it('R8 — joueurs groupés par poste avec effectifs', async () => {
    await renderPage();
    await loaded();
    const titles = screen.getAllByTestId('groupe-poste-titre').map((t) => t.textContent?.replace(/\s+/g, ' ').trim());
    expect(titles).toEqual(['Gardiens (2)', 'Défenseurs (3)', 'Milieux (2)', 'Attaquants (1)']);
    const groups = screen.getAllByTestId('groupe-poste-titre').map((t) => t.parentElement as HTMLElement);
    expect(within(groups[0]).getAllByTestId('joueur-ligne')).toHaveLength(2);
    expect(within(groups[0]).getByText('Mike Maignan')).toBeInTheDocument();
    expect(within(groups[3]).getByText('Kylian Mbappé')).toBeInTheDocument();
  });
  it('R8 — chaque ligne a un nom et un âge', async () => {
    await renderPage();
    await loaded();
    const rows = screen.getAllByTestId('joueur-ligne');
    expect(rows).toHaveLength(SQUAD.length);
    SQUAD.forEach((p) => {
      const row = rows.find((r) => r.textContent?.includes(p.name));
      expect(row, p.name).toBeDefined();
      expect(row).toHaveTextContent(new RegExp(`${p.age}\\s*ans`));
      expect(row!.querySelector('a')).toBeNull();
    });
  });
  it('R8 — le titre de groupe porte le nombre de joueurs', async () => {
    await renderPage();
    await loaded();
    for (const t of screen.getAllByTestId('groupe-poste-titre')) {
      const n = Number(/\((\d+)\)/.exec(t.textContent ?? '')?.[1]);
      expect(within(t.parentElement as HTMLElement).getAllByTestId('joueur-ligne')).toHaveLength(n);
    }
  });
});

describe('R9 — navigation', () => {
  it("R9 — l'entrée de la barre latérale pointe /equipe-de-france et est courante", async () => {
    const items = NAV_ITEMS as readonly { to: string; label: string }[];
    expect(items).toHaveLength(8);
    expect(items[7]).toMatchObject({ to: '/equipe-de-france', label: 'Équipe de France' });
    await renderAt('/equipe-de-france', () => <Sidebar eventStreamStatus="connected" />);
    const link = await screen.findByRole('link', { name: /Équipe de France/ });
    expect(link).toHaveAttribute('href', '/equipe-de-france');
    expect(link).toHaveAttribute('aria-current', 'page');
  });
  it('R9 — « Plus » est actif avec le nom « Plus, page actuelle : Équipe de France »', async () => {
    await renderAt('/equipe-de-france', () => <BottomNav />);
    const plus = await screen.findByRole('button', { name: /^Plus/ });
    expect(plus).toHaveAttribute('aria-label', 'Plus, page actuelle : Équipe de France');
  });
});
