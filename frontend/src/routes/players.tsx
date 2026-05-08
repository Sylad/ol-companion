import { useMemo, useState } from 'react';
import { Loader2, LayoutGrid, Users, BarChart3, ArrowUpDown } from 'lucide-react';
import { Link } from '@tanstack/react-router';
import { useLineup } from '@/hooks/use-lineup';
import { useSeasonStats } from '@/hooks/use-player-stats';
import { KnowledgeHeader } from '@/components/knowledge-header';
import { FormationField } from '@/components/formation-field';
import { PlayerCard } from '@/components/player-card';
import { TeamLogo } from '@/components/team-logo';
import { cn } from '@/lib/utils';
import type { PlayerSeasonStats } from '@/types/api';

const WEEKDAY = ['Dim.', 'Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.'];

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${WEEKDAY[d.getDay()]} ${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
}

export function PlayersPage() {
  const { data, isLoading, isError } = useLineup();
  const [tab, setTab] = useState<'formation' | 'squad' | 'stats'>('formation');

  const allPlayers = useMemo(() => {
    if (!data) return [];
    return [...data.starters, ...data.bench].sort((a, b) => {
      if (a.isStarting && !b.isStarting) return -1;
      if (!a.isStarting && b.isStarting) return 1;
      return (a.jerseyNumber ?? 99) - (b.jerseyNumber ?? 99);
    });
  }, [data]);

  return (
    <div className="space-y-8">
      <KnowledgeHeader />

      {isLoading && (
        <div className="flex items-center justify-center py-20 text-fg-dim">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          <span>Chargement de l'effectif…</span>
        </div>
      )}
      {isError && (
        <p className="py-20 text-center text-loss">Erreur de chargement.</p>
      )}
      {data === null && !isLoading && (
        <p className="py-20 text-center text-fg-muted">Aucune compo récente trouvée.</p>
      )}

      {data && (
        <section className="rounded-md bg-surface border border-border overflow-hidden">
          <header className="px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border">
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
                {data.competition}
                {data.matchday ? ` · J${data.matchday}` : ''} · {formatDate(data.date)} · Composition{' '}
                <span className="text-ol-red-bright font-semibold">{data.formation}</span>
              </p>
            </div>
            <div className="flex items-center gap-1 rounded-full border border-border p-1">
              <TabButton active={tab === 'formation'} onClick={() => setTab('formation')} icon={LayoutGrid}>
                Composition
              </TabButton>
              <TabButton active={tab === 'squad'} onClick={() => setTab('squad')} icon={Users}>
                Effectif
              </TabButton>
              <TabButton active={tab === 'stats'} onClick={() => setTab('stats')} icon={BarChart3}>
                Stats saison
              </TabButton>
            </div>
          </header>

          <div className="p-5">
            {tab === 'formation' && (
              <div className="grid lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-5">
                <div className="max-w-[560px] mx-auto w-full">
                  <FormationField starters={data.starters} formation={data.formation} />
                </div>
                <BenchSection players={data.bench} />
              </div>
            )}

            {tab === 'squad' && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {allPlayers.map((p) => (
                  <Link
                    key={p.id}
                    to="/player/$athleteId"
                    params={{ athleteId: String(p.athleteId) }}
                    className="block focus:outline-none focus:ring-2 focus:ring-ol-red/50 rounded-md"
                  >
                    <PlayerCard player={p} />
                  </Link>
                ))}
              </div>
            )}

            {tab === 'stats' && <SeasonStatsTab />}
          </div>
        </section>
      )}
    </div>
  );
}

type SortKey = 'goalContributions' | 'goals' | 'assists' | 'minutesPlayed' | 'matchesPlayed' | 'shots' | 'averageRating';

interface SortHeaderProps {
  label: string;
  sortKey: SortKey;
  current: SortKey;
  onSort: (k: SortKey) => void;
  align?: 'left' | 'right';
}

