import { Link, useParams } from '@tanstack/react-router';
import { Loader2, ArrowLeft, Goal, Target, Clock, Award, Activity, ShieldCheck } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  type TooltipProps,
} from 'recharts';
import { usePlayerSeasonStats } from '@/hooks/use-player-stats';
import { TeamLogo } from '@/components/team-logo';
import { cn } from '@/lib/utils';
import type { PlayerByMatch, PlayerSeasonStats } from '@/types/api';

const OL_RED = 'hsl(0 73% 50%)';
const OL_BLUE = 'hsl(224 64% 33%)';
const OL_BLUE_BRIGHT = 'hsl(226 56% 51%)';

function playerPhotoUrl(p: PlayerSeasonStats): string | null {
  if (p.athleteId && p.imageVersion) {
    return `https://imagecache.365scores.com/image/upload/f_png,w_320,h_320,c_limit,r_max,q_auto:eco/v${p.imageVersion}/Athletes/${p.athleteId}`;
  }
  return null;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
}

const COMP_LABEL: Record<PlayerByMatch['competitionCode'], string> = {
  L1: 'L1',
  CDF: 'CdF',
  UEL: 'C3',
  OTHER: '—',
};

function ResultBadge({ result }: { result: PlayerByMatch['result'] }) {
  if (!result) return <span className="text-fg-dim">—</span>;
  const tone =
    result === 'W' ? 'bg-win/20 text-win border-win/30'
    : result === 'L' ? 'bg-loss/20 text-loss border-loss/30'
    : 'bg-draw/20 text-draw border-draw/30';
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold rounded border tabular-nums',
        tone,
      )}
    >
      {result}
    </span>
  );
}

interface SparkPoint {
  index: number;
  label: string;
  value: number;
  match: PlayerByMatch;
}

function SparkTooltip({ active, payload, unit }: TooltipProps<number, string> & { unit: string }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload as SparkPoint;
  const m = p.match;
  return (
    <div className="rounded-md border border-border-strong bg-surface-2 px-3 py-2 text-xs shadow-lg">
      <div className="text-fg-dim mb-1">
        {formatDate(m.date)} · vs {m.opponent}{' '}
        <span className="text-fg-dim">({COMP_LABEL[m.competitionCode]})</span>
      </div>
      <div className="text-fg-bright font-semibold tabular-nums">
        {p.value} {unit}
      </div>
    </div>
  );
}

function Sparkline({
  series,
  color,
  unit,
}: {
  series: SparkPoint[];
  color: string;
  unit: string;
}) {
  if (series.length === 0) {
    return (
      <div className="h-32 flex items-center justify-center text-xs text-fg-dim">
        Aucun match
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={128}>
      <LineChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
        <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="2 4" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fill: 'hsl(var(--fg-dim))', fontSize: 10 }}
          interval="preserveStartEnd"
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: 'hsl(var(--fg-dim))', fontSize: 10 }}
          width={28}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
        />
        <Tooltip content={<SparkTooltip unit={unit} />} cursor={{ stroke: color, strokeOpacity: 0.4 }} />
        <Line
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2}
          dot={{ r: 2.5, fill: color }}
          activeDot={{ r: 4, fill: color }}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

function HeroStat({
  icon: Icon,
  label,
  value,
  highlight = false,
}: {
  icon: typeof Goal;
  label: string;
  value: number | string;
  highlight?: boolean;
}) {
  return (
    <div className={cn(
      'rounded-md border border-border bg-surface-2 px-3 py-3',
      highlight && 'border-ol-red/40 bg-ol-red/5',
    )}>
      <div className="flex items-center gap-1.5 text-fg-dim text-[10px] uppercase tracking-wider font-semibold">
        <Icon className="h-3 w-3" strokeWidth={2.5} />
        {label}
      </div>
      <div className={cn(
        'mt-1 font-display text-2xl font-bold tabular-nums leading-none',
        highlight ? 'text-ol-red-bright' : 'text-fg-bright',
      )}>
        {value}
      </div>
    </div>
  );
}

