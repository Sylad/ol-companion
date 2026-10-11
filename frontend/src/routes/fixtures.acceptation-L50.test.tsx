import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FixturesPage } from './fixtures';

// Acceptation L50 — écran « Calendrier — densité » (/fixtures), écrit d'après la fiche et la maquette
// (docs/specs/calendrier). Source : GET /api/season-matches.
// Le rendu (CSS réel) n'est pas calculé par jsdom : les règles de mise en page (R7, R9) sont vérifiées
// sur les classes Tailwind responsives des éléments (largeur simulée par un petit résolveur) et, pour
// `html { scroll-padding… }`, sur la feuille src/index.css.

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, params, search, ...rest }: any) => (
    <a {...rest} href={`${String(to).replace('$gameId', params?.gameId)}?matchupId=${search?.matchupId}`}>
      {children}
    </a>
  ),
}));

type M = {
  id: number;
  date: string;
  homeTeam: string;
  homeTeamId: number;
  awayTeam: string;
  awayTeamId: number;
  homeScore: number | null;
  awayScore: number | null;
  competition: string;
  competitionCode: 'L1' | 'UCL' | 'UEL';
  competitionId: number;
  status: 'FINISHED' | 'SCHEDULED';
  matchday: number | null;
  round: string | null;
  timeConfirmed: boolean;
};
const OL = { id: 523, name: 'Lyon' };
function match(
  id: number,
  date: string,
  home: string,
  away: string,
  score: [number, number] | null,
  code: M['competitionCode'],
  matchday: number | null,
  extra: Partial<M> = {},
): M {
  const comp = { L1: ['Ligue 1', 35], UCL: ['UEFA Champions League', 332], UEL: ['UEFA Europa League', 573] } as const;
  return {
    id,
    date,
    homeTeam: home,
    homeTeamId: home === OL.name ? OL.id : 9000 + id,
    awayTeam: away,
    awayTeamId: away === OL.name ? OL.id : 9000 + id,
    homeScore: score ? score[0] : null,
    awayScore: score ? score[1] : null,
    competition: comp[code][0],
    competitionCode: code,
    competitionId: comp[code][1],
    status: score ? 'FINISHED' : 'SCHEDULED',
    matchday,
    round: null,
    timeConfirmed: true,
    ...extra,
  };
}
// 7 matchs, dans l'ordre des dates : 3 joués (1 V, 0 N, 2 D), 4 à venir ; L1 4, C1 1, C3 2.
const SEASON: M[] = [
  match(101, '2026-08-04T18:00:00.000Z', 'Sparta Praha', 'Lyon', [2, 1], 'UCL', null, { round: '3e tour de qualification · aller' }),
  match(102, '2026-09-04T18:45:00.000Z', 'Lyon', 'Auxerre', [3, 1], 'L1', 3),
  match(103, '2026-10-09T18:45:00.000Z', 'Lens', 'Lyon', [2, 1], 'L1', 6),
  match(104, '2026-10-15T16:45:00.000Z', 'Lyon', 'Crystal Palace', null, 'UEL', 2),
  match(105, '2026-10-18T18:45:00.000Z', 'Lyon', 'Nice', null, 'L1', 7),
  match(106, '2026-12-05T17:00:00.000Z', 'Troyes', 'Lyon', null, 'L1', 13, { timeConfirmed: false }),
  match(107, '2026-12-10T20:00:00.000Z', 'Lyon', 'Union SG', null, 'UEL', 6),
];

