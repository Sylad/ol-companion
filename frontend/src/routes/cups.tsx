import { useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useCups } from '@/hooks/use-cups';
import { KnowledgeHeader } from '@/components/knowledge-header';
import { CupMatchRow } from '@/components/cup-match-row';
import { RetryMessage } from '@/components/retry-message';
import { Bracket } from '@/components/bracket';
import { cupResult } from '@/lib/cup-result';
import { cn } from '@/lib/utils';
import type { CupInfo } from '@/types/api';

export function CupsPage() {
  const { data, isLoading, isError, refetch } = useCups();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const activeCup = useMemo(() => {
    if (!data?.length) return null;
    return data.find((cup) => cup.competitionId === selectedId) ?? data[0];
  }, [data, selectedId]);

  return (
    <div className="space-y-8">
      <KnowledgeHeader compact />

      {isLoading && (
        <div className="flex items-center justify-center py-20 text-fg">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          <span>Chargement des coupes…</span>
        </div>
      )}
      {isError && !data && (
        <section className="rounded-md bg-surface border border-border px-5 py-12">
          <RetryMessage
            message="Erreur de chargement des données coupes."
            onRetry={() => void refetch()}
            messageTestId="cups-erreur"
            buttonTestId="cups-reessayer"
          />
        </section>
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
            <div role="group" aria-label="Choisir une coupe" className="flex flex-wrap gap-2">
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
      aria-pressed={active}
      className={cn(
        'min-w-0 flex-1 basis-36 rounded-md border px-3 py-2.5 text-left transition-colors',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ol-red-bright',
        active
          ? 'border-ol-red-bright bg-ol-red/10 text-fg-bright'
          : 'border-border bg-surface-2/35 text-fg-muted hover:border-border-strong hover:text-fg',
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <span className="font-display text-sm font-semibold">{cup.name}</span>
        <span
          className={cn(
            'rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider',
            cup.isEliminated
              ? 'border-fg-dim/40 text-fg-dim'
              : 'border-ol-red-bright/50 text-ol-red-bright',
          )}
        >
          {cupStatusLabel(cup)}
        </span>
      </div>
      <div className="mt-1 text-xs text-fg-dim">
        {cup.currentStageFr} · {cup.matches.length} match{cup.matches.length > 1 ? 's' : ''}
      </div>
    </button>
  );
}

/** Phase de ligue jouée sans classement lisible : on n'affirme ni « En lice » ni « Éliminé ». */
function cupStatusLabel(cup: CupInfo): string {
  if (cup.isEliminated) return 'Éliminé';
  return cup.awaitingDraw ? 'En attente du tirage' : 'En lice';
}

function CupCard({ cup }: { cup: CupInfo }) {
  const { wins, draws, losses } = countResults(cup);
  const upcomingMatch = cup.matches.find((m) => m.status !== 'FINISHED');

  return (
    <div>
      {/* Nom, statut, phase et nombre de matchs sont dans l'onglet : affichés une fois (L6 t7). */}
      <h3 className="sr-only">{cup.name}</h3>
      <header className="px-5 py-3 border-b border-border bg-surface-2/25">
        <div className="flex items-center gap-4 text-xs">
          <Stat label="V" value={wins} tone="text-win" />
          <Stat label="N" value={draws} tone="text-draw" />
          <Stat label="D" value={losses} tone="text-loss-fg" />
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
            <CupMatchRow key={m.id} match={m} tie={cup.matches} />
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
    const r = cupResult(m, cup.matches)?.result;
    if (r === 'W') wins++;
    else if (r === 'L') losses++;
    else if (r === 'D') draws++;
  }
  return { wins, draws, losses };
}
