import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { LiveMatchStats } from '@/types/api';

// L172 — R3 de docs/specs/page-match-fm/fiche.yaml (amendée) : l’en-tête d’un match de l’OL à venir (hors Bleus) dit
// la date et l’heure, ou « Horaire à confirmer » quand la réponse stats porte timeConfirmed: false.

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

const aVenir = (timeConfirmed?: boolean, startTime = '2026-11-12T20:00:00Z'): LiveMatchStats => ({
  gameId: 4672325, matchupId: '523-1234-4672325', competitionId: 573, competitionName: 'Ligue Europa',
  status: 'upcoming', statusGroup: 1, statusText: 'Programmé', gameTime: 0, gameTimeDisplay: '',
  startTime, ...(timeConfirmed === undefined ? {} : { timeConfirmed }),
  home: { id: 465, name: 'Lyon', symbolicName: 'LYO', imageVersion: 1, score: null },
  away: { id: 1234, name: 'Lillestrom', symbolicName: 'LIL', imageVersion: 1, score: null },
  teamStats: { home: {}, away: {} }, events: [], topPerformers: [], shots: [], updatedAt: '2026-10-17T12:00:00Z',
} as unknown as LiveMatchStats);

beforeEach(() => {
  process.env.TZ = 'Europe/Paris';
});

describe('R3 — match de l’OL à venir : date et heure ou « Horaire à confirmer » (L172)', () => {
  it('R3 — timeConfirmed faux un jeudi : « Date et horaire à confirmer » (jour non ferme, L47), jamais la date ni l’heure de remplissage', async () => {
    data = aVenir(false);
    render(<MatchPage />);
    const date = await screen.findByTestId('coup-envoi');
    expect(date.textContent).toBe('Date et horaire à confirmer');
    expect(date.textContent).not.toMatch(/\d{2}h\d{2}|12\/11/);
  });

  it('R3 — timeConfirmed faux un dimanche : « Week-end du 10/10 · Horaire à confirmer » (L47), jamais « Dim. 11/10 »', async () => {
    data = aVenir(false, '2026-10-11T15:00:00Z');
    render(<MatchPage />);
    const date = await screen.findByTestId('coup-envoi');
    expect(date.textContent).toBe('Week-end du 10/10 · Horaire à confirmer');
    expect(date.textContent).not.toContain('Dim.');
  });

  it('R3 — timeConfirmed vrai : l’heure est affichée (« Jeu. 12/11 · 21h00 »)', async () => {
    data = aVenir(true);
    render(<MatchPage />);
    expect((await screen.findByTestId('coup-envoi')).textContent).toBe('Jeu. 12/11 · 21h00');
  });

  it('R3 — champ absent (backend antérieur) : l’heure est affichée', async () => {
    data = aVenir();
    render(<MatchPage />);
    expect((await screen.findByTestId('coup-envoi')).textContent).toBe('Jeu. 12/11 · 21h00');
  });

  it('R3 — la ligne d’en-tête passe à la ligne (flex-wrap) : sous 390 px le texte du coup d’envoi ne rogne pas l’horloge « À VENIR »', async () => {
    data = aVenir(false);
    render(<MatchPage />);
    const ligne = (await screen.findByTestId('coup-envoi')).closest('header') as HTMLElement;
    expect(ligne.className).toContain('flex-wrap');
    expect(ligne.className).toContain('gap-x-3');
  });

  it('R3 — sous 390 px le libellé long du coup d’envoi peut passer à la ligne (« Week-end du 05/12 · Horaire à confirmer » débordait l’en-tête à 320 px)', async () => {
    data = aVenir(false, '2026-12-05T15:00:00Z');
    render(<MatchPage />);
    const libelle = await screen.findByTestId('coup-envoi');
    expect(libelle.className).toContain('min-[390px]:whitespace-nowrap');
    expect(libelle.className).not.toMatch(/(^|\s)whitespace-nowrap/);
  });

  it('R3 — l’horloge « À VENIR » reste sur une seule ligne et ne rétrécit pas, même avec le libellé long (Troyes – Lyon, Horaire à confirmer)', async () => {
    data = aVenir(false, '2026-12-05T15:00:00Z');
    render(<MatchPage />);
    const horloge = (await screen.findByTestId('coup-envoi')).nextElementSibling as HTMLElement;
    expect(horloge.textContent).toBe('À VENIR');
    expect(horloge.className).toContain('whitespace-nowrap');
    expect(horloge.className).toContain('shrink-0');
  });
});
