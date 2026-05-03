import { useParams, useSearch, Link } from '@tanstack/react-router';
import { Loader2, Radio, ArrowLeft } from 'lucide-react';
import { useLiveMatchStats } from '@/hooks/use-live-match';
import { ShotMap } from '@/components/shot-map';
import { cn } from '@/lib/utils';
import type { LiveMatchTimelineEvent } from '@/types/api';

const OL_ID = 465;

const EVENT_LABEL: Record<string, string> = {
  goal: '⚽ But',
  penalty_goal: '⚽ But sur penalty',
  own_goal: '⚽ Csc',
  yellow_card: '🟨 Carton jaune',
  red_card: '🟥 Carton rouge',
  second_yellow_red: '🟥 2e jaune',
  card: '🟨 Carton',
  substitution: '↔ Remplacement',
  var: 'VAR',
  penalty_missed: '❌ Penalty raté',
};

const STAT_DISPLAY: { key: string; label: string; fmt?: (n: number) => string; isPercent?: boolean }[] = [
  { key: 'Touches', label: 'Possession (touches)' },
  { key: 'Tirs au total', label: 'Tirs' },
  { key: 'Tirs cadrés', label: 'Tirs cadrés' },
  { key: 'Buts attendus', label: 'xG (buts attendus)', fmt: (n) => n.toFixed(2) },
  { key: 'Passes Completed', label: 'Passes complétées' },
  { key: 'Passes dans le dernier tiers', label: 'Passes dans la moitié adverse' },
  { key: 'Centres réussis', label: 'Centres réussis' },
  { key: 'Tacles Gagnés', label: 'Tacles gagnés' },
  { key: 'Les interceptions', label: 'Interceptions' },
  { key: 'Duels au sol gagnés', label: 'Duels au sol' },
  { key: 'Duels aériens gagnés', label: 'Duels aériens' },
  { key: 'Récupération du ballon', label: 'Récupérations' },
  { key: 'Fautes faites', label: 'Fautes' },
  { key: 'Hors jeu', label: 'Hors-jeu' },
];

function StatRow({
  label,
  home,
  away,
  fmt,
}: {
  label: string;
  home: number;
  away: number;
  fmt?: (n: number) => string;
}) {
  const total = home + away;
  const pctHome = total > 0 ? (home / total) * 100 : 50;
  const f = fmt ?? ((n: number) => `${Math.round(n)}`);

  return (
    <div className="grid grid-cols-[60px_1fr_60px] items-center gap-3">
      <span className="text-right num tabular-nums font-bold text-fg-bright">{f(home)}</span>
      <div>
        <div className="text-[10px] uppercase tracking-wider text-fg-muted text-center mb-1">{label}</div>
        <div className="relative h-2 rounded-full bg-surface-2 overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 bg-ol-red rounded-full transition-all"
            style={{ width: `${pctHome}%` }}
          />
          <div
            className="absolute inset-y-0 right-0 bg-ol-blue rounded-full transition-all"
            style={{ width: `${100 - pctHome}%` }}
          />
        </div>
      </div>
      <span className="text-left num tabular-nums font-bold text-fg-bright">{f(away)}</span>
    </div>
  );
}

function TimelineRow({ event, homeId, homeSymbol, awaySymbol }: {
  event: LiveMatchTimelineEvent; homeId: number; homeSymbol: string; awaySymbol: string;
}) {
  const isHome = event.competitorId === homeId;
  const label = EVENT_LABEL[event.type] ?? event.description;
  return (
    <div className="grid grid-cols-[1fr_60px_1fr] items-center gap-3 py-1.5">
      <div className={cn('text-right text-sm', !isHome && 'text-fg-dim')}>
        {isHome && <span className="font-medium">{label}</span>}
      </div>
      <div className="text-center">
        <span className="num tabular-nums text-xs font-bold text-fg-bright">{event.gameTimeDisplay}</span>
        <div className="text-[10px] uppercase tracking-wider text-fg-dim">{isHome ? homeSymbol : awaySymbol}</div>
      </div>
      <div className={cn('text-left text-sm', isHome && 'text-fg-dim')}>
        {!isHome && <span className="font-medium">{label}</span>}
      </div>
    </div>
  );
}

interface MatchSearch {
  matchupId?: string;
}

