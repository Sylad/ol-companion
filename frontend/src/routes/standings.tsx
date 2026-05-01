import { useStandings } from '@/hooks/use-standings';
import { KnowledgeHeader } from '@/components/knowledge-header';
import { StandingsTable } from '@/components/standings-table';
import { PositionTracker } from '@/components/position-tracker';
import { Loader2, RefreshCw } from 'lucide-react';

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h} h`;
  return `il y a ${Math.floor(h / 24)} j`;
}

export function StandingsPage() {
  const { data, isLoading, isError, refetch, isFetching } = useStandings();

  return (
    <div className="space-y-8">
      <KnowledgeHeader />

      <PositionTracker />

      <section className="rounded-md bg-surface border border-border overflow-hidden">
        <header className="px-5 py-4 flex items-center justify-between gap-4 border-b border-border">
          <div>
            <div className="eyebrow mb-1">Ligue 1 Uber Eats</div>
            <h2 className="font-display text-xl font-bold text-fg-bright leading-none">
              Classement
            </h2>
          </div>
          <div className="flex items-center gap-3 text-xs text-fg-dim">
            {data && (
              <>
                <span className="hidden sm:inline">
                  Journée <span className="num text-fg">{data.currentMatchday}</span>
                </span>
                <span className="hidden sm:inline">·</span>
                <span>{formatRelative(data.updatedAt)}</span>
              </>
            )}
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="flex items-center gap-1.5 rounded-sm border border-border-strong px-2.5 py-1.5 text-fg-muted hover:text-fg hover:border-fg-dim transition-colors disabled:opacity-50"
              aria-label="Rafraîchir"
            >
              <RefreshCw
                className={isFetching ? 'h-3 w-3 animate-spin' : 'h-3 w-3'}
                strokeWidth={2}
              />
              <span className="hidden sm:inline">Actualiser</span>
            </button>
          </div>
        </header>

        <div className="p-2 sm:p-5">
          {isLoading && (
            <div className="flex items-center justify-center py-20 text-fg-dim">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              <span>Chargement du classement…</span>
            </div>
          )}
          {isError && (
            <div className="py-20 text-center">
              <p className="text-loss font-medium mb-2">Erreur de chargement</p>
              <p className="text-fg-muted text-sm">Impossible de récupérer les données 365scores.</p>
            </div>
          )}
          {data && data.table.length > 0 && <StandingsTable rows={data.table} />}
          {data && data.table.length === 0 && (
            <p className="py-20 text-center text-fg-muted">Aucune donnée disponible.</p>
          )}
        </div>
      </section>
    </div>
  );
}
