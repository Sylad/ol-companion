import { isOlTeamName } from '@/lib/ol-name';
import { useMemo, useState } from 'react';
import { Loader2, Trophy, ShieldAlert } from 'lucide-react';
import { useCups } from '@/hooks/use-cups';
import { KnowledgeHeader } from '@/components/knowledge-header';
import { CupMatchRow } from '@/components/cup-match-row';
import { Bracket } from '@/components/bracket';
import { cn } from '@/lib/utils';
import type { CupInfo } from '@/types/api';

export function CupsPage() {
  const { data, isLoading, isError } = useCups();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const activeCup = useMemo(() => {
    if (!data?.length) return null;
    return data.find((cup) => cup.competitionId === selectedId) ?? data[0];
  }, [data, selectedId]);

  return (
    <div className="space-y-8">
      <KnowledgeHeader />

      {isLoading && (
        <div className="flex items-center justify-center py-20 text-fg-dim">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          <span>Chargement des coupes…</span>
        </div>
      )}
      {isError && (
        <p className="py-20 text-center text-loss">
          Erreur de chargement des données coupes.
        </p>
      )}
      {data && data.length === 0 && (
        <p className="py-20 text-center text-fg-muted">
          Aucune compétition à élimination cette saison.
        </p>
      )}

      {data && data.length > 0 && activeCup && (
        <section className="rounded-md bg-surface border border-border overflow-hidden">
          <header className="border-b border-border p-4">
            <div className="mb-4 flex flex-col gap-1">
              <div className="eyebrow">Compétitions à élimination</div>
              <h2 className="font-display text-xl font-bold text-fg-bright leading-none">
                Parcours en coupes
              </h2>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]">
              {data.map((cup) => (
                <CupTab
                  key={cup.competitionId}
                  cup={cup}
                  active={cup.competitionId === activeCup.competitionId}
                  onClick={() => setSelectedId(cup.competitionId)}
                />
              ))}
            </div>
          </header>
          <CupCard cup={activeCup} />
        </section>
      )}
    </div>
  );
}

function CupTab({
  cup,
  active,
  onClick,
}: {
  cup: CupInfo;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'min-w-[220px] rounded-md border px-3 py-2.5 text-left transition-colors',
        active
          ? 'border-ol-red-bright bg-ol-red/12 text-fg-bright'
          : 'border-border bg-surface-2/35 text-fg-muted hover:border-border-strong hover:text-fg',
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="truncate font-display text-sm font-semibold">{cup.name}</span>
        <span
          className={cn(
            'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider',
            cup.isEliminated
              ? 'bg-fg-dim/15 text-fg-dim'
              : 'bg-ol-red/15 text-ol-red-bright',
          )}
        >
          {cup.isEliminated ? 'Éliminé' : 'En lice'}
        </span>
      </div>
      <div className="mt-1 text-xs text-fg-dim">
        {cup.currentStageFr} · {cup.matches.length} match{cup.matches.length > 1 ? 's' : ''}
      </div>
    </button>
  );
}

function CupCard({ cup }: { cup: CupInfo }) {
  const { wins, draws, losses } = countResults(cup);
  const upcomingMatch = cup.matches.find((m) => m.status !== 'FINISHED');

  return (
    <div>
      <header className="px-5 py-4 border-b border-border bg-surface-2/25">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'shrink-0 w-10 h-10 rounded-full flex items-center justify-center',
              cup.isEliminated
                ? 'bg-fg-dim/10 text-fg-dim'
                : 'bg-ol-red/15 text-ol-red-bright',
            )}
          >
            {cup.isEliminated ? (
              <ShieldAlert className="h-5 w-5" strokeWidth={2} />
            ) : (
              <Trophy className="h-5 w-5" strokeWidth={2} />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="eyebrow mb-0.5">Compétition à élimination</div>
            <h2 className="font-display text-lg font-bold text-fg-bright leading-tight truncate">
              {cup.name}
            </h2>
          </div>
          <div className="text-right shrink-0">
            <div className="text-[10px] uppercase tracking-wider text-fg-dim font-semibold">
              {cup.isEliminated ? 'Éliminé' : 'En lice'}
            </div>
            <div className="text-sm font-semibold text-fg mt-0.5">{cup.currentStageFr}</div>
          </div>
        </div>

        <div className="flex items-center gap-4 mt-3 text-xs">
          <Stat label="V" value={wins} tone="text-win" />
          <Stat label="N" value={draws} tone="text-draw" />
          <Stat label="D" value={losses} tone="text-loss" />
          <span className="ml-auto text-fg-dim">{cup.matches.length} match{cup.matches.length > 1 ? 's' : ''}</span>
        </div>

        {upcomingMatch && (
          <div className="mt-3 px-3 py-2 rounded-sm bg-ol-red/10 border border-ol-red/30 text-xs">
            <span className="text-ol-red-bright font-semibold uppercase tracking-wider">
              Prochain :
            </span>{' '}
            <span className="text-fg">
              {upcomingMatch.homeTeam} vs {upcomingMatch.awayTeam} · {upcomingMatch.stage}
            </span>
          </div>
        )}
      </header>

      <div className="p-4 space-y-4">
        {cup.bracket && (
          <Bracket bracket={cup.bracket} />
        )}
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {cup.matches.length === 0 && (
            <p className="text-center text-fg-muted py-6 md:col-span-2 xl:col-span-3">
              Aucun match disponible.
            </p>
          )}
          {cup.matches.map((m) => (
            <CupMatchRow key={m.id} match={m} />
          ))}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={cn('font-bold num', tone)}>{value}</span>
      <span className="text-fg-dim uppercase tracking-wider text-[10px]">{label}</span>
    </div>
  );
}

function countResults(cup: CupInfo): { wins: number; draws: number; losses: number } {
  let wins = 0,
    draws = 0,
    losses = 0;
  for (const m of cup.matches) {
    if (m.status !== 'FINISHED' || m.homeScore === null || m.awayScore === null) continue;
    const olIsHome = isOlTeamName(m.homeTeam);
    const olIsAway = isOlTeamName(m.awayTeam);
    if (!olIsHome && !olIsAway) continue;
    const olScore = olIsHome ? m.homeScore : m.awayScore;
    const oppScore = olIsHome ? m.awayScore : m.homeScore;
    if (olScore > oppScore) wins++;
    else if (olScore < oppScore) losses++;
    else draws++;
  }
  return { wins, draws, losses };
}
