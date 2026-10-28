import { useId, useMemo } from 'react';
import { competitionLabel } from '@/lib/competitions';
import { hasJersey } from '@/lib/jersey';
import { positionGroup, positionShortFr } from '@/lib/position-fr';
import { Loader2, LayoutGrid, Users, BarChart3, ArrowUpDown } from 'lucide-react';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import type { Onglet, PlayersSearch, Tri } from '@/lib/players-search';
import { useLineup } from '@/hooks/use-lineup';
import { useSeasonStats } from '@/hooks/use-player-stats';
import { useSquad } from '@/hooks/use-squad';
import { KnowledgeHeader } from '@/components/knowledge-header';
import { FormationField } from '@/components/formation-field';
import { PlayerCard } from '@/components/player-card';
import { TeamLogo } from '@/components/team-logo';
import { noteFr } from '@/lib/note-fr';
import { cn } from '@/lib/utils';
import type { LineupPlayer, PlayerSeasonStats, SquadPlayer } from '@/types/api';

const WEEKDAY = ['Dim.', 'Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.'];

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${WEEKDAY[d.getDay()]} ${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
}

export function PlayersPage() {
  const lineup = useLineup();
  const { data } = lineup;
  // L7 : onglet et tri sont dans l'URL ; replace pour que le retour du navigateur quitte la page, pas l'onglet précédent.
  const search = useSearch({ from: '/players' });
  const navigate = useNavigate();
  const tab: Onglet = search.onglet ?? 'composition';
  const tri: Tri = search.tri ?? 'bp';
  const go = (next: PlayersSearch) =>
    void navigate({
      to: '/players',
      search: { onglet: next.onglet === 'composition' ? undefined : next.onglet, tri: next.tri === 'bp' ? undefined : next.tri },
      replace: true,
    });
  const setTab = (onglet: Onglet) => go({ onglet, tri: search.tri });
  const baseId = useId();
  const tabId = (t: string) => `${baseId}-onglet-${t}`;
  const panelId = `${baseId}-panneau`;

  // L7 : la carte et ses onglets ne dépendent pas de /api/lineup ; seuls les panneaux Composition et Effectif en dépendent.
  const lineupEtat = data ? null : (
    <LineupEtat isLoading={lineup.isLoading} isError={lineup.isError} onRetry={() => void lineup.refetch()} />
  );

  return (
    <div className="space-y-8">
      <KnowledgeHeader />
      <h1 className="font-display text-2xl font-bold text-fg-bright leading-none">Joueurs</h1>

      <section className="rounded-md bg-surface border border-border overflow-hidden">
        <header className="px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border">
          {data ? (
            <div>
              <div className="eyebrow mb-1">Dernier match</div>
              <div className="flex items-center gap-3">
                <h2 className="font-display text-xl font-bold text-fg-bright leading-none">
                  {data.isHome ? 'OL' : data.opponent}{' '}
                  <span className="num text-fg-muted text-base">
                    {data.homeScore}
                  </span>
                  <span className="text-fg-dim mx-2">·</span>
                  <span className="num text-fg-muted text-base">{data.awayScore}</span>{' '}
                  {data.isHome ? data.opponent : 'OL'}
                </h2>
                {!data.isHome && (
                  <TeamLogo teamId={data.opponentId} name={data.opponent} size={20} />
                )}
              </div>
              <p className="text-xs text-fg-dim mt-1.5">
                {competitionLabel(data.competitionId, data.competition)}
                {data.matchday ? ` · J${data.matchday}` : ''} · {formatDate(data.date)} · Composition{' '}
                <span className="text-ol-red-bright font-semibold">{data.formation}</span>
              </p>
            </div>
          ) : (
            <div>
              <div className="eyebrow mb-1">Saison en cours</div>
              <h2 className="font-display text-xl font-bold text-fg-bright leading-none">Olympique Lyonnais</h2>
            </div>
          )}
          <div role="tablist" aria-label="Effectif" className="flex items-center gap-1 rounded-full border border-border p-1">
            <TabButton id={tabId('composition')} panelId={panelId} active={tab === 'composition'} onClick={() => setTab('composition')} icon={LayoutGrid}>
              Composition
            </TabButton>
            <TabButton id={tabId('effectif')} panelId={panelId} active={tab === 'effectif'} onClick={() => setTab('effectif')} icon={Users}>
              Effectif
            </TabButton>
            <TabButton id={tabId('stats')} panelId={panelId} active={tab === 'stats'} onClick={() => setTab('stats')} icon={BarChart3}>
              Stats saison
            </TabButton>
          </div>
        </header>

        <div className="p-5" role="tabpanel" id={panelId} aria-labelledby={tabId(tab)}>
          {tab === 'composition' && (
            data ? (
              <div className="grid lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-5">
                <div className="max-w-[560px] mx-auto w-full">
                  <FormationField starters={data.starters} formation={data.formation} retour={{ onglet: search.onglet, tri: search.tri }} />
                </div>
                <BenchSection players={data.bench} retour={{ onglet: search.onglet, tri: search.tri }} />
              </div>
            ) : lineupEtat
          )}

          {tab === 'effectif' && <EffectifTab retour={{ onglet: search.onglet, tri: search.tri }} feuille={data ? [...data.starters, ...data.bench] : []} />}

          {tab === 'stats' && <SeasonStatsTab tri={tri} onTri={(t) => go({ onglet: search.onglet, tri: t })} retour={{ onglet: search.onglet, tri: search.tri }} />}
        </div>
      </section>
    </div>
  );
}

