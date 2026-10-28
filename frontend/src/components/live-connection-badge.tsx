import { Radio } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { EventStreamStatus } from '@/hooks/use-event-stream';
import { useCurrentLiveMatch } from '@/hooks/use-live-match';
import { deriveClock } from '@/lib/match-clock';
import { scoreText } from '@/lib/match-score';

const LABEL: Record<EventStreamStatus, string> = {
  connecting: 'Temps réel · en attente',
  connected: 'Temps réel · connecté',
  reconnecting: 'Temps réel · reconnexion…',
};

export function LiveConnectionBadge({
  status,
  className,
  avecScore = false,
}: {
  status: EventStreamStatus;
  className?: string;
  /** L64 : la ligne collante du téléphone ajoute le score et la minute ; la barre latérale du bureau (192 px) non. */
  avecScore?: boolean;
}) {
  const connected = status === 'connected';
  const { data: current } = useCurrentLiveMatch();
  // L208 : le rouge et le ping disent « match en cours », pas « flux connecté ».
  const matchEnCours = connected && current?.status === 'live';
  // L64 : la ligne collante garde le score et la minute à l'écran quand l'en-tête du match défile.
  // La minute passe par deriveClock (« MI-TEMPS », « TAB »…), comme l'en-tête de /match et la carte du direct.
  const score = matchEnCours && avecScore ? scoreText(current.home, current.away, current.status) : null;
  const horloge = matchEnCours && avecScore ? deriveClock(current).label : '';

  return (
    // Le score et la minute changent chaque minute : ils restent HORS de la région live (role=status),
    // qui n'annonce que l'état du flux (WAI-ARIA : une région polie ne relit pas un chronomètre).
    <div
      data-testid="pastille-direct"
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
      <span role="status" className="inline-flex items-center gap-2">
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
        <span className={cn(matchEnCours && avecScore && 'max-sm:sr-only')}>{LABEL[status]}</span>
      </span>
      {matchEnCours && avecScore && (
        <span className="num tabular-nums whitespace-nowrap">
          {current.home.symbolicName} {score ? `${score[0]} · ${score[1]}` : 'vs'} {current.away.symbolicName}
          {horloge && ` · ${horloge}`}
        </span>
      )}
    </div>
  );
}