const okJson = (body: unknown) => ({ ok: true, status: 200, json: async () => body });
const notFound = { ok: false, status: 404, json: async () => ({}) };
function serve(body: unknown = SEASON) {
  return vi.fn((url: string) => {
    if (url === '/api/season-matches') return Promise.resolve(okJson(body));
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
const tid = (id: string) => screen.getByTestId(id);
const loaded = () => screen.findByTestId('liste-mois');
const rows = () => screen.getAllByTestId('ligne-match');
const rowFor = (gameId: number) => {
  const r = rows().find((el) => within(el).getByRole('link').getAttribute('href')?.startsWith(`/match/${gameId}?`));
  if (!r) throw new Error(`ligne du match ${gameId} introuvable`);
  return r;
};
const text = (el: Element) => (el.textContent ?? '').replace(/\s+/g, ' ').trim();
const pill = (group: string, name: RegExp) => within(tid(group)).getByRole('button', { name });
const monthTitles = () => screen.queryAllByTestId('titre-mois').map(text);
const monthCounts = () => screen.queryAllByTestId('nombre-matchs-mois').map((e) => Number(/\d+/.exec(text(e))?.[0]));

beforeAll(() => {
  process.env.TZ = 'Europe/Paris';
});
afterAll(() => {
  delete process.env.TZ;
});
afterEach(() => vi.unstubAllGlobals());
beforeEach(() => vi.stubGlobal('fetch', serve()));

// ---- résolveur de classes Tailwind responsives (jsdom ne calcule pas le CSS) ----
const MIN: Record<string, number> = { sm: 640, md: 768, lg: 1024, xl: 1280 };
const MAX: Record<string, number> = { 'max-sm': 640, 'max-md': 768, 'max-lg': 1024 };
function applicable(prefixes: string[], w: number): number | null {
  let rank = 0;
  for (const p of prefixes) {
    if (p in MIN) {
      if (w < MIN[p]) return null;
      rank = Math.max(rank, MIN[p]);
    } else if (p in MAX) {
      if (w >= MAX[p]) return null;
      rank = Math.max(rank, 1);
    } else return null; // hover:, focus:, after:… ne s'appliquent pas à l'élément lui-même
  }
  return rank;
}
/** Dernier utilitaire correspondant à `re` qui s'applique à cette largeur (les variantes plus larges l'emportent). */
function eff(el: Element, w: number, re: RegExp): string | null {
  let best: { rank: number; tok: string } | null = null;
  for (const raw of (el.getAttribute('class') ?? '').split(/\s+/).filter(Boolean)) {
    const parts = raw.split(/:(?![^[]*\])/);
    const util = parts[parts.length - 1];
    if (!re.test(util)) continue;
    const rank = applicable(parts.slice(0, -1), w);
    if (rank === null) continue;
    if (!best || rank >= best.rank) best = { rank, tok: util };
  }
  return best ? best.tok : null;
}
const inherited = (el: Element, w: number, re: RegExp, stop: Element): string | null => {
  for (let cur: Element | null = el; cur; cur = cur.parentElement) {
    const t = eff(cur, w, re);
    if (t) return t;
    if (cur === stop) break;
  }
  return null;
};
const POS = /^(static|relative|sticky|fixed|absolute)$/;
const ancestors = (el: Element) => {
  const out: Element[] = [];
  for (let cur: Element | null = el; cur && cur !== document.body; cur = cur.parentElement) out.push(cur);
  return out;
};
const stickyAncestor = (el: Element, w: number) => ancestors(el).find((a) => eff(a, w, POS) === 'sticky');
const noEllipsis = (el: Element) =>
  [el, ...Array.from(el.querySelectorAll('*'))].every((n) => !/(^|\s)(truncate|text-ellipsis|whitespace-nowrap|overflow-hidden)(\s|$)/.test(n.getAttribute('class') ?? ''));
const coversAll = (container: Element, link: Element, w = 390) =>
  link.contains(container.querySelector('[data-testid="score-match"]') ?? container) ||
  (/after:absolute/.test(link.getAttribute('class') ?? '') &&
    /after:inset-0/.test(link.getAttribute('class') ?? '') &&
    ancestors(link).some((a) => a !== document.body && eff(a, w, POS) === 'relative' && container.contains(a) || a === container));

describe('R1 — chargement', () => {
  it("R1 — chargement : le message s'affiche", async () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
    renderPage();
    expect(await screen.findByTestId('message-chargement')).toHaveTextContent('Chargement des matchs…');
    expect(tid('titre-page')).toHaveTextContent('Calendrier');
    for (const id of ['barre-filtres', 'liste-mois', 'message-erreur', 'message-vide']) expect(screen.queryByTestId(id)).toBeNull();
  });
});

describe('R2 — erreur', () => {
  it("R2 — erreur : le message s'affiche", async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: false, status: 500, json: async () => ({}) })));
    renderPage();
    expect(await screen.findByTestId('message-erreur')).toHaveTextContent('Erreur de chargement.');
    expect(tid('titre-page')).toHaveTextContent('Calendrier');
    expect(screen.queryByRole('button', { name: /réessayer/i })).toBeNull();
    for (const id of ['barre-filtres', 'liste-mois', 'message-chargement']) expect(screen.queryByTestId(id)).toBeNull();
  });
});

