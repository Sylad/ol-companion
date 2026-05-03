import { Link } from '@tanstack/react-router';
import { Radio, Trophy, Clock } from 'lucide-react';
import { useCurrentLiveMatch, useLiveMatchStats } from '@/hooks/use-live-match';
import { cn } from '@/lib/utils';

const OL_ID = 465;

function StatBar({
  label,
  home,
  away,
  fmt = (n: number) => `${Math.round(n)}`,
}: {
  label: string;
  home: number;
  away: number;
  fmt?: (n: number) => string;
}) {
  const total = home + away;
  const pctHome = total > 0 ? (home / total) * 100 : 50;
  return (
    <div className="grid grid-cols-[42px_1fr_42px] items-center gap-2 text-xs">
      <span className="text-right num tabular-nums font-semibold text-fg">{fmt(home)}</span>
      <div className="relative h-1.5 rounded-full bg-surface overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 bg-ol-red rounded-full transition-all"
          style={{ width: `${pctHome}%` }}
        />
        <div
          className="absolute inset-y-0 right-0 bg-ol-blue rounded-full transition-all"
          style={{ width: `${100 - pctHome}%` }}
        />
      </div>
      <span className="text-left num tabular-nums font-semibold text-fg">{fmt(away)}</span>
      <span className="col-span-3 text-[10px] uppercase tracking-wider text-fg-dim text-center -mt-0.5">
        {label}
      </span>
    </div>
  );
}

export function LiveMatchCard() {
  const { data: current, isLoading } = useCurrentLiveMatch();
  const { data: stats } = useLiveMatchStats(current?.gameId ?? null, current?.matchupId ?? null);

  if (isLoading || !current) return null;

  const olIsHome = current.home.id === OL_ID;
  const isLive = current.status === 'live';
  const isUpcoming = current.status === 'upcoming';

  const homePoss = stats?.teamStats.home['Touches'] ?? 0;
  const awayPoss = stats?.teamStats.away['Touches'] ?? 0;
  const homeShots = stats?.teamStats.home['Tirs au total'] ?? 0;
  const awayShots = stats?.teamStats.away['Tirs au total'] ?? 0;
  const homeXg = stats?.teamStats.home['Buts attendus'] ?? 0;
  const awayXg = stats?.teamStats.away['Buts attendus'] ?? 0;
  const lastEvents = (stats?.events ?? []).filter((e) => e.isMajor).slice(-3);

  return (
    <Link
      to="/match/$gameId"
      params={{ gameId: String(current.gameId) }}
      search={{ matchupId: current.matchupId }}
      className={cn(
        'block rounded-md bg-surface border overflow-hidden hover:border-border-strong transition-colors',
        isLive ? 'border-ol-red shadow-[0_0_0_1px_rgba(244,30,55,0.25)]' : 'border-border',
      )}
    >
      <header className="px-5 py-3 flex items-center justify-between border-b border-border">
        <div className="flex items-center gap-2">
          {isLive ? (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-ol-red text-white text-[10px] font-bold uppercase tracking-wider">
              <Radio className="h-3 w-3 animate-pulse" strokeWidth={2.5} />
              Live
            </span>
          ) : isUpcoming ? (
            <span className="inline-flex items-center gap-1.5 text-fg-muted text-[10px] font-bold uppercase tracking-wider">
              <Clock className="h-3 w-3" strokeWidth={2.5} />
              À venir
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-fg-muted text-[10px] font-bold uppercase tracking-wider">
              <Trophy className="h-3 w-3" strokeWidth={2.5} />
              Terminé
            </span>
          )}
          <span className="text-xs text-fg-muted">{current.competitionName}</span>
        </div>
        <span className="text-xs text-fg-muted num tabular-nums">{current.gameTimeDisplay || current.statusText}</span>
      </header>

      <div className="px-5 py-5 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
        <div className="text-right">
          <div className={cn('font-display font-bold text-lg leading-none truncate', olIsHome && 'text-ol-red-bright')}>
            {current.home.name}
          </div>
        </div>
        <div className="text-3xl font-bold tabular-nums num text-fg-bright">
          {current.home.score ?? '-'}<span className="text-fg-dim mx-1.5">·</span>{current.away.score ?? '-'}
        </div>
        <div className="text-left">
          <div className={cn('font-display font-bold text-lg leading-none truncate', !olIsHome && 'text-ol-red-bright')}>
            {current.away.name}
          </div>
        </div>
      </div>

      {(isLive || current.status === 'ended') && stats && (
        <div className="px-5 pb-4 space-y-3">
          <StatBar label="Possession (touches)" home={homePoss} away={awayPoss} />
          <StatBar label="Tirs au total" home={homeShots} away={awayShots} />
          <StatBar label="Buts attendus (xG)" home={homeXg} away={awayXg} fmt={(n) => n.toFixed(2)} />
        </div>
      )}

      {lastEvents.length > 0 && (
        <div className="px-5 pb-4 pt-2 border-t border-border space-y-1">
          {lastEvents.map((e, i) => (
            <div key={i} className="text-xs flex items-center gap-2 text-fg-muted">
              <span className="num tabular-nums text-fg w-9">{e.gameTimeDisplay}</span>
              <span className="font-semibold uppercase tracking-wider text-[10px] text-ol-red-bright">
                {e.type === 'goal' ? '⚽ But' : e.type === 'yellow_card' ? '🟨' : e.type === 'red_card' ? '🟥' : e.description}
              </span>
              <span className="ml-auto text-fg">
                {e.competitorId === current.home.id ? current.home.symbolicName : current.away.symbolicName}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="px-5 py-2 bg-surface-2 text-[10px] uppercase tracking-wider text-fg-dim text-center">
        Détails complets →
      </div>
    </Link>
  );
}