interface EtatProps {
  onRetry: () => void;
}

function EtatPanneau({ onRetry, children }: EtatProps & { children: React.ReactNode }) {
  return (
    <div role="status" className="py-10 text-center space-y-3">
      <p className="text-fg-muted">{children}</p>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center rounded-full border border-border-strong px-4 py-1.5 text-xs font-semibold text-fg-bright hover:bg-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[hsl(var(--ol-red-bright))]"
      >
        Réessayer
      </button>
    </div>
  );
}

function LineupEtat({ isLoading, isError, onRetry }: EtatProps & { isLoading: boolean; isError: boolean }) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10 text-fg-dim">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        <span>Chargement de l'effectif…</span>
      </div>
    );
  }
  if (isError) {
    return (
      <EtatPanneau onRetry={onRetry}>
        <span className="text-loss-fg">La composition du dernier match n’a pas pu être chargée.</span>{' '}
        Vérifiez votre connexion puis réessayez ; les stats de la saison restent consultables.
      </EtatPanneau>
    );
  }
  return (
    <EtatPanneau onRetry={onRetry}>
      Aucune composition de match récente n’est disponible pour le moment. Réessayez plus tard ;
      les stats de la saison restent consultables.
    </EtatPanneau>
  );
}

// L214 : l'effectif est celui de /api/players/squad (tout joueur sous contrat, minutes ou non) ; les stats de saison n'y
// ajoutent que la note moyenne. Squad indisponible (L178) : repli sur les joueurs de la saison complétés des convoqués de
// la dernière feuille de match, sans note moyenne pour un convoqué (la note de la feuille est celle d'un match).
function enCarte(p: PlayerSeasonStats): LineupPlayer {
  return {
    id: p.athleteId, athleteId: p.athleteId, name: p.name, shortName: p.shortName, jerseyNumber: p.jerseyNumber,
    position: p.position, positionShort: p.positionShort, imageVersion: p.imageVersion ?? undefined, yardLine: 0, yardSide: 0,
    ranking: p.averageRating, isStarting: true,
  };
}

// Un joueur de l'effectif sans minute n'a pas de note, et le squad ne donne pas de version d'image : sa photo vient de la
// feuille du dernier match s'il y figure (L215), sinon initiales. Poste GB / DEF / MIL / ATT.
function enCarteEffectif(p: SquadPlayer, saison: PlayerSeasonStats | undefined, convoque: LineupPlayer | undefined): LineupPlayer {
  if (saison) return enCarte(saison);
  return {
    id: p.athleteId, athleteId: p.athleteId, name: p.name, shortName: p.name, jerseyNumber: p.jerseyNumber,
    position: p.position, positionShort: positionGroup(p.position), imageVersion: convoque?.imageVersion, yardLine: 0, yardSide: 0, ranking: null, isStarting: true,
  };
}

// Un convoqué de la feuille n'est ni « banc » ni « titulaire » dans un effectif de saison : pas de badge « Banc »,
// poste ramené à GB / DEF / MIL / ATT comme les cartes issues des stats, pas de note (celle d'un match n'est pas une moyenne).
function enCarteFeuille(p: LineupPlayer): LineupPlayer {
  return { ...p, ranking: null, isStarting: true, positionShort: positionGroup(p.position, p.positionShort) };
}