describe('R3 — vide', () => {
  it('R3 — vide : C1 + À venir affiche le message, ni liste ni vue rapide, filtres présents (C1 et À venir actifs, compteur 0)', async () => {
    renderPage();
    await loaded();
    const user = userEvent.setup();
    await user.click(pill('filtre-competition', /^C1 — /));
    await user.click(pill('filtre-statut', /^À venir · /));
    expect(await screen.findByTestId('message-vide')).toHaveTextContent('Aucun match dans cette catégorie.');
    expect(screen.queryByTestId('liste-mois')).toBeNull();
    expect(screen.queryByTestId('vue-rapide')).toBeNull();
    expect(screen.queryByTestId('ligne-match')).toBeNull();
    expect(tid('barre-filtres')).toBeInTheDocument();
    expect(pill('filtre-competition', /^C1 — Ligue des champions · 0 match/)).toHaveAttribute('aria-pressed', 'true');
    expect(pill('filtre-statut', /^À venir · 0 match/)).toHaveAttribute('aria-pressed', 'true');
    // les filtres restent utilisables pour changer de choix
    await user.click(pill('filtre-statut', /^Tout · /));
    expect(await loaded()).toBeInTheDocument();
    expect(screen.queryByTestId('message-vide')).toBeNull();
  });
});

describe('R4 — blocs par mois', () => {
  it('R4 — charge : un bloc par mois, titre et nombre de matchs', async () => {
    renderPage();
    await loaded();
    expect(screen.getAllByTestId('bloc-mois')).toHaveLength(4);
    expect(monthTitles()).toEqual(['Août 2026', 'Septembre 2026', 'Octobre 2026', 'Décembre 2026']); // pas de bloc pour novembre
    screen.getAllByTestId('nombre-matchs-mois').forEach((el, i) => expect(text(el)).toMatch(new RegExp(`^${[1, 1, 3, 2][i]}\\s+match`)));
    // le mois quitte la colonne de date ; plus de blocs par compétition ou journée
    const sparta = text(within(rowFor(101)).getByTestId('date-match'));
    expect(sparta).toMatch(/Mar\.?\s*04/);
    expect(sparta).not.toMatch(/août|\/08/i);
    expect(text(within(rowFor(104)).getByTestId('date-match'))).toMatch(/Jeu\.?\s*15/);
    expect(text(within(rowFor(104)).getByTestId('date-match'))).not.toMatch(/octobre|oct\./i);
    for (const h of screen.queryAllByRole('heading', { level: 3 })) expect(text(h)).not.toMatch(/^Ligue (1|Europa|des champions) · /);
    // un match à jour non fixé reste dans le mois de sa date de remplissage
    const dec = screen.getAllByTestId('bloc-mois')[3];
    expect(within(dec).getAllByTestId('ligne-match')).toHaveLength(2);
    expect(text(within(rowFor(106)).getByTestId('date-match'))).toMatch(/Week-end\s*du 05\/12/);
  });
  it('R4 — la somme des nombres de matchs égale « Matchs listés »', async () => {
    renderPage();
    await loaded();
    const listed = Number(/Matchs listés\s*(\d+)/.exec(text(tid('vue-rapide')))?.[1]);
    expect(listed).toBe(7);
    expect(monthCounts().reduce((a, b) => a + b, 0)).toBe(listed);
    expect(rows()).toHaveLength(listed);
    expect(text(tid('vue-rapide'))).toMatch(/1\s*V/);
    expect(text(tid('vue-rapide'))).toMatch(/0\s*N/);
    expect(text(tid('vue-rapide'))).toMatch(/2\s*D/);
  });
  it("R4 — l'ordre des dates est conservé", async () => {
    renderPage();
    await loaded();
    const ids = rows().map((r) => Number(/\/match\/(\d+)\?/.exec(within(r).getByRole('link').getAttribute('href') ?? '')?.[1]));
    expect(ids).toEqual([101, 102, 103, 104, 105, 106, 107]);
    // chaque ligne est dans le bloc du mois de sa date
    const blocks = screen.getAllByTestId('bloc-mois');
    expect(within(blocks[2]).getAllByTestId('ligne-match').map((r) => r)).toEqual([rowFor(103), rowFor(104), rowFor(105)]);
  });
});

