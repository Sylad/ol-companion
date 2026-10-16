import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { LiveMatchStats } from '@/types/api';

// L167 — acceptation de l'écran page-match-equipe-de-france, côté /match/$gameId
// (docs/specs/page-match-equipe-de-france/fiche.yaml). Appel simulé (A1) : GET /api/live-match/{gameId}/stats.
// Non couverts ici (voir le rapport) : R4 (couleurs, contrastes) et R13 (reflow) demandent un navigateur.

type HookResult = { isLoading: boolean; isError: boolean; data: LiveMatchStats | undefined };
let hook: HookResult;
let search = { matchupId: '5061-2373-4672325' };
let gameId = '4672325';

vi.mock('@tanstack/react-router', () => ({
  useParams: () => ({ gameId }),
  useSearch: () => search,
  Link: ({ children, to, ...rest }: { children: React.ReactNode; to: string }) => <a href={to} {...(rest as object)}>{children}</a>,
}));
vi.mock('@/hooks/use-match-event-burst', () => ({ useMatchEventBurst: () => null }));
const reel = vi.hoisted(() => ({ actif: false, apiGet: vi.fn() }));
vi.mock('@/hooks/use-live-match', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks/use-live-match')>();
  return { ...actual, useLiveMatchStats: (g: number | null, m: string | null) => (reel.actif ? actual.useLiveMatchStats(g, m) : hook) };
});
vi.mock('@/lib/api', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/api')>()), apiGet: reel.apiGet }));
vi.mock('@/components/match-event-burst', () => ({ MatchEventBurst: () => null }));

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MatchPage } from './match';

(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };

const FR = 5061;
const BE = 2373;
const p = (id: number, name: string, jersey: number, line: number, side: number) => ({
  id, name, shortName: name, jerseyNumber: jersey, positionShort: 'CM', yardLine: line, yardSide: side, ranking: null,
});
const lineup = (base: number) => ({
  formation: '4-3-3',
  starters: [p(base + 1, 'Gardien', 1, 1, 50), p(base + 2, 'Def1', 2, 2, 20), p(base + 3, 'Def2', 3, 2, 40), p(base + 4, 'Def3', 4, 2, 60), p(base + 5, 'Def4', 5, 2, 80),
    p(base + 6, 'Mil1', 6, 3, 25), p(base + 7, 'Mil2', 7, 3, 50), p(base + 8, 'Mil3', 8, 3, 75), p(base + 9, 'Att1', 9, 4, 20), p(base + 10, 'Att2', 10, 4, 50), p(base + 11, 'Att3', 11, 4, 80)],
  bench: [p(base + 12, 'Remplaçant', 12, 0, 0)],
});
const TEAM = (k: number) => ({ Touches: 600 + k, 'Tirs au total': 14 - k, 'Tirs cadrés': 6 - k, 'Buts attendus': 1.87 - k, 'Passes Completed': 500 - 50 * k });

function stats(over: { homeId: number; awayId: number; status?: 'upcoming' | 'ended'; empty?: boolean; competitionId?: number; standings?: boolean }): LiveMatchStats {
  const { homeId, awayId, status = 'ended', empty = false, competitionId = 7016 } = over;
  const events = empty ? [] : Array.from({ length: 7 }, (_, i) => ({
    competitorId: i % 2 ? awayId : homeId, gameTime: 10 + i * 10, gameTimeDisplay: `${10 + i * 10}'`, type: 'yellowCard', isMajor: false,
    playerId: 1, extraPlayerId: null, playerName: `Joueur${i}`, playerShortName: null, extraPlayerName: null, description: 'Carton jaune',
  }));
  return {
    gameId: Number(gameId), matchupId: search.matchupId, competitionId, competitionName: 'Qualifications Coupe du monde', status,
    statusGroup: status === 'ended' ? 4 : 2, statusText: status === 'ended' ? 'Terminé' : 'À venir', gameTime: 90, gameTimeDisplay: "90'",
    startTime: '2026-11-12T20:00:00Z',
    home: { id: homeId, name: homeId === FR ? 'France' : 'Lyon', symbolicName: 'H', imageVersion: 1, score: 4 },
    away: { id: awayId, name: awayId === BE ? 'Belgique' : 'Lens', symbolicName: 'A', imageVersion: 1, score: 1 },
    teamStats: empty ? { home: {}, away: {} } : { home: TEAM(0), away: TEAM(1) },
    events,
    topPerformers: empty ? [] : [{ role: 'Buteur', homePlayer: { id: 1, name: 'Mbappé', statValue: '2', statName: 'Buts' }, awayPlayer: { id: 2, name: 'Lukaku', statValue: '1', statName: 'Buts' } }],
    shots: empty ? [] : [{ competitorId: homeId, playerId: 1, time: "12'", xg: 0.3, xgot: 0.2, bodyPart: 'Pied', outcome: 'Goal', line: 90, side: 50 }],
    momentum: empty ? undefined : [{ minute: 1, value: 20 }, { minute: 2, value: -30 }, { minute: 3, value: 10 }],
    lineups: empty ? undefined : { home: lineup(100), away: lineup(200) },
    standings: over.standings ? [] : undefined,
    updatedAt: '2026-11-12T22:00:00Z',
  } as unknown as LiveMatchStats;
}