function SortHeader({ label, sortKey, current, onSort, align = 'right' }: SortHeaderProps) {
  const active = current === sortKey;
  return (
    <th className={cn('px-2 py-2 font-semibold', align === 'left' ? 'text-left' : 'text-right')}>
      <button
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

function SeasonStatsTab() {
  const { data, isLoading, isError } = useSeasonStats();
  const [sortKey, setSortKey] = useState<SortKey>('goalContributions');

  const sorted = useMemo(() => {
    if (!data) return [];
    return [...data].sort((a, b) => {
      const av = ((a[sortKey] as number | null) ?? -1) as number;
      const bv = ((b[sortKey] as number | null) ?? -1) as number;
      if (bv !== av) return bv - av;
      return a.name.localeCompare(b.name, 'fr');
    });
  }, [data, sortKey]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10 text-fg-dim">
        <Loader2 className="h-4 w-4 animate-spin mr-2" /> Chargement des stats…
      </div>
    );
  }
  if (isError) {
    return <p className="py-10 text-center text-loss">Erreur de chargement des stats.</p>;
  }
  if (!data || data.length === 0) {
    return (
      <p className="py-10 text-center text-fg-muted">
        Pas encore de statistiques agrégées (pas de match terminé dans le cache).
      </p>
    );
  }

  return (
    <div className="overflow-x-auto -mx-5">
      <table className="w-full text-sm min-w-[640px]">
        <thead>
          <tr className="text-fg-dim text-[11px] uppercase tracking-wider font-semibold border-b border-border">
            <th className="text-left px-4 py-2 font-semibold">Joueur</th>
            <SortHeader label="Matchs" sortKey="matchesPlayed" current={sortKey} onSort={setSortKey} />
            <SortHeader label="Min" sortKey="minutesPlayed" current={sortKey} onSort={setSortKey} />
            <SortHeader label="Buts" sortKey="goals" current={sortKey} onSort={setSortKey} />
            <SortHeader label="Passes D." sortKey="assists" current={sortKey} onSort={setSortKey} />
            <SortHeader label="B+P" sortKey="goalContributions" current={sortKey} onSort={setSortKey} />
            <SortHeader label="Tirs" sortKey="shots" current={sortKey} onSort={setSortKey} />
            <SortHeader label="Note" sortKey="averageRating" current={sortKey} onSort={setSortKey} />
          </tr>
        </thead>
        <tbody>
          {sorted.map((p) => (
            <PlayerStatsRow key={p.athleteId} player={p} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PlayerStatsRow({ player }: { player: PlayerSeasonStats }) {
  return (
    <tr className="border-b border-border/60 hover:bg-surface-2 transition-colors">
      <td className="px-4 py-2">
        <Link
          to="/player/$athleteId"
          params={{ athleteId: String(player.athleteId) }}
          className="flex items-center gap-2 group"
        >
          <span className="text-[10px] font-mono text-fg-dim w-6 tabular-nums shrink-0">
            {player.jerseyNumber !== null ? `#${player.jerseyNumber}` : '—'}
          </span>
          <span className="font-semibold text-fg group-hover:text-ol-red-bright transition-colors">
            {player.name}
          </span>
          <span className="text-[10px] uppercase tracking-wider text-fg-dim">
            {player.positionShort}
          </span>
        </Link>
      </td>
      <td className="px-2 py-2 text-right tabular-nums text-fg">
        {player.matchesPlayed}
        {player.matchesStarted > 0 && (
          <span className="text-fg-dim text-xs"> ({player.matchesStarted})</span>
        )}
      </td>
      <td className="px-2 py-2 text-right tabular-nums text-fg-muted">{player.minutesPlayed}</td>
      <td className={cn(
        'px-2 py-2 text-right tabular-nums',
        player.goals > 0 ? 'text-ol-red-bright font-bold' : 'text-fg-dim',
      )}>{player.goals}</td>
      <td className={cn(
        'px-2 py-2 text-right tabular-nums',
        player.assists > 0 ? 'text-ol-red-bright font-bold' : 'text-fg-dim',
      )}>{player.assists}</td>
      <td className={cn(
        'px-2 py-2 text-right tabular-nums font-bold',
        player.goalContributions > 0 ? 'text-fg-bright' : 'text-fg-dim',
      )}>{player.goalContributions}</td>
      <td className="px-2 py-2 text-right tabular-nums text-fg-muted">
        {player.shots}{player.shotsOnTarget > 0 ? ` (${player.shotsOnTarget})` : ''}
      </td>
      <td className={cn(
        'px-2 py-2 text-right tabular-nums',
        player.averageRating !== null ? 'text-fg' : 'text-fg-dim',
      )}>
        {player.averageRating !== null ? player.averageRating.toFixed(1) : '—'}
      </td>
    </tr>
  );
}

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  icon: typeof LayoutGrid;
  children: React.ReactNode;
}

function TabButton({ active, onClick, icon: Icon, children }: TabButtonProps) {
  return (
    <button
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

function BenchSection({ players }: { players: import('@/types/api').LineupPlayer[] }) {
  if (players.length === 0) return null;
  return (
    <div>
      <h3 className="eyebrow mb-3">Banc · {players.length} joueurs</h3>
      <div className="space-y-2">
        {players.map((p) => (
          <PlayerCard key={p.id} player={p} compact />
        ))}
      </div>
    </div>
  );
}