describe('R5 — compétition dans la ligne', () => {
  it("R5 — le nom du lien d'un match joué contient les deux scores et les noms affichés", async () => {
    renderPage();
    await loaded();
    expect(within(rowFor(101)).getByRole('link', { name: 'Sparta Praha 2, Lyon 1 — détail du match' })).toBeInTheDocument();
    expect(within(rowFor(103)).getByRole('link', { name: 'Lens 2, Lyon 1 — détail du match' })).toBeInTheDocument();
    expect(within(rowFor(107)).getByRole('link', { name: 'Lyon contre Union SG — détail du match' })).toBeInTheDocument();
    expect(within(rowFor(106)).getByRole('link', { name: 'Troyes contre Lyon — détail du match' })).toBeInTheDocument();
  });
  it('R5 — chaque ligne affiche sigle et journée', async () => {
    renderPage();
    await loaded();
    const expected: Record<number, [string, string, string | null]> = {
      101: ['C1', 'Ligue des champions', null],
      102: ['L1', 'Ligue 1', 'J3'],
      104: ['C3', 'Ligue Europa', 'J2'],
      106: ['L1', 'Ligue 1', 'J13'],
      107: ['C3', 'Ligue Europa', 'J6'],
    };
    for (const [id, [short, long, j]] of Object.entries(expected)) {
      const cmp = within(rowFor(Number(id))).getByTestId('competition-match');
      expect(text(cmp)).toContain(short);
      expect(cmp.querySelector('abbr')).toHaveAttribute('title', long);
      expect(text(cmp)).toContain(long); // nom long pour les lecteurs d'écran
      if (j) expect(text(cmp)).toMatch(new RegExp(`· ${j}\\b`));
      else expect(text(cmp)).not.toMatch(/\bJ\d+/);
    }
  });
  it('R5 — un match de qualification affiche son tour et sa manche', async () => {
    renderPage();
    await loaded();
    expect(within(rowFor(101)).getByTestId('tour-match')).toHaveTextContent('3e tour de qualification · aller');
    expect(within(rowFor(102)).queryByTestId('tour-match')).toBeNull();
    expect(screen.getAllByTestId('tour-match')).toHaveLength(1);
  });
});

