import { describe, expect, it, vi } from 'vitest';
import { render as rtlRender, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement } from 'react';
import userEvent from '@testing-library/user-event';
import { StandingsTable } from './standings-table';
import { VENUE_LONG, VENUE_SHORT } from './next-opponent-cell';
import type { NextOpponents, SeasonStandings } from '@/types/api';
import donnees from '../../tests-navigateur/donnees/classement-prochain-L273.json';

// L273 — colonne « Prochain » : prochain adversaire en Ligue 1 de chaque club (football-data.org).
// Données : classement réel de la prod du 27-11-2026 et prochains adversaires de la J12 (calendrier réel).
const DONNEES = donnees as unknown as Record<string, { body: unknown }>;
const CLASSEMENT = DONNEES['/api/standings'].body as SeasonStandings;
const PROCHAINS = DONNEES['/api/next-opponents'].body as NextOpponents;

/** Rendu dans un QueryClient (l'écusson passe par `useWikiImage`, requête désactivée quand l'adresse est connue). */
function render(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrap = (el: ReactElement) => <QueryClientProvider client={client}>{el}</QueryClientProvider>;
  const r = rtlRender(wrap(ui));
  return { ...r, rerender: (el: ReactElement) => r.rerender(wrap(el)) };
}

vi.setSystemTime(new Date('2026-11-27T16:00:00Z'));

const rowOf = (club: string) => screen.getAllByRole('row').find((tr) => within(tr).queryByTitle(club, { exact: true }))!;
const cellOf = (club: string) => rowOf(club).querySelector('td:last-child') as HTMLElement;
const ok = (data: NextOpponents = PROCHAINS) => ({ data, isError: false });

