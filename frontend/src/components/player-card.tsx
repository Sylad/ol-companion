import { useState } from 'react';
import type { LineupPlayer } from '@/types/api';
import { positionShortFr } from '@/lib/position-fr';
import { noteFr } from '@/lib/note-fr';
import { hasJersey } from '@/lib/jersey';
import { initiales } from '@/lib/initiales';
import { cn } from '@/lib/utils';

function playerPhotoUrl(p: LineupPlayer): string | null {
  if (p.athleteId && p.imageVersion) {
    return `https://imagecache.365scores.com/image/upload/f_png,w_180,h_180,c_limit,r_max,q_auto:eco/v${p.imageVersion}/Athletes/${p.athleteId}`;
  }
  return null;
}

const POSITION_TONE: Record<string, string> = {
  GK: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30',
  DEF: 'text-cyan-300 bg-cyan-500/10 border-cyan-500/30',
  CB: 'text-cyan-300 bg-cyan-500/10 border-cyan-500/30',
  RB: 'text-cyan-300 bg-cyan-500/10 border-cyan-500/30',
  LB: 'text-cyan-300 bg-cyan-500/10 border-cyan-500/30',
  MID: 'text-fg-muted bg-surface-2 border-border-strong',
  DM: 'text-fg-muted bg-surface-2 border-border-strong',
  CM: 'text-fg-muted bg-surface-2 border-border-strong',
  AM: 'text-fg-muted bg-surface-2 border-border-strong',
  RW: 'text-ol-red-bright bg-ol-red/10 border-ol-red/30',
  LW: 'text-ol-red-bright bg-ol-red/10 border-ol-red/30',
  FW: 'text-ol-red-bright bg-ol-red/10 border-ol-red/30',
  ST: 'text-ol-red-bright bg-ol-red/10 border-ol-red/30',
  ATK: 'text-ol-red-bright bg-ol-red/10 border-ol-red/30',
};

function getPositionTone(short: string): string {
  return POSITION_TONE[short] ?? 'text-fg-muted bg-surface-2 border-border-strong';
}

interface PlayerCardProps {
  player: LineupPlayer;
  compact?: boolean;
  /** Libellé de la note affichée : celle du dernier match par défaut, « Note moyenne » pour l'effectif de la saison. */
  rankingLabel?: string;
}

export function PlayerCard({ player, compact = false, rankingLabel = 'Note dernier match' }: PlayerCardProps) {
  const [echec, setEchec] = useState<string | null>(null);
  const url = playerPhotoUrl(player);
  // Une photo qui répond 404 (athlète sans image chez 365scores) laisse place aux initiales, jamais à une <img> cassée.
  const photoUrl = url === echec ? null : url;
  const tone = getPositionTone(player.positionShort);

  return (
    <div
      className={cn(
        'group rounded-md border border-border bg-surface overflow-hidden hover:border-border-strong transition-colors',
        compact ? 'flex items-center gap-3 p-3' : 'flex flex-col',
      )}
    >
      {compact ? (
        <Avatar player={player} photoUrl={photoUrl} size={44} onError={() => setEchec(url)} />
      ) : (
        <div className="relative aspect-[3/4] bg-gradient-to-b from-surface-2 to-surface overflow-hidden">
          {photoUrl ? (
            <img
              src={photoUrl}
              alt={player.name}
              loading="lazy"
              className="absolute inset-0 w-full h-full object-contain transition-transform duration-500 group-hover:scale-105 p-2"
              onError={() => setEchec(url)}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-fg-dim text-3xl font-display font-bold">
              {initiales(player.name)}
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/40 to-transparent" />
          {hasJersey(player.jerseyNumber) && (
            <div className="absolute top-2 right-2 font-mono tabular-nums text-fg-bright font-bold text-2xl leading-none drop-shadow-lg">
              {player.jerseyNumber}
            </div>
          )}
          {!player.isStarting && (
            <div className="absolute top-2 left-2 text-[9px] uppercase tracking-wider font-bold text-fg-dim bg-bg/60 backdrop-blur-sm px-1.5 py-0.5 rounded-sm">
              Banc
            </div>
          )}
        </div>
      )}

      <div className={cn('min-w-0 flex-1', compact ? '' : 'p-3')}>
        <div className="flex items-center gap-2 mb-0.5">
          <span
            className={cn(
              'shrink-0 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-sm border',
              tone,
            )}
          >
            {positionShortFr(player.positionShort)}
          </span>
          {compact && hasJersey(player.jerseyNumber) && (
            <span className="font-mono tabular-nums text-fg-dim text-xs">#{player.jerseyNumber}</span>
          )}
        </div>
        <div
          className={cn(
            'font-semibold text-fg-bright leading-tight line-clamp-2 break-words',
            compact ? 'text-sm' : 'text-base',
          )}
          title={player.name}
        >
          {player.name}
        </div>
        {player.ranking !== null && player.ranking > 0 && !compact && (
          <div className="mt-2 flex items-center gap-2 text-xs">
            <span className="text-fg-dim">{rankingLabel}</span>
            <span className="font-mono tabular-nums font-bold text-fg-bright">
              {noteFr(player.ranking)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function Avatar({
  player,
  photoUrl,
  size,
  onError,
}: {
  player: LineupPlayer;
  photoUrl: string | null;
  size: number;
  onError: () => void;
}) {
  return (
    <div
      className="shrink-0 rounded-full bg-surface-2 border border-border overflow-hidden flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      {photoUrl ? (
        <img src={photoUrl} alt={player.name} className="w-full h-full object-cover" loading="lazy" onError={onError} />
      ) : (
        <span className="text-fg-dim text-sm font-bold uppercase">
          {initiales(player.name)}
        </span>
      )}
    </div>
  );
}