export function PlayerDetailPage() {
  const { athleteId: athleteIdRaw } = useParams({ from: '/player/$athleteId' });
  const athleteId = Number(athleteIdRaw);
  const { data: player, isLoading, isError } = usePlayerSeasonStats(
    Number.isFinite(athleteId) ? athleteId : null,
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-fg-dim">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Chargement du joueur…
      </div>
    );
  }

  if (isError || !player) {
    return (
      <div className="space-y-4">
        <Link
          to="/players"
          className="inline-flex items-center gap-2 text-sm text-fg-dim hover:text-fg"
        >
          <ArrowLeft className="h-4 w-4" /> Retour à l'effectif
        </Link>
        <p className="py-20 text-center text-loss">
          Aucune statistique trouvée pour ce joueur.
        </p>
      </div>
    );
  }

  const photoUrl = playerPhotoUrl(player);

  const goalSeries: SparkPoint[] = player.byMatch.map((m, i) => ({
    index: i,
    label: formatDate(m.date),
    value: m.goals + m.assists,
    match: m,
  }));
  const minutesSeries: SparkPoint[] = player.byMatch.map((m, i) => ({
    index: i,
    label: formatDate(m.date),
    value: m.minutes,
    match: m,
  }));

  return (
    <div className="space-y-6">
      <Link
        to="/players"
        className="inline-flex items-center gap-2 text-sm text-fg-dim hover:text-fg-bright transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Retour à l'effectif
      </Link>

      <section className="rounded-md bg-surface border border-border overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-[180px_1fr] gap-5 p-5 md:p-6">
          <div className="relative aspect-square md:aspect-auto md:h-44 mx-auto md:mx-0 w-44 md:w-44 rounded-md bg-gradient-to-b from-ol-blue/10 to-surface-2 border border-border overflow-hidden">
            {photoUrl ? (
              <img
                src={photoUrl}
                alt={player.name}
                className="absolute inset-0 w-full h-full object-contain p-2"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-fg-dim text-4xl font-display font-bold">
                {player.shortName.split(' ').map((p) => p[0]).join('').slice(0, 2)}
              </div>
            )}
            {player.jerseyNumber !== null && (
              <div className="absolute top-2 right-2 font-mono tabular-nums text-fg-bright font-bold text-2xl leading-none drop-shadow-lg">
                {player.jerseyNumber}
              </div>
            )}
          </div>

          <div className="min-w-0">
            <div className="eyebrow mb-1">Saison en cours</div>
            <h1 className="font-display text-3xl font-bold text-fg-bright leading-tight tracking-tight">
              {player.name}
            </h1>
            <p className="mt-1 text-sm text-fg-muted">
              <span className="text-fg-bright font-semibold">{player.position || player.positionShort}</span>
              {player.jerseyNumber !== null && (
                <>
                  {' '}· <span className="font-mono tabular-nums">#{player.jerseyNumber}</span>
                </>
              )}
              {' '}· {player.matchesPlayed} match{player.matchesPlayed > 1 ? 's' : ''} ({player.matchesStarted} titulaire{player.matchesStarted > 1 ? 's' : ''})
            </p>

            <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
              <HeroStat icon={Goal} label="Buts" value={player.goals} highlight={player.goals > 0} />
              <HeroStat icon={Target} label="Passes déc." value={player.assists} highlight={player.assists > 0} />
              <HeroStat icon={Clock} label="Minutes" value={player.minutesPlayed} />
              <HeroStat icon={Activity} label="Tirs / cadrés" value={`${player.shots}/${player.shotsOnTarget}`} />
              <HeroStat
                icon={Award}
                label="Note moy."
                value={player.averageRating !== null ? player.averageRating.toFixed(1) : '—'}
              />
            </div>

            {(player.yellowCards > 0 || player.redCards > 0) && (
              <div className="mt-3 flex items-center gap-3 text-xs text-fg-muted">
                <ShieldCheck className="h-3.5 w-3.5 text-fg-dim" />
                <span>
                  Cartons{' '}
                  <span className="inline-block w-2 h-3 rounded-sm bg-yellow-400 align-middle mx-1"></span>
                  <span className="font-mono tabular-nums">{player.yellowCards}</span>
                  {player.redCards > 0 && (
                    <>
                      {' '}·{' '}
                      <span className="inline-block w-2 h-3 rounded-sm bg-loss align-middle mx-1"></span>
                      <span className="font-mono tabular-nums">{player.redCards}</span>
                    </>
                  )}
                </span>
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="rounded-md bg-surface border border-border p-5">
          <header className="flex items-center justify-between mb-3">
            <div>
              <div className="eyebrow mb-1">Évolution</div>
              <h2 className="font-display text-base font-bold text-fg-bright leading-none">
                Buts + passes par match
              </h2>
            </div>
            <span className="text-[10px] uppercase tracking-wider font-semibold text-ol-red-bright">
              {player.goalContributions} contribution{player.goalContributions > 1 ? 's' : ''}
            </span>
          </header>
          <Sparkline series={goalSeries} color={OL_RED} unit="" />
        </section>

        <section className="rounded-md bg-surface border border-border p-5">
          <header className="flex items-center justify-between mb-3">
            <div>
              <div className="eyebrow mb-1">Temps de jeu</div>
              <h2 className="font-display text-base font-bold text-fg-bright leading-none">
                Minutes par match
              </h2>
            </div>
            <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: OL_BLUE_BRIGHT }}>
              {player.minutesPlayed} min total
            </span>
          </header>
          <Sparkline series={minutesSeries} color={OL_BLUE} unit="min" />
        </section>
      </div>

      <section className="rounded-md bg-surface border border-border overflow-hidden">
        <header className="px-5 py-4 border-b border-border">
          <div className="eyebrow mb-1">Détail saison</div>
          <h2 className="font-display text-base font-bold text-fg-bright leading-none">
            {player.byMatch.length} match{player.byMatch.length > 1 ? 's' : ''} disputé{player.byMatch.length > 1 ? 's' : ''}
          </h2>
        </header>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-fg-dim text-[11px] uppercase tracking-wider font-semibold border-b border-border">
                <th className="text-left px-4 py-2 font-semibold">Date</th>
                <th className="text-left px-4 py-2 font-semibold">Adv.</th>
                <th className="text-center px-2 py-2 font-semibold">Score</th>
                <th className="text-center px-2 py-2 font-semibold">Comp.</th>
                <th className="text-right px-2 py-2 font-semibold">Min</th>
                <th className="text-right px-2 py-2 font-semibold">Buts</th>
                <th className="text-right px-2 py-2 font-semibold">Passes D.</th>
                <th className="text-right px-2 py-2 font-semibold">Tirs</th>
              </tr>
            </thead>
            <tbody>
              {[...player.byMatch].reverse().map((m) => (
                <tr key={m.gameId} className="border-b border-border/60 hover:bg-surface-2 transition-colors">
                  <td className="px-4 py-2 text-fg-muted tabular-nums">{formatDate(m.date)}</td>
                  <td className="px-4 py-2">
                    <span className="text-fg-bright">{m.opponent}</span>
                    <span className="ml-1 text-fg-dim text-xs">{m.isHome ? '(D)' : '(E)'}</span>
                  </td>
                  <td className="px-2 py-2 text-center font-mono tabular-nums text-fg-bright">
                    {m.olScore !== null && m.opponentScore !== null
                      ? m.isHome
                        ? `${m.olScore}-${m.opponentScore}`
                        : `${m.opponentScore}-${m.olScore}`
                      : '—'}{' '}
                    <ResultBadge result={m.result} />
                  </td>
                  <td className="px-2 py-2 text-center text-fg-muted text-xs font-semibold">
                    {COMP_LABEL[m.competitionCode]}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-fg">{m.minutes}</td>
                  <td className={cn(
                    'px-2 py-2 text-right tabular-nums',
                    m.goals > 0 ? 'text-ol-red-bright font-bold' : 'text-fg-dim',
                  )}>{m.goals}</td>
                  <td className={cn(
                    'px-2 py-2 text-right tabular-nums',
                    m.assists > 0 ? 'text-ol-red-bright font-bold' : 'text-fg-dim',
                  )}>{m.assists}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-fg-muted">
                    {m.shots}{m.shotsOnTarget > 0 ? ` (${m.shotsOnTarget})` : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Tiny footer with team logo for visual continuity */}
      <div className="flex items-center justify-center pt-4 pb-2 opacity-50">
        <TeamLogo teamId={523} name="Olympique Lyonnais" size={28} />
      </div>
    </div>
  );
}