const show = (matchupId: string, data?: Partial<Parameters<typeof stats>[0]>, h?: Partial<HookResult>) => {
  search = { matchupId };
  const [a, b] = matchupId.split('-').map(Number);
  hook = { isLoading: false, isError: false, data: stats({ homeId: a, awayId: b, ...data }), ...h };
  return render(<MatchPage />);
};
const FRANCE_AT_HOME = '5061-2373-4672325';
const bleus = () => document.body.classList.contains('theme-bleus');

beforeEach(() => {
  document.body.className = '';
  gameId = '4672325';
  reel.actif = false;
  reel.apiGet.mockReset();
});

describe('R3 — thème des Bleus décidé sur le matchupId', () => {
  it('R3 — matchupId 5061-2373-4672325 : body a la classe theme-bleus', async () => {
    show(FRANCE_AT_HOME);
    // R3 — « la page pose body.theme-bleus »
    await waitFor(() => expect(bleus()).toBe(true));
  });

  it('R3 — matchupId d’un match de l’OL : pas de classe theme-bleus', async () => {
    gameId = '10';
    const fr = show(FRANCE_AT_HOME);
    // R3 — « la page pose body.theme-bleus » (témoin : la même page, pour la France)
    await waitFor(() => expect(bleus()).toBe(true));
    fr.unmount();
    show('465-1-10', { competitionId: 35 });
    // R3 — « Un match de l’OL (465) garde sa page actuelle à l’identique. »
    expect(bleus()).toBe(false);
  });

  it('R3 — matchupId 465-1234-4650612 (5061 seulement dans le gameId ou dans un identifiant plus long) : pas de classe theme-bleus', async () => {
    const fr = show(FRANCE_AT_HOME);
    // R3 — « la page pose body.theme-bleus » (témoin)
    await waitFor(() => expect(bleus()).toBe(true));
    fr.unmount();
    show('465-1234-4650612');
    // R3 — « vaut exactement 5061 (jamais une recherche de sous-chaîne : le gameId, 3e segment, ne compte pas) »
    expect(bleus()).toBe(false);
    document.body.className = '';
    cleanupAndShow('50612-1234-99');
    expect(bleus()).toBe(false);
  });

  it('R3 — matchupId 2373-5061-4672325 (France à l’extérieur) : classe theme-bleus', async () => {
    show('2373-5061-4672325');
    // R3 — « le premier ou le deuxième segment du matchupId (identifiant domicile ou extérieur) vaut exactement 5061 »
    await waitFor(() => expect(bleus()).toBe(true));
  });

  it('R3 — en quittant la page, la classe est retirée', async () => {
    const { unmount } = show(FRANCE_AT_HOME);
    await waitFor(() => expect(bleus()).toBe(true));
    unmount();
    // R3 — « la page pose body.theme-bleus … et le retire en la quittant »
    expect(bleus()).toBe(false);
  });
});

function cleanupAndShow(matchupId: string) {
  document.body.innerHTML = '';
  return show(matchupId);
}

