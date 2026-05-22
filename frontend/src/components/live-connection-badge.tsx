import { Radio } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { EventStreamStatus } from '@/hooks/use-event-stream';

const LABEL: Record<EventStreamStatus, string> = {
  connecting: 'Live en attente',
  connected: 'Live connecté',
  reconnecting: 'Live reconnecte',
};

export function LiveConnectionBadge({
  status,
  className,
}: {
  status: EventStreamStatus;
  className?: string;
}) {
  const connected = status === 'connected';

  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] shadow-lg backdrop-blur-md',
        connected
          ? 'border-ol-red/45 bg-surface/80 text-fg-bright'
          : 'border-border bg-surface/90 text-fg-muted',
        className,
      )}
      title="Etat du flux temps reel OL Companion"
    >
      <span
        className={cn(
          'relative flex h-2 w-2 rounded-full',
          connected ? 'bg-ol-red-bright' : 'bg-fg-dim',
        )}
      >
        {connected && <span className="absolute inset-0 rounded-full bg-ol-red-bright animate-ping" />}
      </span>
      <Radio className="h-3 w-3" strokeWidth={2} />
      {LABEL[status]}
    </div>
  );
}
