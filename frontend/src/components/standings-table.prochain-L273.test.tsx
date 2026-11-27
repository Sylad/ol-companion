import { describe, expect, it, vi } from 'vitest';
import { render as rtlRender, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement } from 'react';
import userEvent from '@testing-library/user-event';
import { StandingsTable } from './standings-table';
import { LIVE_SHORT, VENUE_LONG, VENUE_SHORT, nomCourt } from './next-opponent-cell';
import type { SeasonStandings } from '@/types/api';
import type { NextOpponents } from '@/types/next-opponents';
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

  it('l’écusson est nommé (texte alternatif) et la case, un bouton, est décrite par adversaire, lieu, journée et heure de Paris', () => {
    render(<StandingsTable rows={CLASSEMENT.table} nextOpponents={ok()} />);
    const logo = within(cellOf('Lyon')).getByRole('img', { name: 'Monaco' });
    expect(logo).toHaveAttribute('alt', 'Monaco');
    expect(logo.getAttribute('src')).toContain('/Competitors/471');
    const bouton = within(cellOf('Lyon')).getByRole('button', { name: 'Monaco à domicile' });
    expect(bouton).toHaveAccessibleDescription('Monaco, à domicile — J12, dimanche 29 novembre · 20h45');
    expect(bouton).not.toHaveAttribute('title');
  });

  it('revue UX M1 : la bulle s’ouvre au toucher (clic) et au focus clavier, Échap la ferme et le focus reste', async () => {
    const user = userEvent.setup();
    render(<StandingsTable rows={CLASSEMENT.table} nextOpponents={ok()} />);
    const bouton = within(cellOf('Lyon')).getByRole('button', { name: 'Monaco à domicile' });
    const bulle = within(cellOf('Lyon')).getByTestId('prochain-bulle');
    expect(bulle).not.toBeVisible();
    await user.click(bouton);
    expect(bulle).toBeVisible();
    expect(bulle).toHaveTextContent('Monaco, à domicile — J12, dimanche 29 novembre · 20h45');
    // Contre-revue UX (m2) : une infobulle ne se « déplie » pas ; le bouton est décrit, sans aria-expanded.
    expect(bouton).not.toHaveAttribute('aria-expanded');
    await user.keyboard('{Escape}');
    expect(bulle).not.toBeVisible();
    expect(bouton).toHaveFocus();
    // Le focus qui part (toucher ailleurs, Tab) ferme ; la case suivante ouvre la sienne : une seule bulle à la fois.
    await user.click(bouton);
    await user.tab();
    expect(bulle).not.toBeVisible();
    expect(screen.getAllByTestId('prochain-bulle').filter((b) => !b.hidden)).toHaveLength(1);
  });

  it('contre-revue UX (M1, WCAG 1.4.13) : ouverte au survol, sans focus sur le bouton, Échap la ferme', async () => {
    const user = userEvent.setup();
    render(<StandingsTable rows={CLASSEMENT.table} nextOpponents={ok()} />);
    const bouton = within(cellOf('Lyon')).getByRole('button', { name: 'Monaco à domicile' });
    const bulle = within(cellOf('Lyon')).getByTestId('prochain-bulle');
    await user.hover(bouton);
    expect(bulle).toBeVisible();
    expect(bouton).not.toHaveFocus();
    await user.keyboard('{Escape}');
    expect(bulle).not.toBeVisible();
    // La bulle fermée, l'écouteur du document est retiré : Échap ne rouvre ni ne casse rien.
    await user.keyboard('{Escape}');
    expect(bulle).not.toBeVisible();
    await user.unhover(bouton);
    await user.hover(bouton);
    expect(bulle).toBeVisible();
  });

  it('revue UX M1 : nom de l’adversaire écrit à côté de l’écusson dès 1024 px (masqué au-dessous)', () => {
    render(<StandingsTable rows={CLASSEMENT.table} nextOpponents={ok()} />);
    const nom = within(cellOf('Auxerre')).getByTestId('prochain-nom');
    expect(nom).toHaveTextContent(/^Marseille$/);
    // Nom entier : texte alternatif de l'écusson et bulle (pas de title : les tests repèrent les lignes par le title du club).
    expect(within(cellOf('Auxerre')).getByRole('img', { name: 'Olympique de Marseille' })).toBeInTheDocument();
    expect(within(cellOf('Lyon')).getByTestId('prochain-nom')).toHaveTextContent(/^Monaco$/);
    expect(nomCourt('OGC Nice')).toBe('Nice');
    expect(nomCourt('Le Havre')).toBe('Le Havre');
    expect(nomCourt('PSG')).toBe('PSG');
    expect(nom).toHaveClass('hidden', 'lg:inline');
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

});