const parNumero = (a: LineupPlayer, b: LineupPlayer) =>
  (hasJersey(a.jerseyNumber) ? a.jerseyNumber : Infinity) - (hasJersey(b.jerseyNumber) ? b.jerseyNumber : Infinity) || a.name.localeCompare(b.name, 'fr');

function EffectifTab({ retour, feuille }: { retour: PlayersSearch; feuille: LineupPlayer[] }) {
  const { data, isLoading, isError, refetch } = useSeasonStats();
  const squad = useSquad();
  const effectif = squad.data?.length ? squad.data : null;
  const joueurs = useMemo(() => {
    if (effectif) {
      const saison = new Map((data ?? []).map((p) => [p.athleteId, p]));
      const convoques = new Map(feuille.map((p) => [p.athleteId, p]));
      return effectif.map((p) => enCarteEffectif(p, saison.get(p.athleteId), convoques.get(p.athleteId))).sort(parNumero);
    }
    const saison = new Set((data ?? []).map((p) => p.athleteId));
    return [...(data ?? []).map(enCarte), ...feuille.filter((p) => !saison.has(p.athleteId)).map(enCarteFeuille)].sort(parNumero);
  }, [effectif, data, feuille]);
  if (squad.isLoading) {
    return (
      <div className="flex items-center justify-center py-10 text-fg-dim">
        <Loader2 className="h-4 w-4 animate-spin mr-2" /> Chargement de l’effectif…
      </div>
    );
  }
  const etat = statsEtat({ data, isLoading, isError, onRetry: () => void refetch(), vide: 'Aucun joueur n’a encore joué cette saison : l’effectif apparaît après le premier match terminé. Réessayez plus tard.', effectif: !!effectif });
  if (etat) return etat;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
      {joueurs.map((p) => (
        <Link
          key={p.athleteId}
          to="/player/$athleteId"
          params={{ athleteId: String(p.athleteId) }}
          search={retour}
          className="block focus:outline-none focus:ring-2 focus:ring-ol-red/50 rounded-md"
        >
          <PlayerCard player={p} rankingLabel="Note moyenne" />
        </Link>
      ))}
    </div>
  );
}

/** Chargement, erreur et vide des stats de saison, communs à l'Effectif et à Stats saison ; null quand il y a des joueurs (ou, `effectif` servi, des stats vides). */
function statsEtat({ data, isLoading, isError, onRetry, vide, effectif = false }: { data: PlayerSeasonStats[] | undefined; isLoading: boolean; isError: boolean; onRetry: () => void; vide: string; effectif?: boolean }) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10 text-fg-dim">
        <Loader2 className="h-4 w-4 animate-spin mr-2" /> Chargement des stats…
      </div>
    );
  }
  if (isError) {
    return (
      <EtatPanneau onRetry={onRetry}>
        <span className="text-loss-fg">Les stats de la saison n’ont pas pu être chargées.</span>{' '}
        Vérifiez votre connexion puis réessayez.
      </EtatPanneau>
    );
  }
  // Un effectif servi se suffit : des stats vides n'ôtent que les notes (chargement et erreur, eux, restent dits).
  if (!effectif && (!data || data.length === 0)) return <EtatPanneau onRetry={onRetry}>{vide}</EtatPanneau>;
  return null;
}

type SortKey = 'goalContributions' | 'goals' | 'assists' | 'minutesPlayed' | 'matchesPlayed' | 'shots' | 'averageRating';

const TRI_TO_KEY: Record<Tri, SortKey> = {
  bp: 'goalContributions',
  buts: 'goals',
  passes: 'assists',
  minutes: 'minutesPlayed',
  matchs: 'matchesPlayed',
  tirs: 'shots',
  note: 'averageRating',
};

interface SortHeaderProps {
  label: React.ReactNode;
  sortKey: Tri;
  current: Tri;
  onSort: (k: Tri) => void;
}

// L177 : sous 640 px une seule colonne de valeur reste affichée, celle du tri ; au-delà tout le tableau.
const colonne = (key: Tri, current: Tri) => (key === current ? '' : 'hidden sm:table-cell');

function SortHeader({ label, sortKey, current, onSort }: SortHeaderProps) {
  const active = current === sortKey;
  return (
    <th
      className={cn('px-2 py-2 font-semibold text-right', colonne(sortKey, current))}
      aria-sort={active ? 'descending' : undefined}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn(
          'inline-flex items-center gap-1 transition-colors',
          active ? 'text-ol-red-bright' : 'text-fg-dim hover:text-fg',
        )}
      >
        {label}
        <ArrowUpDown className={cn('h-3 w-3', active ? 'opacity-100' : 'opacity-40')} />
      </button>
    </th>
  );
}

