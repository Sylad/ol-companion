import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import type { LiveMatchStats } from '@/types/api';

// L179 — « Joueurs en vue » et « Statistiques » : libellés 365scores en français, nombres à virgule, période dite
// avant le coup d'envoi, carte des tirs nommée en français (revue UX L9).

let data: LiveMatchStats;
vi.mock('@tanstack/react-router', () => ({
  useParams: () => ({ gameId: '4672325' }),
  useSearch: () => ({ matchupId: '523-1234-4672325' }),
  Link: ({ children, to, ...rest }: { children: React.ReactNode; to: string }) => <a href={to} {...(rest as object)}>{children}</a>,
}));
vi.mock('@/hooks/use-match-event-burst', () => ({ useMatchEventBurst: () => null }));
vi.mock('@/hooks/use-live-match', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/hooks/use-live-match')>()),
  useLiveMatchStats: () => ({ isLoading: false, isError: false, data }),
}));
vi.mock('@/components/match-event-burst', () => ({ MatchEventBurst: () => null }));

import { MatchPage } from './match';

(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };

const perf = (role: string, statName: string, statValue: string) => ({
  role,
  homePlayer: { id: 1, name: 'Joueur-Domicile', statName, statValue },
  awayPlayer: { id: 2, name: 'Joueur-Visiteur', statName, statValue },
});

const match = (status: 'upcoming' | 'finished', topPerformers: unknown[]): LiveMatchStats => ({
  gameId: 4672325, matchupId: '523-1234-4672325', competitionId: 35, competitionName: 'Ligue 1',
  status, statusGroup: status === 'upcoming' ? 1 : 4, statusText: 'x', gameTime: 0, gameTimeDisplay: '',
  startTime: '2026-11-12T20:00:00Z',
  home: { id: 523, name: 'Lyon', symbolicName: 'OL', imageVersion: 1, score: 1 },
  away: { id: 1234, name: 'Lens', symbolicName: 'RCL', imageVersion: 1, score: 0 },
  teamStats: { home: { Touches: 600, 'Tirs au total': 10, 'Tirs cadrés': 4, 'Buts attendus': 1.03 }, away: { Touches: 500, 'Tirs au total': 8, 'Tirs cadrés': 2, 'Buts attendus': 0.5 } },
  events: [], topPerformers,
  shots: [{ competitorId: 523, playerId: 1, time: "23'", xg: 0.24, xgot: 0.5, bodyPart: 'Pied', outcome: 'But', line: 90, side: 40 }],
  updatedAt: '2026-10-17T12:00:00Z',
} as unknown as LiveMatchStats);

describe('Page match — libellés et nombres en français (L179)', () => {
  it('R1 — Joueurs en vue : « Tackles » et « Les interceptions » sont écrits en français', () => {
    data = match('finished', [perf('Défenseur', 'Tackles', '3'), perf('Défenseur', 'Les interceptions', '2')]);
    render(<MatchPage />);
    const bloc = screen.getByTestId('joueurs-en-vue');
    expect(within(bloc).getAllByText(/^Tacles :/).length).toBe(2);
    expect(within(bloc).getAllByText(/^Interceptions :/).length).toBe(2);
    expect(bloc.textContent).not.toMatch(/Tackles|Les interceptions/);
  });

  it('R1 — Joueurs en vue : le rôle anglais d’un match à venir est traduit', () => {
    data = match('upcoming', [perf('Attacker', 'Goals', '4')]);
    render(<MatchPage />);
    const bloc = screen.getByTestId('joueurs-en-vue');
    expect(within(bloc).getByText('Attaquant')).toBeInTheDocument();
    expect(bloc.textContent).not.toMatch(/Attacker|Goals/);
  });

  it('R2 — Joueurs en vue : « Buts attendus : 0.24 » s’écrit avec la virgule', () => {
    data = match('finished', [perf('Attaquant', 'Buts attendus', '0.24'), perf('Attaquant', 'Minutes', '45')]);
    render(<MatchPage />);
    const bloc = screen.getByTestId('joueurs-en-vue');
    expect(within(bloc).getAllByText('0,24').length).toBe(2);
    expect(bloc.textContent).not.toMatch(/\d\.\d/);
    expect(within(bloc).getAllByText('45').length).toBe(2);
  });

  it('R2 — Carte des tirs : le xG de l’infobulle a la virgule', () => {
    data = match('finished', []);
    const { container } = render(<MatchPage />);
    const titres = [...container.querySelectorAll('[data-testid="carte-tirs"] title')].map((t) => t.textContent ?? '');
    expect(titres.some((t) => t.includes('xG 0,24'))).toBe(true);
    expect(titres.some((t) => /\d\.\d/.test(t))).toBe(false);
  });

  it('R3 — match à venir : le bloc dit que les chiffres sont d’avant-match (« Buts : 0 » n’est pas ce match)', () => {
    data = match('upcoming', [perf('Attaquant', 'Buts', '0')]);
    render(<MatchPage />);
    expect(within(screen.getByTestId('joueurs-en-vue')).getByTestId('periode-joueurs-en-vue')).toHaveTextContent(
      'Chiffres de la saison avant le coup d’envoi, pas de ce match.',
    );
  });

  it('R3 — match terminé : pas de mention de période', () => {
    data = match('finished', [perf('Attaquant', 'Buts', '1')]);
    render(<MatchPage />);
    expect(screen.queryByTestId('periode-joueurs-en-vue')).toBeNull();
  });

  it('R3 — match à venir sans joueurs en vue : pas de mention (le message d’état vide suffit)', () => {
    data = match('upcoming', []);
    render(<MatchPage />);
    expect(screen.queryByTestId('periode-joueurs-en-vue')).toBeNull();
  });

  it('R2 — Statistiques comparées : le xG des barres a la virgule (1,03 et 0,50)', () => {
    data = match('finished', []);
    render(<MatchPage />);
    const bloc = screen.getByText('xG (buts attendus)').parentElement!.parentElement!;
    expect(bloc.textContent).toContain('1,03');
    expect(bloc.textContent).toContain('0,50');
    expect(bloc.textContent).not.toMatch(/\d\.\d/);
  });

  it('R4 — la carte des tirs est nommée « Carte des tirs » (rôle img), plus « Shot map »', () => {
    data = match('finished', []);
    render(<MatchPage />);
    expect(screen.getByRole('img', { name: 'Carte des tirs' })).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: 'Shot map' })).toBeNull();
  });
});