describe('R5 — bordure néon et barre de défilement du bloc Faits', () => {
  const css = readFileSync(path.resolve(__dirname, '../index.css'), 'utf8');
  /** Déclarations des règles dont le sélecteur contient tous les mots donnés. */
  const decls = (...mots: string[]) => {
    let out = '';
    for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) if (mots.every((w) => m[1].includes(w))) out += `${m[2]}\n`;
    return out;
  };

  it('R5 — sur un match des Bleus, la bordure du bloc Faits est bleue en haut, rouge en bas', async () => {
    show(FRANCE_AT_HOME);
    await waitFor(() => expect(bleus()).toBe(true));
    const bloc = screen.getByTestId('faits-match');
    const d = decls('theme-bleus', 'faits-bloc');
    // R5 — « dégradé vertical hsl(224 95% 65% / .95) → blanc → hsl(0 95% 65% / .95) »
    expect(d).toMatch(/hsl\(\s*224 95% 65%\s*\/\s*\.95\)/);
    expect(d).toMatch(/hsl\(\s*0 95% 65%\s*\/\s*\.95\)/);
    expect(bloc).toBeInTheDocument();
  });

  it('R5 — le curseur de la liste est blanc à bordure rouge (jetons --sb-*)', async () => {
    show(FRANCE_AT_HOME);
    await waitFor(() => expect(bleus()).toBe(true));
    const d = decls('theme-bleus', 'faits-liste', 'thumb');
    // R5 — « Sa barre de défilement prend les jetons du thème des Bleus : curseur blanc cerné de rouge »
    expect(d).toContain('--sb-thumb');
    expect(d).toContain('--sb-thumb-edge');
    // R5 — « piste --surface cernée de bleu »
    expect(decls('theme-bleus', 'faits-liste', 'track')).toContain('--sb-track-edge');
  });

  it('R5 — sur un match de l’OL, bordure et barre inchangées', async () => {
    gameId = '10';
    const fr = show(FRANCE_AT_HOME);
    await waitFor(() => expect(bleus()).toBe(true));
    // R5 — « halos bleus vers le haut et rouges vers le bas » : règles réservées au thème des Bleus
    expect(decls('theme-bleus', 'faits-bloc')).toContain('224 95% 65%');
    fr.unmount();
    show('465-1-10', { competitionId: 35 });
    // R5 — « Sur un match de l’OL, rien ne change. »
    expect(bleus()).toBe(false);
    expect(decls('.faits-liste::-webkit-scrollbar-thumb')).toContain('--ol-blue');
  });
});

describe('R6 — pas de classement sur un match des Bleus', () => {
  it('R6 — match des Bleus : pas de bloc « Classement en direct »', async () => {
    show(FRANCE_AT_HOME);
    // (ancre : la page est bien celle des Bleus, R8)
    await screen.findByTestId('lien-retour-equipe');
    // R6 — « Le « Classement en direct » est absent sur un match des Bleus »
    expect(screen.queryByText('Classement en direct')).toBeNull();
    expect(screen.queryByTestId('classement-direct')).toBeNull();
  });
});