describe('<StandingsTable /> — légende de la colonne « Prochain » (L273)', () => {
  it('la légende reprend les libellés des cases, la journée qui vient et la mention football-data', () => {
    render(<StandingsTable rows={CLASSEMENT.table} nextOpponents={ok()} />);
    const legende = screen.getByTestId('legende-prochain');
    expect(legende).toHaveTextContent(`${VENUE_SHORT.home} ${VENUE_LONG.home}`);
    expect(legende).toHaveTextContent(`${VENUE_SHORT.away} ${VENUE_LONG.away}`);
    expect(legende).toHaveTextContent('Prochaine journée : J12, premier match vendredi 27 novembre · 20h45.');
    expect(within(legende).getByTestId('attribution-football-data')).toBeInTheDocument();
  });

  it('la légende nomme la colonne comme son en-tête, à chaque largeur (« Proch. » au téléphone, « Prochain » au-delà)', () => {
    render(<StandingsTable rows={CLASSEMENT.table} nextOpponents={ok()} vueTelephone="prochain" />);
    const entete = screen.getAllByRole('columnheader').find((h) => h.textContent?.includes('Prochain adversaire'))!;
    const libelles = (el: HTMLElement) =>
      [...el.querySelectorAll('span.md\\:hidden, span.hidden.md\\:inline')].map((e) => `${e.className.includes('md:hidden') ? 'tel' : 'bureau'}=${e.textContent}`);
    const legende = screen.getByTestId('legende-prochain');
    expect(libelles(legende).slice(0, 2)).toEqual(libelles(entete));
    expect(libelles(entete)).toEqual(['tel=Proch.', 'bureau=Prochain']);
  });

});

describe('<StandingsTable /> — cases vides et vue téléphone (L273)', () => {
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

  it('dernière journée jouée en direct : chaque case dit « Direct » (lieu et « match en cours » en texte), jamais « Saison terminée » ni « reporté »', () => {
    const direct = { ...PROCHAINS, next: PROCHAINS.next.map((n) => ({ ...n, live: true })) };
    render(<StandingsTable rows={CLASSEMENT.table} nextOpponents={ok(direct)} />);
    const lyon = cellOf('Lyon');
    expect(within(lyon).getByTestId('prochain-direct')).toHaveTextContent(`${LIVE_SHORT}${VENUE_LONG.home}, match en cours`);
    expect(within(lyon).getByRole('button')).toHaveAccessibleDescription('Monaco, à domicile — J12, match en cours');
    expect(screen.queryAllByTestId('prochain-vide')).toHaveLength(0);
    const legende = screen.getByTestId('legende-prochain');
    expect(legende).toHaveTextContent(`${LIVE_SHORT} match en cours`);
    expect(legende).toHaveTextContent('Journée en cours : J12.');
    expect(legende).not.toHaveTextContent('Saison terminée');
    expect(legende).not.toHaveTextContent('Prochaine journée');
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
    expect(screen.getByTestId('prochain-indisponible')).toHaveTextContent('football-data.org n’a pas répondu');
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

  async function page(prochains: { data?: NextOpponents; isError: boolean }) {
    vi.resetModules();
    vi.doMock('@/hooks/use-standings', () => ({
      useStandings: () => ({ data: CLASSEMENT, isLoading: false, isError: false, isFetching: false, refetch: vi.fn() }),
    }));
    vi.doMock('@/hooks/use-next-opponents', () => ({ useNextOpponents: () => prochains }));
    vi.doMock('@/components/knowledge-header', () => ({ KnowledgeHeader: () => null }));
    vi.doMock('@/components/position-tracker', () => ({ PositionTracker: () => null }));
    const { StandingsPage } = await import('@/routes/standings');
    render(<StandingsPage />);
  }

  it('revue UX m1 : le bouton pressé se lit par son fond (bleu OL vif), pas au gras seul ; contour de focus rouge de l’app', async () => {
    await page({ data: PROCHAINS, isError: false });
    const bilan = screen.getByRole('button', { name: 'Bilan' });
    const prochain = screen.getByRole('button', { name: 'Prochain' });
    expect(bilan).toHaveClass('bg-ol-blue-bright', 'focus-visible:outline-ol-red-bright');
    expect(prochain).not.toHaveClass('bg-ol-blue-bright');
    expect(prochain).toHaveClass('focus-visible:outline-ol-red-bright');
  });

  it('revue UX m3 : football-data en échec → message près de la bascule en vue « Prochain » (au-dessus du tableau dès 768 px)', async () => {
    await page({ data: undefined, isError: true });
    const haut = screen.getByTestId('prochain-indisponible-haut');
    expect(haut).toHaveAttribute('role', 'status');
    expect(haut).toHaveTextContent('Prochain adversaire indisponible (football-data.org n’a pas répondu).');
    expect(haut).toHaveClass('hidden', 'md:block');
    await userEvent.click(screen.getByRole('button', { name: 'Prochain' }));
    expect(haut).not.toHaveClass('hidden');
    // Avant le tableau dans le document : lu avant les tirets.
    expect(haut.compareDocumentPosition(screen.getByRole('table')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