export function MatchPage() {
  const { gameId } = useParams({ from: '/match/$gameId' });
  const { matchupId } = useSearch({ from: '/match/$gameId' }) as MatchSearch;
  const numericGameId = Number(gameId);
  const { data, isLoading, isError } = useLiveMatchStats(
    Number.isFinite(numericGameId) ? numericGameId : null,
    matchupId ?? null,
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-fg-dim">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Chargement du match…
      </div>
    );
  }
  if (isError || !data) {
    return (
      <div className="space-y-3 max-w-md mx-auto text-center py-20">
        <p className="text-loss font-semibold">Match introuvable</p>
        <Link to="/" className="text-fg-muted underline text-sm">Retour à l'accueil</Link>
      </div>
    );
  }

  const olIsHome = data.home.id === OL_ID;
  const isLive = data.status === 'live';

  return (
    <div className="space-y-6">
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg">
        <ArrowLeft className="h-4 w-4" /> Accueil
      </Link>

      {/* Header */}
      <section className="rounded-md bg-surface border border-border overflow-hidden">
        <header className="px-5 py-3 flex items-center justify-between border-b border-border">
          <div className="flex items-center gap-2">
            {isLive ? (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-ol-red text-white text-[10px] font-bold uppercase tracking-wider">
                <Radio className="h-3 w-3 animate-pulse" strokeWidth={2.5} />
                Live
              </span>
            ) : (
              <span className="text-[10px] font-bold uppercase tracking-wider text-fg-muted">
                {data.status === 'ended' ? 'Terminé' : 'À venir'}
              </span>
            )}
            <span className="text-xs text-fg-muted">{data.competitionName}</span>
          </div>
          <span className="text-xs text-fg-muted num tabular-nums">{data.gameTimeDisplay || data.statusText}</span>
        </header>
        <div className="px-5 py-8 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
          <div className="text-right">
            <div className={cn('font-display font-bold text-2xl leading-none', olIsHome && 'text-ol-red-bright')}>
              {data.home.name}
            </div>
          </div>
          <div className="text-5xl font-bold tabular-nums num text-fg-bright">
            {data.home.score ?? '-'}<span className="text-fg-dim mx-2">·</span>{data.away.score ?? '-'}
          </div>
          <div>
            <div className={cn('font-display font-bold text-2xl leading-none', !olIsHome && 'text-ol-red-bright')}>
              {data.away.name}
            </div>
          </div>
        </div>
      </section>

      {/* Timeline */}
      {data.events.length > 0 && (
        <section className="rounded-md bg-surface border border-border overflow-hidden">
          <header className="px-5 py-3 border-b border-border">
            <div className="eyebrow">Faits du match</div>
          </header>
          <div className="px-5 py-3 divide-y divide-border">
            {data.events.map((e, i) => (
              <TimelineRow
                key={`${e.gameTime}-${i}`}
                event={e}
                homeId={data.home.id}
                homeSymbol={data.home.symbolicName}
                awaySymbol={data.away.symbolicName}
              />
            ))}
          </div>
        </section>
      )}

      {/* Shot map */}
      {data.shots.length > 0 && (
        <ShotMap
          shots={data.shots}
          homeId={data.home.id}
          awayId={data.away.id}
          homeName={data.home.name}
          awayName={data.away.name}
          homeSymbol={data.home.symbolicName}
          awaySymbol={data.away.symbolicName}
        />
      )}

      {/* Stats */}
      <section className="rounded-md bg-surface border border-border overflow-hidden">
        <header className="px-5 py-3 border-b border-border">
          <div className="eyebrow">Statistiques</div>
        </header>
        <div className="px-5 py-5 space-y-4">
          {STAT_DISPLAY.map((s) => {
            const home = data.teamStats.home[s.key] ?? 0;
            const away = data.teamStats.away[s.key] ?? 0;
            if (home === 0 && away === 0) return null;
            return <StatRow key={s.key} label={s.label} home={home} away={away} fmt={s.fmt} />;
          })}
        </div>
      </section>

      {/* Top performers */}
      {data.topPerformers.length > 0 && (
        <section className="rounded-md bg-surface border border-border overflow-hidden">
          <header className="px-5 py-3 border-b border-border">
            <div className="eyebrow">Joueurs en vue</div>
          </header>
          <div className="px-5 py-3 divide-y divide-border">
            {data.topPerformers.map((tp, i) => (
              <div key={i} className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 py-2.5">
                <div className="text-right">
                  {tp.homePlayer ? (
                    <>
                      <div className="font-semibold text-fg">{tp.homePlayer.name}</div>
                      <div className="text-xs text-fg-muted">{tp.homePlayer.statName}: <span className="num tabular-nums font-semibold text-fg">{tp.homePlayer.statValue}</span></div>
                    </>
                  ) : <span className="text-fg-dim text-xs">—</span>}
                </div>
                <div className="text-[10px] uppercase tracking-wider text-fg-dim text-center px-3 whitespace-nowrap">
                  {tp.role}
                </div>
                <div className="text-left">
                  {tp.awayPlayer ? (
                    <>
                      <div className="font-semibold text-fg">{tp.awayPlayer.name}</div>
                      <div className="text-xs text-fg-muted">{tp.awayPlayer.statName}: <span className="num tabular-nums font-semibold text-fg">{tp.awayPlayer.statValue}</span></div>
                    </>
                  ) : <span className="text-fg-dim text-xs">—</span>}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
