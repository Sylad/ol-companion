import { Radio } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { EventStreamStatus } from '@/hooks/use-event-stream';
import { useCurrentLiveMatch } from '@/hooks/use-live-match';
import { scoreText } from '@/lib/match-score';

const LABEL: Record<EventStreamStatus, string> = {
  connecting: 'Temps réel · en attente',
  connected: 'Temps réel · connecté',
  reconnecting: 'Temps réel · reconnexion…',
};

export function LiveConnectionBadge({
  status,
  className,
}: {
  status: EventStreamStatus;
  className?: string;
}) {
  const connected = status === 'connected';
  const { data: current } = useCurrentLiveMatch();
  // L208 : le rouge et le ping disent « match en cours », pas « flux connecté ».
  const matchEnCours = connected && current?.status === 'live';
  // L64 : la ligne collante garde le score et la minute à l'écran quand l'en-tête du match défile.
  const score = matchEnCours ? scoreText(current.home, current.away, current.status) : null;

  return (
    <div
      role="status"
      className={cn(
        'inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] shadow-lg backdrop-blur-md',
        matchEnCours
          ? 'border-ol-red/45 bg-surface/80 text-fg-bright'
          : connected
            ? 'border-border bg-surface/80 text-fg-bright'
            : 'border-border bg-surface/90 text-fg-muted',
        className,
      )}
      title="État du flux temps réel OL Companion"
    >
      <span
        aria-hidden="true"
        className={cn(
          'relative flex h-2 w-2 rounded-full',
          matchEnCours ? 'bg-ol-red-bright' : connected ? 'bg-fg-muted' : 'bg-fg-dim',
        )}
      >
        {matchEnCours && <span className="absolute inset-0 rounded-full bg-ol-red-bright animate-ping" />}
      </span>
      <Radio aria-hidden="true" className="h-3 w-3" strokeWidth={2} />
      <span className={cn(matchEnCours && 'max-sm:sr-only')}>{LABEL[status]}</span>
      {matchEnCours && (
        <span className="num tabular-nums">
          {current.home.symbolicName} {score ? `${score[0]} · ${score[1]}` : 'vs'} {current.away.symbolicName} · {current.gameTimeDisplay}
        </span>
      )}
    </div>
  );
}
