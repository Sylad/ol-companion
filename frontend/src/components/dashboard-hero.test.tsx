import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Fixture } from '@/types/api';
import { DashboardHero } from './dashboard-hero';

// L39 — le « prochain rendez-vous » du tableau de bord lit /api/fixtures
// (football-data). Quand l'heure n'est pas fixée, la date y est à minuit UTC :
// lue à Paris, elle donnait « 01h00 ». Mesuré en prod le 03-10 sur J13 et J15.

const okJson = (body: unknown) => ({ ok: true, status: 200, json: async () => body });

function match(partial: Partial<Fixture> & { id: number; date: string }): Fixture {
  return {
    homeTeam: 'Olympique Lyonnais',
    homeTeamId: 523,
    awayTeam: 'OGC Nice',
    awayTeamId: 522,
    homeScore: null,
    awayScore: null,
    competition: 'Ligue 1',
    status: 'TIMED',
    matchday: 7,
    timeConfirmed: true,
    ...partial,
  };
}

const RENNES_PLAYED = match({
  id: 559683,
  date: '2026-09-19T18:45:00Z',
  awayTeam: 'Stade Rennais FC 1901',
  awayTeamId: 529,
  homeScore: 4,
  awayScore: 0,
  status: 'FINISHED',
  matchday: 5,
});
const LENS_TIMED = match({
  id: 559669,
  date: '2026-10-09T18:45:00Z',
  homeTeam: 'Racing Club de Lens',
  homeTeamId: 546,
  awayTeam: 'Olympique Lyonnais',
  awayTeamId: 523,
  matchday: 6,
});
// Tel que football-data le sert : SCHEDULED, minuit UTC.
const TROYES_UNCONFIRMED = match({
  id: 559603,
  date: '2026-12-05T00:00:00Z',
  homeTeam: 'ES Troyes AC',
  homeTeamId: 531,
  awayTeam: 'Olympique Lyonnais',
  awayTeamId: 523,
  status: 'SCHEDULED',
  matchday: 13,
  timeConfirmed: false,
});
const MARSEILLE_TIMED = match({
  id: 559594,
  date: '2026-12-13T19:45:00Z',
  awayTeam: 'Olympique de Marseille',
  awayTeamId: 516,
  matchday: 14,
});

function serve(fixtures: Fixture[]) {
  return vi.fn((url: string) => {
    if (url === '/api/fixtures') return Promise.resolve(okJson(fixtures));
    if (url.startsWith('/api/wiki-image')) return Promise.resolve(okJson({ imageUrl: null }));
    return Promise.resolve({ ok: false, status: 404, json: async () => ({}) });
  });
}

function renderHero() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <DashboardHero />
    </QueryClientProvider>,
  );
}

describe('<DashboardHero /> — prochain rendez-vous (L39)', () => {
  const previousTz = process.env.TZ;
  beforeAll(() => {
    process.env.TZ = 'Europe/Paris';
  });
  afterAll(() => {
    process.env.TZ = previousTz;
  });
  beforeEach(() => {
    // Le 03-10-2026 : Lens est à 6 jours, Troyes à 2 mois.
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-10-03T12:00:00Z') });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('heure fixée : la date et l’heure locale du prochain match', async () => {
    vi.stubGlobal('fetch', serve([RENNES_PLAYED, LENS_TIMED, TROYES_UNCONFIRMED]));
    renderHero();

    expect(await screen.findByText('vendredi 9 octobre · 20h45')).toBeInTheDocument();
    expect(screen.getByText(/Ligue 1 · J6/)).toBeInTheDocument();
    expect(screen.getAllByText('Racing Club de Lens').length).toBeGreaterThan(0);
    expect(screen.queryByText(/horaire à confirmer/i)).not.toBeInTheDocument();
  });

  it('heure non fixée : « week-end du … · horaire à confirmer », jamais « 01h00 » ni un jour ferme', async () => {
    vi.stubGlobal('fetch', serve([RENNES_PLAYED, TROYES_UNCONFIRMED, MARSEILLE_TIMED]));
    const { container } = renderHero();

    expect(await screen.findByText('week-end du 5 décembre · horaire à confirmer')).toBeInTheDocument();
    expect(screen.getByText(/Ligue 1 · J13/)).toBeInTheDocument();
    expect(screen.getAllByText('ES Troyes AC').length).toBeGreaterThan(0);
    // Aucune heure dans toute la carte : ni minuit UTC lu à Paris, ni une autre.
    expect(container).not.toHaveTextContent('01h00');
    expect(container).not.toHaveTextContent(/\d{1,2}h\d{2}/);
    expect(container).not.toHaveTextContent(/\d{2}:\d{2}/);
    // Le jour est inconnu : pas de compte à rebours calculé sur la date de remplissage.
    expect(container).not.toHaveTextContent(/dans \d+ jours?/);
    expect(screen.getAllByText('À confirmer')).toHaveLength(2);
  });

  it('jour non fixé le jour même de la date de remplissage : ni « Jour de match » ni « Approche »', async () => {
    vi.setSystemTime(new Date('2026-12-05T10:00:00Z'));
    vi.stubGlobal('fetch', serve([TROYES_UNCONFIRMED]));
    renderHero();

    expect(await screen.findByText('Prochain rendez-vous')).toBeInTheDocument();
    expect(screen.queryByText('Jour de match')).not.toBeInTheDocument();
    expect(screen.queryByText(/Approche/)).not.toBeInTheDocument();
  });

  it('prend le match à venir le plus proche, pas le premier de la liste, et ignore les matchs joués', async () => {
    vi.stubGlobal('fetch', serve([MARSEILLE_TIMED, TROYES_UNCONFIRMED, RENNES_PLAYED]));
    renderHero();

    expect(await screen.findByText('week-end du 5 décembre · horaire à confirmer')).toBeInTheDocument();
    expect(screen.queryByText(/13 décembre/)).not.toBeInTheDocument();
  });

  it('champ absent (backend antérieur) : l’heure est rendue comme avant', async () => {
    const { timeConfirmed: _dropped, ...older } = LENS_TIMED;
    vi.stubGlobal('fetch', serve([older]));
    renderHero();

    expect(await screen.findByText('vendredi 9 octobre · 20h45')).toBeInTheDocument();
  });

  it('aucun match à venir : le dit, sans date ni heure', async () => {
    vi.stubGlobal('fetch', serve([RENNES_PLAYED]));
    renderHero();

    expect(await screen.findByText('Aucun match programmé.')).toBeInTheDocument();
  });

  // L52 — à 390 px, un nom d'adversaire long rognait la carte « Tableau de bord match » :
  // la cellule de la grille et la ligne « Adversaire » ne pouvaient pas rétrécir.
  it('nom d’adversaire long : la carte peut rétrécir et le nom passe à la ligne', async () => {
    const LONG = 'Association Sportive de Saint-Étienne Loire Métropole';
    vi.stubGlobal('fetch', serve([match({ id: 1, date: '2026-10-09T18:45:00Z', awayTeam: LONG, awayTeamId: 527 })]));
    renderHero();

    const nom = (await screen.findAllByText(LONG)).find((el) => el.className.includes('text-right'));
    expect(nom).toBeDefined();
    expect(nom).toHaveClass('min-w-0', 'break-words');
    const carte = nom!.closest('.backdrop-blur-md');
    expect(carte).toHaveClass('min-w-0');
    expect(carte!.parentElement).toHaveClass('grid-cols-1', 'min-w-0');
  });
});