describe('R7 — contenu de /match', () => {
  const ORDRE = ['entete-score', 'faits-match', 'elan', 'carte-tirs', 'bloc-statistiques', 'bloc-composition', 'stats-equipe-domicile', 'stats-equipe-visiteur', 'joueurs-en-vue'];

  it('R7 — match des Bleus : tous les blocs de /match sont présents, dans le même ordre', async () => {
    show(FRANCE_AT_HOME);
    const els = await Promise.all(ORDRE.map(async (id) => (await screen.findAllByTestId(id))[0]));
    // R7 — « même ordre du DOM que match.tsx (en-tête, faits, Momentum, tirs, statistiques, compositions et statistiques par équipe, puis joueurs en vue) »
    for (let i = 1; i < els.length; i++) {
      expect(els[i - 1].compareDocumentPosition(els[i]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });

  it('R7 — un seul appel /api/live-match/4672325/stats', async () => {
    reel.actif = true;
    reel.apiGet.mockResolvedValue(stats({ homeId: FR, awayId: BE }));
    search = { matchupId: FRANCE_AT_HOME };
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MatchPage />
      </QueryClientProvider>,
    );
    await screen.findByTestId('stats-equipe-domicile');
    // R7 — « Un seul appel : GET /api/live-match/{gameId}/stats »
    expect(reel.apiGet).toHaveBeenCalledTimes(1);
    expect(String(reel.apiGet.mock.calls[0][0])).toContain('/live-match/4672325/stats');
  });
});

describe('R8 — lien de retour', () => {
  it('R8 — match des Bleus : le lien de retour a pour nom accessible « Équipe de France » (sans caractère « ← »), contient une icône svg et mène à /equipe-de-france', async () => {
    show(FRANCE_AT_HOME);
    const lien = await screen.findByTestId('lien-retour-equipe');
    // R8 — « icône flèche ArrowLeft (décorative, aria-hidden) suivie du texte « Équipe de France » »
    expect(lien.textContent?.trim()).toBe('Équipe de France');
    expect(lien.textContent).not.toContain('←');
    const svg = lien.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    // R8 — « mène à /equipe-de-france quand le match est celui des Bleus »
    expect(lien).toHaveAttribute('href', '/equipe-de-france');
  });
});

describe('R9 — chargement', () => {
  it('R9 — chargement : message, aucun bloc', async () => {
    show(FRANCE_AT_HOME, undefined, { isLoading: true, data: undefined });
    // R9 — « le message existant s’affiche, sans grille »
    expect(screen.getByTestId('message-chargement')).toHaveTextContent('Chargement du match…');
    expect(screen.queryByTestId('grille-match')).toBeNull();
    // R3 — « pour que le thème soit là dès le chargement »
    expect(bleus()).toBe(true);
  });
});

describe('R10 — erreur', () => {
  it('R10 — erreur : message et lien « Retour à l\'équipe de France » (apostrophe droite)', async () => {
    show(FRANCE_AT_HOME, undefined, { isError: true, data: undefined });
    // R10 — « l’erreur existante s’affiche » (message « Match introuvable »)
    expect(screen.getByTestId('message-erreur')).toHaveTextContent('Match introuvable');
    const lien = screen.getByTestId('lien-retour-erreur');
    // R10 — « le lien de retour dit « Retour à l'équipe de France » (apostrophe droite U+0027) et y mène »
    expect(lien.textContent?.trim()).toBe("Retour à l'équipe de France");
    expect(lien).toHaveAttribute('href', '/equipe-de-france');
  });
});

describe('R11 — match des Bleus à venir', () => {
  const venir = () => show(FRANCE_AT_HOME, { status: 'upcoming', empty: true });

  it('R11 — match à venir : aucun bloc Faits, message de statistiques', async () => {
    venir();
    // R11 — « le bloc Statistiques dit l’absence de chiffres »
    expect(await screen.findByTestId('message-stats-vide')).toHaveTextContent('Les statistiques apparaîtront au coup d’envoi.');
    // R11 — « les blocs Faits, Momentum et tirs ne sont pas affichés »
    for (const id of ['faits-match', 'elan', 'carte-tirs']) expect(screen.queryByTestId(id)).toBeNull();
  });

  it('R11 — match à venir : date et heure du coup d’envoi dans l’en-tête, sur une seule ligne à 390 px', async () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 390 });
    venir();
    const date = await screen.findByTestId('coup-envoi');
    // R11 — « l’en-tête annonce « À venir » avec la date et l’heure du coup d’envoi (startTime, « Jeu. 12/11 · 21h00 »… »
    expect(screen.getByTestId('entete-score')).toContainElement(date);
    expect(screen.getByTestId('entete-score')).toHaveTextContent('À venir');
    expect(date.textContent?.trim()).toBe('Jeu. 12/11 · 21h00');
    // R11 — « sur une seule ligne : jamais coupée »
    expect(date.querySelector('br')).toBeNull();
  });
});

describe('R12 — hors Bleus, rien ne change', () => {
  it('R12 — match de l’OL : rendu inchangé', async () => {
    gameId = '10';
    const fr = show(FRANCE_AT_HOME);
    // (témoin : la page des Bleus a bien changé)
    await screen.findByTestId('lien-retour-equipe');
    fr.unmount();
    show('465-1-10', { competitionId: 35, standings: true });
    // R12 — « /match d’un match de l’OL (… icône + « Accueil ») »
    const retour = screen.getByText('Accueil').closest('a')!;
    expect(retour.querySelector('svg')).not.toBeNull();
    expect(screen.queryByTestId('lien-retour-equipe')).toBeNull();
    expect(bleus()).toBe(false);
  });
});