describe('R6 — ligne entière vers le match', () => {
  it('R6 — la ligne entière mène au match', async () => {
    renderPage();
    await loaded();
    for (const r of rows()) {
      const links = within(r).getAllByRole('link');
      expect(links).toHaveLength(1);
      expect(links[0].getAttribute('href')).toMatch(/^\/match\/\d+\?/);
      expect(within(r).getByTestId('equipes-match')).toContainElement(links[0]);
      expect(coversAll(r, links[0])).toBe(true);
    }
  });
  it('R6 — heure ou « Horaire à confirmer », jamais les deux', async () => {
    renderPage();
    await loaded();
    const score = (id: number) => text(within(rowFor(id)).getByTestId('score-match'));
    expect(score(101)).toBe('Terminé');
    expect(score(103)).toBe('Terminé');
    expect(score(104)).toBe('18h45');
    expect(score(105)).toBe('20h45');
    expect(score(107)).toBe('21h00');
    expect(score(106)).toMatch(/^Horaire\s*à confirmer$/);
    expect(score(106)).not.toMatch(/\d{2}h\d{2}/);
    expect(text(within(rowFor(106)).getByTestId('date-match'))).toMatch(/^Week-end\s*du 05\/12$/);
  });
});

describe('R7 — filtres collants au téléphone', () => {
  it('R7 — 390 px : après défilement, les pastilles restent visibles en haut', async () => {
    renderPage();
    await loaded();
    const sticky = stickyAncestor(tid('barre-filtres'), 390);
    expect(sticky).toBeDefined();
    expect(eff(sticky!, 390, /^top-/)).toBe('top-0');
    expect(sticky).toContainElement(tid('filtre-competition'));
    expect(sticky).toContainElement(tid('filtre-statut'));
    const bg = eff(sticky!, 390, /^bg-/);
    expect(bg).toBeTruthy();
    expect(bg).not.toMatch(/transparent|\//); // fond opaque
    // les deux groupes de filtres sont des groupes nommés
    expect(within(tid('filtre-competition')).getAllByRole('button').length).toBe(4);
    expect(within(tid('filtre-statut')).getAllByRole('button').length).toBe(3);
  });
  it('R7 — 390 px : la légende des sigles est visible sous la barre', async () => {
    renderPage();
    await loaded();
    const legend = tid('legende-competitions');
    const sticky = stickyAncestor(tid('barre-filtres'), 390);
    expect(sticky).toBeDefined();
    expect(sticky!.contains(legend)).toBe(false); // hors de la zone collante, dans le flux
    expect(ancestors(legend).some((a) => eff(a, 390, /^(hidden|block|flex|grid|inline|inline-block|inline-flex)$/) === 'hidden')).toBe(false);
    for (const t of ['L1', 'Ligue 1', 'C1', 'Ligue des champions', 'C3', 'Ligue Europa']) expect(text(legend)).toContain(t);
    // sous la barre dans l'ordre du document
    expect(sticky!.compareDocumentPosition(legend) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
  it("R7 — 390 px : un lien focalisé au clavier n'est jamais sous la barre collante ni sous la navigation du bas", async () => {
    renderPage();
    await loaded();
    const css = readFileSync(resolve(__dirname, '../index.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    const media = /@media[^{]*\(\s*max-width:\s*1023(?:\.98)?px\s*\)[^{]*\{/g;
    let found = false;
    for (let m = media.exec(css); m; m = media.exec(css)) {
      let depth = 1;
      let i = m.index + m[0].length;
      const start = i;
      while (i < css.length && depth > 0) depth += css[i] === '{' ? 1 : css[i] === '}' ? -1 : 0, i++;
      const body = css.slice(start, i - 1);
      const html = /(^|[}\s,])html\s*\{([^}]*)\}/.exec(body);
      if (html && /scroll-padding-top:\s*124px/.test(html[2]) && /scroll-padding-bottom:\s*72px/.test(html[2])) found = true;
    }
    expect(found).toBe(true);
    // et la barre collante existe bien à cette largeur
    expect(stickyAncestor(tid('barre-filtres'), 390)).toBeDefined();
  });
  it('R7 — 320 px : pas de défilement horizontal, nom des pastilles commençant par leur texte affiché', async () => {
    renderPage();
    await loaded();
    for (const g of ['filtre-competition', 'filtre-statut']) {
      const group = tid(g);
      expect(eff(group, 320, /^flex-(wrap|nowrap)$/)).toBe('flex-wrap'); // les pastilles passent à la ligne
      for (const a of ancestors(group)) expect(a.getAttribute('class') ?? '').not.toMatch(/overflow-x-(auto|scroll)|(^|\s)overflow-(auto|scroll)/);
      for (const b of within(group).getAllByRole('button')) {
        const visible = (b.textContent ?? '').replace(/\d+\s*$/, '').trim();
        const name = b.getAttribute('aria-label') ?? '';
        expect(name.startsWith(visible)).toBe(true); // WCAG 2.5.3
        expect(name).toMatch(/ · \d+ match/);
      }
    }
    // sigle — nom · n matchs
    expect(pill('filtre-competition', /^L1 — Ligue 1 · 4 match/)).toBeInTheDocument();
    expect(pill('filtre-competition', /^C1 — Ligue des champions · 1 match/)).toBeInTheDocument();
    expect(pill('filtre-competition', /^C3 — Ligue Europa · 2 match/)).toBeInTheDocument();
    // les noms de club se coupent aux espaces, sans ellipse
    for (const e of screen.getAllByTestId('equipes-match')) expect(noEllipsis(e)).toBe(true);
  });
  it("R7 — 1440 px : la barre n'est pas collante", async () => {
    renderPage();
    await loaded();
    expect(stickyAncestor(tid('barre-filtres'), 1440)).toBeUndefined();
    // elle l'est bien en dessous de 1024 px : la différence vient de la largeur
    expect(stickyAncestor(tid('barre-filtres'), 1023)).toBeDefined();
    // au bureau les filtres restent dans l'en-tête de la page (avant la liste)
    expect(tid('barre-filtres').compareDocumentPosition(tid('liste-mois')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe('R8 — cartes cliquables', () => {
  it("R8 — un clic n'importe où sur la carte Prochain ouvre le match", async () => {
    renderPage();
    await loaded();
    const card = tid('carte-prochain');
    const links = within(card).getAllByRole('link');
    expect(links).toHaveLength(1);
    expect(links[0].getAttribute('href')).toMatch(/^\/match\/104\?/);
    expect(links[0].getAttribute('aria-label') ?? text(links[0])).toMatch(/^Prochain\s*[,:]\s*Lyon contre Crystal Palace — détail du match$/);
    expect(text(card)).toContain('Crystal Palace');
    expect(links[0].contains(card.querySelector('[class*="num"]') ?? links[0]) || coversAll(card, links[0])).toBe(true);
    expect(/›|chevron/i.test(card.innerHTML) || card.querySelector('svg')).toBeTruthy(); // le chevron signale le lien
    expect(coversAll(card, links[0])).toBe(true);
  });
  it('R8 — la carte Dernier résultat est cliquable aussi', async () => {
    renderPage();
    await loaded();
    const card = tid('carte-dernier-resultat');
    const links = within(card).getAllByRole('link');
    expect(links).toHaveLength(1);
    expect(links[0].getAttribute('href')).toMatch(/^\/match\/103\?/);
    expect(links[0].getAttribute('aria-label') ?? text(links[0])).toMatch(/^Dernier résultat\s*[,:]\s*Lens 2, Lyon 1 — détail du match$/);
    expect(/›|chevron/i.test(card.innerHTML) || card.querySelector('svg')).toBeTruthy();
    expect(coversAll(card, links[0])).toBe(true);
  });
});

describe('R9 — vue rapide compacte', () => {
  it('R9 — 390 px : la première ligne de match est visible sans défilement sur 844 px de haut', async () => {
    renderPage();
    await loaded();
    const vr = tid('vue-rapide');
    // chiffres V N D : une seule ligne avec « Matchs listés », 19 px gras minimum
    const leaves = Array.from(vr.querySelectorAll('*')).filter(
      (e) => /^\d+\s*[VND]$/.test(text(e)) && !Array.from(e.children).some((c) => /^\d+\s*[VND]$/.test(text(c))),
    );
    expect(leaves).toHaveLength(3);
    const parent = leaves[0].parentElement!;
    for (const l of leaves) expect(l.parentElement).toBe(parent);
    expect(text(parent)).toContain('Matchs listés');
    const SIZES: Record<string, number> = { 'text-lg': 18, 'text-xl': 20, 'text-2xl': 24, 'text-3xl': 30, 'text-4xl': 36 };
    for (const l of leaves) {
      const size = inherited(l, 390, /^text-(\[\d+(\.\d+)?px\]|lg|xl|2xl|3xl|4xl)$/, vr);
      const px = size ? (size.startsWith('text-[') ? parseFloat(size.slice(6)) : SIZES[size]) : 0;
      expect(px).toBeGreaterThanOrEqual(19);
      expect(inherited(l, 390, /^font-(bold|extrabold|black)$/, vr)).toBeTruthy();
    }
    // vue rapide et cartes avant la liste dans le flux ; colonne collante au bureau
    for (const id of ['vue-rapide', 'carte-prochain', 'carte-dernier-resultat'])
      expect(tid(id).compareDocumentPosition(tid('liste-mois')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const col = ancestors(tid('carte-prochain')).find((a) => eff(a, 1440, POS) === 'sticky');
    expect(col).toBeDefined();
    expect(col).toContainElement(vr);
  });
});

describe('R10 — filtres et blocs', () => {
  it('R10 — un filtre actif retire les mois vides et met à jour les nombres', async () => {
    renderPage();
    await loaded();
    const user = userEvent.setup();
    // Joués : le mois de décembre disparaît, les nombres suivent
    await user.click(pill('filtre-statut', /^Joués · /));
    expect(monthTitles()).toEqual(['Août 2026', 'Septembre 2026', 'Octobre 2026']);
    expect(monthCounts()).toEqual([1, 1, 1]);
    expect(rows()).toHaveLength(3);
    // + L1 : août (C1) disparaît aussi
    await user.click(pill('filtre-competition', /^L1 — /));
    expect(monthTitles()).toEqual(['Septembre 2026', 'Octobre 2026']);
    expect(monthCounts()).toEqual([1, 1]);
    // À venir seul avec L1 : octobre (Nice) et décembre (Troyes, jour non fixé rangé à sa date de remplissage)
    await user.click(pill('filtre-statut', /^À venir · /));
    expect(monthTitles()).toEqual(['Octobre 2026', 'Décembre 2026']);
    expect(monthCounts()).toEqual([1, 1]);
    // les compteurs d'un groupe suivent le choix de l'autre : avec À venir actif
    await user.click(pill('filtre-competition', /^Toutes · /));
    expect(pill('filtre-competition', /^Toutes · 4 match/)).toBeInTheDocument();
    expect(pill('filtre-competition', /^L1 — Ligue 1 · 2 match/)).toBeInTheDocument();
    expect(pill('filtre-competition', /^C1 — Ligue des champions · 0 match/)).toBeInTheDocument();
    expect(pill('filtre-competition', /^C3 — Ligue Europa · 2 match/)).toBeInTheDocument();
    // avec C1 actif : Tout 1, À venir 0, Joués 1
    await user.click(pill('filtre-competition', /^C1 — /));
    expect(pill('filtre-statut', /^Tout · 1 match/)).toBeInTheDocument();
    expect(pill('filtre-statut', /^À venir · 0 match/)).toBeInTheDocument();
    expect(pill('filtre-statut', /^Joués · 1 match/)).toBeInTheDocument();
  });
});