describe('<StandingsTable /> — colonne « Prochain » (L273)', () => {
  it('trois lignes contre le calendrier réel de la J12 : Lyon reçoit Monaco, Monaco va à Lyon, Paris FC va à Brest', () => {
    render(<StandingsTable rows={CLASSEMENT.table} nextOpponents={ok()} />);
    const lyon = cellOf('Lyon');
    expect(within(lyon).getByRole('img', { name: 'Monaco' })).toBeInTheDocument();
    expect(lyon).toHaveTextContent(`${VENUE_SHORT.home}${VENUE_LONG.home}`);
    expect(within(cellOf('Monaco')).getByRole('img', { name: 'Lyon' })).toBeInTheDocument();
    expect(cellOf('Monaco')).toHaveTextContent(VENUE_SHORT.away);
    expect(within(cellOf('Paris FC')).getByRole('img', { name: 'Brest' })).toBeInTheDocument();
    expect(cellOf('Paris FC')).toHaveTextContent(VENUE_LONG.away);
  });

  it('l’écusson est nommé (texte alternatif) et l’infobulle redit adversaire, lieu, journée et heure de Paris', () => {
    render(<StandingsTable rows={CLASSEMENT.table} nextOpponents={ok()} />);
    const logo = within(cellOf('Lyon')).getByRole('img', { name: 'Monaco' });
    expect(logo).toHaveAttribute('alt', 'Monaco');
    expect(logo.getAttribute('src')).toContain('/Competitors/471');
    expect(logo.closest('[title]')).toHaveAttribute('title', 'Monaco, à domicile — J12, dimanche 29 novembre · 20h45');
  });

  it('le nom affiché est celui du classement (mêmes lettres que la ligne du club adverse)', () => {
    render(<StandingsTable rows={CLASSEMENT.table} nextOpponents={ok()} />);
    expect(within(cellOf('Auxerre')).getByRole('img', { name: 'Olympique de Marseille' })).toBeInTheDocument();
  });

  it('domicile / extérieur ne tient pas à la couleur : même classe de couleur pour les deux libellés', () => {
    render(<StandingsTable rows={CLASSEMENT.table} nextOpponents={ok()} />);
    const dom = within(cellOf('Lyon')).getByText(VENUE_SHORT.home).parentElement!;
    const ext = within(cellOf('Monaco')).getByText(VENUE_SHORT.away).parentElement!;
    expect(dom.className).toBe(ext.className);
  });

  it('la légende reprend les libellés des cases, la journée qui vient et la mention football-data', () => {
    render(<StandingsTable rows={CLASSEMENT.table} nextOpponents={ok()} />);
    const legende = screen.getByTestId('legende-prochain');
    expect(legende).toHaveTextContent(`${VENUE_SHORT.home} ${VENUE_LONG.home}`);
    expect(legende).toHaveTextContent(`${VENUE_SHORT.away} ${VENUE_LONG.away}`);
    expect(legende).toHaveTextContent('Prochaine journée : J12, premier match vendredi 27 novembre · 20h45.');
    expect(within(legende).getByTestId('attribution-football-data')).toBeInTheDocument();
  });

  it('la légende nomme la colonne comme son en-tête, à chaque largeur (« Adv. » au téléphone, « Prochain » au-delà)', () => {
    render(<StandingsTable rows={CLASSEMENT.table} nextOpponents={ok()} vueTelephone="prochain" />);
    const entete = screen.getAllByRole('columnheader').find((h) => h.textContent?.includes('Prochain adversaire'))!;
    const libelles = (el: HTMLElement) =>
      [...el.querySelectorAll('span.md\\:hidden, span.hidden.md\\:inline')].map((e) => `${e.className.includes('md:hidden') ? 'tel' : 'bureau'}=${e.textContent}`);
    const legende = screen.getByTestId('legende-prochain');
    expect(libelles(legende).slice(0, 2)).toEqual(libelles(entete));
    expect(libelles(entete)).toEqual(['tel=Adv.', 'bureau=Prochain']);
  });

  it('trêve : premier match à plus de 10 jours → « Trêve : reprise … »', () => {
    const treve = { ...PROCHAINS, next: PROCHAINS.next.map((n) => ({ ...n, utcDate: '2027-01-02T19:45:00Z', matchday: 17 })) };
    render(<StandingsTable rows={CLASSEMENT.table} nextOpponents={ok(treve)} />);
    expect(screen.getByTestId('legende-prochain')).toHaveTextContent('Trêve : reprise J17, premier match samedi 2 janvier · 20h45.');
  });

  it('fin de saison : cases « — » expliquées, légende « Saison terminée »', () => {
    render(<StandingsTable rows={CLASSEMENT.table} nextOpponents={ok({ ...PROCHAINS, seasonOver: true, next: [] })} />);
    const vide = within(cellOf('Lyon')).getByTestId('prochain-vide');
    expect(vide).toHaveAttribute('data-raison', 'season-over');
    expect(vide).toHaveTextContent('Saison terminée');
    expect(screen.getByTestId('legende-prochain')).toHaveTextContent('Saison terminée : plus aucun match de Ligue 1 programmé.');
  });

  it('club sans match programmé (reporté) et club non relié : chacun sa raison, jamais une case muette', () => {
    const data = {
      ...PROCHAINS,
      linkedTeamIds: PROCHAINS.linkedTeamIds.filter((id) => id !== 485),
      next: PROCHAINS.next.filter((n) => n.teamId !== 534),
    };
    render(<StandingsTable rows={CLASSEMENT.table} nextOpponents={ok(data)} />);
    expect(within(cellOf('Brest')).getByTestId('prochain-vide')).toHaveAttribute('data-raison', 'none');
    expect(within(cellOf('Le Havre')).getByTestId('prochain-vide')).toHaveAttribute('data-raison', 'unlinked');
  });

  it('football-data en échec : cases « indisponible » et message d’état, sans mention de source', () => {
    render(<StandingsTable rows={CLASSEMENT.table} nextOpponents={{ data: undefined, isError: true }} />);
    expect(within(cellOf('Lyon')).getByTestId('prochain-vide')).toHaveAttribute('data-raison', 'unavailable');
    expect(screen.getByRole('status')).toHaveTextContent('football-data.org n’a pas répondu');
    expect(screen.queryByTestId('attribution-football-data')).toBeNull();
  });

  it('copie de football-data de plus d’une heure : sa date est dite', () => {
    render(<StandingsTable rows={CLASSEMENT.table} nextOpponents={ok({ ...PROCHAINS, updatedAt: '2026-11-27T10:05:00Z' })} />);
    expect(screen.getByTestId('legende-prochain')).toHaveTextContent('Prochains adversaires (relevé du 27 nov. à 11:05)');
  });

  it('téléphone : vue « Bilan » → G, N, P affichés et « Prochain » masqué sous 768 px ; vue « Prochain » → l’inverse', () => {
    const { rerender } = render(<StandingsTable rows={CLASSEMENT.table} nextOpponents={ok()} vueTelephone="bilan" />);
    const th = (label: string) =>
      screen.getAllByRole('columnheader').find((h) => (label === 'Prochain' ? h.textContent?.includes('Prochain adversaire') : h.textContent === label))!;
    expect(th('G')).not.toHaveClass('hidden');
    expect(th('Prochain')).toHaveClass('hidden', 'md:table-cell');
    rerender(<StandingsTable rows={CLASSEMENT.table} nextOpponents={ok()} vueTelephone="prochain" />);
    for (const l of ['G', 'N', 'P']) expect(th(l)).toHaveClass('hidden', 'md:table-cell');
    expect(th('Prochain')).not.toHaveClass('hidden');
    expect(th('Prochain')).toHaveAccessibleName('Prochain adversaire en Ligue 1');
  });
});

describe('StandingsPage — choix des colonnes au téléphone (L273)', () => {
  it('deux boutons à bascule, « Bilan » choisi d’abord ; « Prochain » bascule la vue', async () => {
    vi.resetModules();
    vi.doMock('@/hooks/use-standings', () => ({
      useStandings: () => ({ data: CLASSEMENT, isLoading: false, isError: false, isFetching: false, refetch: vi.fn() }),
    }));
    vi.doMock('@/hooks/use-next-opponents', () => ({ useNextOpponents: () => ({ data: PROCHAINS, isError: false }) }));
    vi.doMock('@/components/knowledge-header', () => ({ KnowledgeHeader: () => null }));
    vi.doMock('@/components/position-tracker', () => ({ PositionTracker: () => null }));
    const { StandingsPage } = await import('@/routes/standings');
    render(<StandingsPage />);
    const groupe = screen.getByRole('group', { name: 'Colonnes du tableau' });
    const bilan = within(groupe).getByRole('button', { name: 'Bilan' });
    const prochain = within(groupe).getByRole('button', { name: 'Prochain' });
    expect(bilan).toHaveAttribute('aria-pressed', 'true');
    expect(prochain).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(prochain);
    expect(prochain).toHaveAttribute('aria-pressed', 'true');
    const th = screen.getAllByRole('columnheader').find((h) => h.textContent?.includes('Prochain adversaire'))!;
    expect(th).not.toHaveClass('hidden');
  });
});