function SeasonStatsTab({ tri, onTri, retour }: { tri: Tri; onTri: (t: Tri) => void; retour: PlayersSearch }) {
  const { data, isLoading, isError, refetch } = useSeasonStats();
  const sortKey = TRI_TO_KEY[tri];

  const sorted = useMemo(() => {
    if (!data) return [];
    return [...data].sort((a, b) => {
      const av = ((a[sortKey] as number | null) ?? -1) as number;
      const bv = ((b[sortKey] as number | null) ?? -1) as number;
      if (bv !== av) return bv - av;
      return a.name.localeCompare(b.name, 'fr');
    });
  }, [data, sortKey]);

  const etat = statsEtat({
    data, isLoading, isError, onRetry: () => void refetch(),
    vide: 'Aucune statistique de la saison n’est disponible pour le moment : elles apparaissent après le premier match terminé. Réessayez plus tard.',
  });
  if (etat) return etat;

  return (
    <>
    <TriPuces tri={tri} onTri={onTri} />
    <div className="overflow-x-auto -mx-5">
      <table className="w-full text-sm sm:min-w-[640px]">
        <thead>
          <tr className="text-fg-dim text-[11px] uppercase tracking-wider font-semibold border-b border-border">
            <th className="text-left px-4 py-2 font-semibold sticky left-0 bg-surface sm:static sm:bg-transparent">Joueur</th>
            <SortHeader label="Matchs" sortKey="matchs" current={tri} onSort={onTri} />
            <SortHeader label="Min" sortKey="minutes" current={tri} onSort={onTri} />
            <SortHeader label="Buts" sortKey="buts" current={tri} onSort={onTri} />
            <SortHeader label="Passes D." sortKey="passes" current={tri} onSort={onTri} />
            <SortHeader label={<abbr title="Buts + passes décisives" className="no-underline">B+P</abbr>} sortKey="bp" current={tri} onSort={onTri} />
            <SortHeader label="Tirs" sortKey="tirs" current={tri} onSort={onTri} />
            <SortHeader label="Note" sortKey="note" current={tri} onSort={onTri} />
          </tr>
        </thead>
        <tbody>
          {sorted.map((p) => (
            <PlayerStatsRow key={p.athleteId} player={p} retour={retour} tri={tri} />
          ))}
        </tbody>
      </table>
    </div>
    <p data-testid="legende-stats" className="pt-3 text-xs text-fg-muted">
      Matchs : joués (entre parenthèses, titularisations) · Tirs : tirs (entre parenthèses, tirs cadrés) · B+P : buts + passes décisives.
    </p>
    </>
  );
}

// Libellés courts des puces de tri (mobile) ; l'ordre est celui de la maquette de la revue UX L7.
const PUCES: { tri: Tri; label: string }[] = [
  { tri: 'bp', label: 'B+P' },
  { tri: 'buts', label: 'Buts' },
  { tri: 'passes', label: 'PD' },
  { tri: 'minutes', label: 'Min' },
  { tri: 'matchs', label: 'Matchs' },
  { tri: 'tirs', label: 'Tirs' },
  { tri: 'note', label: 'Note' },
];

