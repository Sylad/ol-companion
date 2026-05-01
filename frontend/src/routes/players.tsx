import { useMemo, useState } from 'react';
import { Loader2, LayoutGrid, Users } from 'lucide-react';
import { useLineup } from '@/hooks/use-lineup';
import { KnowledgeHeader } from '@/components/knowledge-header';
import { FormationField } from '@/components/formation-field';
import { PlayerCard } from '@/components/player-card';
import { TeamLogo } from '@/components/team-logo';
import { cn } from '@/lib/utils';

const WEEKDAY = ['Dim.', 'Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.'];

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${WEEKDAY[d.getDay()]} ${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
}

export function PlayersPage() {
  const { data, isLoading, isError } = useLineup();
  const [tab, setTab] = useState<'formation' | 'squad'>('formation');

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
                  <PlayerCard key={p.id} player={p} />
                ))}
              </div>
            )}
          </div>
        </section>
      )}
    </div>
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
