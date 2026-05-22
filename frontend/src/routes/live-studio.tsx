import { useState } from 'react';
import { AlertTriangle, Flag, Goal, RefreshCw, ShieldAlert, Tv, XCircle } from 'lucide-react';
import { MatchEventBurst, type EventBurstType } from '@/components/match-event-burst';
import { cn } from '@/lib/utils';

interface StudioEvent {
  type: EventBurstType;
  label: string;
  description: string;
  icon: typeof Goal;
  tone: 'red' | 'blue' | 'yellow';
}

const EVENTS: StudioEvent[] = [
  {
    type: 'goal',
    label: 'But',
    description: 'Explosion plein écran, confettis rouge et bleu.',
    icon: Goal,
    tone: 'red',
  },
  {
    type: 'yellow',
    label: 'Carton jaune',
    description: 'Carte jaune projetée façon ralenti TV.',
    icon: Flag,
    tone: 'yellow',
  },
  {
    type: 'red',
    label: 'Carton rouge',
    description: 'Impact plus brutal pour une exclusion.',
    icon: ShieldAlert,
    tone: 'red',
  },
  {
    type: 'var',
    label: 'VAR',
    description: 'Cadre de vérification vidéo, scan lumineux.',
    icon: Tv,
    tone: 'blue',
  },
  {
    type: 'goal_cancelled',
    label: 'But annulé',
    description: 'Décision VAR ou hors-jeu, prêt à brancher si 365scores le remonte.',
    icon: XCircle,
    tone: 'red',
  },
  {
    type: 'penalty_missed',
    label: 'Penalty raté',
    description: 'Ballon qui s’échappe et croix rouge immédiate.',
    icon: AlertTriangle,
    tone: 'red',
  },
  {
    type: 'sub',
    label: 'Remplacement',
    description: 'Flèches entrée/sortie rouge et bleu OL.',
    icon: RefreshCw,
    tone: 'blue',
  },
];

export function LiveStudioPage() {
  const [active, setActive] = useState<{ type: EventBurstType; id: number } | null>(null);

  function trigger(type: EventBurstType) {
    setActive({ type, id: Date.now() });
  }

  return (
    <div className="space-y-6">
      {active && <MatchEventBurst key={`${active.type}-${active.id}`} type={active.type} />}

      <header className="flex flex-col gap-1.5">
        <p className="text-[11px] uppercase tracking-[0.22em] text-fg-dim font-semibold">
          Studio live · hors saison
        </p>
        <h1 className="font-display text-3xl lg:text-4xl font-bold text-fg-bright">
          Banc d'essai des animations match
        </h1>
        <p className="max-w-2xl text-fg-muted">
          Déclenche les animations comme pendant un live, sans attendre le prochain match de Lyon.
          Les vrais événements 365scores utilisent le même composant.
        </p>
      </header>

      <section className="rounded-md border border-border bg-surface p-5">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {EVENTS.map((event) => {
            const Icon = event.icon;
            return (
              <button
                key={event.type}
                type="button"
                onClick={() => trigger(event.type)}
                className={cn(
                  'group min-h-[128px] rounded-md border bg-surface-2/35 p-4 text-left transition-all hover:-translate-y-0.5',
                  event.tone === 'yellow'
                    ? 'border-yellow-500/35 hover:border-yellow-400/80 hover:shadow-[0_18px_40px_-28px_rgba(250,204,21,0.9)]'
                    : event.tone === 'blue'
                      ? 'border-ol-blue-bright/35 hover:border-ol-blue-bright/80 hover:shadow-[0_18px_40px_-28px_rgba(59,93,201,0.9)]'
                      : 'border-ol-red/35 hover:border-ol-red-bright/80 hover:shadow-[0_18px_40px_-28px_rgba(239,68,68,0.9)]',
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-display text-lg font-bold text-fg-bright">
                      {event.label}
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-fg-muted">
                      {event.description}
                    </p>
                  </div>
                  <Icon
                    className={cn(
                      'h-5 w-5 shrink-0 transition-transform group-hover:scale-110',
                      event.tone === 'yellow'
                        ? 'text-yellow-300'
                        : event.tone === 'blue'
                          ? 'text-ol-blue-bright'
                          : 'text-ol-red-bright',
                    )}
                    strokeWidth={1.9}
                  />
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="rounded-md border border-border bg-surface p-5">
        <h2 className="font-display text-lg font-semibold text-fg-bright mb-2">
          À brancher pendant la reprise
        </h2>
        <p className="text-sm leading-relaxed text-fg-muted">
          `VAR` et `penalty_missed` sont déjà connus côté backend. Pour `but annulé`, on garde
          l'animation prête et on ajustera le mapping quand un vrai événement 365scores permettra
          d'identifier le libellé exact.
        </p>
      </section>
    </div>
  );
}