function TriPuces({ tri, onTri }: { tri: Tri; onTri: (t: Tri) => void }) {
  return (
    <div role="group" aria-label="Trier par" className="sm:hidden flex flex-wrap gap-2 pb-4">
      {PUCES.map((p) => (
        <button
          key={p.tri}
          type="button"
          aria-pressed={tri === p.tri}
          onClick={() => onTri(p.tri)}
          className={cn(
            'min-h-11 min-w-11 px-4 rounded-full border text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-ol-red/50',
            tri === p.tri ? 'border-ol-red-bright text-ol-red-bright bg-surface-2' : 'border-border text-fg-muted',
          )}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

// Valeur secondaire, sous la principale, sur mobile seulement (le tableau complet montre déjà les autres colonnes).
function secondaire(p: PlayerSeasonStats, tri: Tri): string | null {
  switch (tri) {
    case 'bp': return `${p.goals} B · ${p.assists} PD`;
    case 'buts':
    case 'passes':
    case 'minutes':
    case 'note': return `${p.matchesPlayed} match${p.matchesPlayed > 1 ? 's' : ''}`;
    default: return null;
  }
}

function PlayerStatsRow({ player, retour, tri }: { player: PlayerSeasonStats; retour: PlayersSearch; tri: Tri }) {
  const sous = secondaire(player, tri);
  // La valeur secondaire n'existe que dans la cellule du tri, sous la principale, et seulement sous 640 px.
  const second = (key: Tri) =>
    key === tri && sous ? <span className="block sm:hidden whitespace-nowrap text-xs font-normal text-fg-dim">{sous}</span> : null;
  return (
    <tr className="border-b border-border/60 hover:bg-surface-2 transition-colors">
      <td className="px-4 py-2 sticky left-0 bg-surface sm:static sm:bg-transparent">
        <Link
          to="/player/$athleteId"
          params={{ athleteId: String(player.athleteId) }}
          search={retour}
          className="flex flex-wrap sm:flex-nowrap items-center gap-x-2 group"
        >
          <span className="text-[10px] font-mono text-fg-dim w-6 tabular-nums shrink-0">
            {hasJersey(player.jerseyNumber) ? `#${player.jerseyNumber}` : '—'}
          </span>
          <span className="font-semibold text-fg group-hover:text-ol-red-bright transition-colors">
            {player.name}
          </span>
          <span className="basis-full pl-8 sm:basis-auto sm:pl-0 text-[10px] uppercase tracking-wider text-fg-dim">
            {positionShortFr(player.positionShort)}
          </span>
        </Link>
      </td>
      <td className={cn('px-2 py-2 text-right tabular-nums text-fg', colonne('matchs', tri))}>
        {player.matchesPlayed}
        {player.matchesStarted > 0 && (
          <span className="text-fg-dim text-xs"> ({player.matchesStarted})</span>
        )}
        {second('matchs')}
      </td>
      <td className={cn('px-2 py-2 text-right tabular-nums text-fg-muted', colonne('minutes', tri))}>
        {player.minutesPlayed}
        {second('minutes')}
      </td>
      <td className={cn(
        'px-2 py-2 text-right tabular-nums',
        player.goals > 0 ? 'text-ol-red-bright font-bold' : 'text-fg-dim',
        colonne('buts', tri),
      )}>
        {player.goals}
        {second('buts')}
      </td>
      <td className={cn(
        'px-2 py-2 text-right tabular-nums',
        player.assists > 0 ? 'text-ol-red-bright font-bold' : 'text-fg-dim',
        colonne('passes', tri),
      )}>
        {player.assists}
        {second('passes')}
      </td>
      <td className={cn(
        'px-2 py-2 text-right tabular-nums font-bold',
        player.goalContributions > 0 ? 'text-fg-bright' : 'text-fg-dim',
        colonne('bp', tri),
      )}>
        {player.goalContributions}
        {second('bp')}
      </td>
      <td className={cn('px-2 py-2 text-right tabular-nums text-fg-muted', colonne('tirs', tri))}>
        {player.shots}{player.shotsOnTarget > 0 ? ` (${player.shotsOnTarget})` : ''}
      </td>
      <td className={cn(
        'px-2 py-2 text-right tabular-nums',
        player.averageRating !== null ? 'text-fg' : 'text-fg-dim',
        colonne('note', tri),
      )}>
        {player.averageRating !== null ? noteFr(player.averageRating) : '—'}
        {second('note')}
      </td>
    </tr>
  );
}

interface TabButtonProps {
  id: string;
  panelId: string;
  active: boolean;
  onClick: () => void;
  icon: typeof LayoutGrid;
  children: React.ReactNode;
}

function TabButton({ id, panelId, active, onClick, icon: Icon, children }: TabButtonProps) {
  return (
    <button
      type="button"
      role="tab"
      id={id}
      aria-selected={active}
      aria-controls={panelId}
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full transition-colors',
        active ? 'bg-surface-2 text-fg-bright' : 'text-fg-muted hover:text-fg',
      )}
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={2} />
      {children}
    </button>
  );
}

function BenchSection({ players, retour }: { players: LineupPlayer[]; retour: PlayersSearch }) {
  if (players.length === 0) return null;
  return (
    <div>
      <h3 className="eyebrow mb-3">Banc · {players.length} joueurs</h3>
      <div className="space-y-2">
        {players.map((p) => (
          <Link
            key={p.id}
            to="/player/$athleteId"
            params={{ athleteId: String(p.athleteId) }}
            search={retour}
            className="block focus:outline-none focus:ring-2 focus:ring-ol-red/50 rounded-md"
          >
            <PlayerCard player={p} compact />
          </Link>
        ))}
      </div>
    </div>
  );
}
