import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from 'recharts';
import { Calendar, Goal, Shield, BarChart3, Loader2 } from 'lucide-react';
import { useTeamSeasonStats } from '@/hooks/use-team-season-stats';
import type { TeamSeasonChartPoint, PerCompetitionTeamStats } from '@/types/api';
import { cn } from '@/lib/utils';

const COMP_LABEL: Record<PerCompetitionTeamStats['competitionCode'], string> = {
  L1: 'Ligue 1',
  CDF: 'Coupe de France',
  UEL: 'Europa League',
  OTHER: 'Autres',
};

// Cumulative goal-difference sparkline → bleu OL (trajectoire neutre, pas
// "victoire" → pas de vert). Le dot du dernier point est rouge OL bright,
// alignement strict avec les règles palette.
const TRAJECTORY_COLOR = '#3b5dc9';
const TRAJECTORY_FILL = 'rgba(59, 93, 201, 0.18)';
const GRID_COLOR = 'hsl(var(--border))';
const AXIS_COLOR = 'hsl(var(--fg-dim))';

function formatChartLabel(date: string): string {
  const d = new Date(date);
  return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1)
    .toString()
    .padStart(2, '0')}`;
}

function ChartTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload as TeamSeasonChartPoint;
  const sign = p.goalDifference >= 0 ? '+' : '';
  return (
    <div className="rounded-md border border-border-strong bg-surface-2 px-3 py-2 text-xs shadow-lg">
      <div className="text-fg-dim mb-1">
        Match {p.matchIndex} · {formatChartLabel(p.date)}
      </div>
      <div className="text-fg-bright font-semibold num">
        Diff. cumul : <span className={cn(p.goalDifference >= 0 ? 'text-win' : 'text-loss')}>{sign}{p.goalDifference}</span>
      </div>
      {p.points !== null && (
        <div className="text-fg-muted num">{p.points} pts L1</div>
      )}
      <div className="text-fg-dim mt-0.5">
        {COMP_LABEL[p.competitionCode]} ·{' '}
        <span className={
          p.result === 'W' ? 'text-win' :
          p.result === 'L' ? 'text-loss' : 'text-fg-dim'
        }>
          {p.result === 'W' ? 'Victoire' : p.result === 'L' ? 'Défaite' : 'Match nul'}
        </span>
      </div>
    </div>
  );
}

export function SeasonSummary() {
  const { data, isLoading, isError } = useTeamSeasonStats();

  return (
    <section className="rounded-md bg-surface border border-border overflow-hidden">
      <header className="px-5 py-4 flex items-center justify-between border-b border-border">
        <div>
          <div className="eyebrow mb-1">Toutes compétitions</div>
          <h2 className="font-display text-xl font-bold text-fg-bright leading-none">
            OL en chiffres — saison en cours
          </h2>
        </div>
        <BarChart3 className="h-4 w-4 text-fg-dim" />
      </header>

      <div className="p-5 space-y-5">
        {isLoading && (
          <div className="flex items-center justify-center py-12 text-fg-dim">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            <span>Calcul des stats saison…</span>
          </div>
        )}
        {isError && (
          <p className="py-8 text-center text-loss">Erreur de chargement.</p>
        )}
        {data && data.played === 0 && (
          <p className="py-8 text-center text-fg-muted">Aucun match joué cette saison.</p>
        )}
        {data && data.played > 0 && <SummaryBody data={data} />}
      </div>
    </section>
  );
}

function SummaryBody({ data }: { data: NonNullable<ReturnType<typeof useTeamSeasonStats>['data']> }) {
  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Tile
          icon={Calendar}
          label="Matchs joués"
          value={data.played.toString()}
          sub={`${data.won}V · ${data.draw}N · ${data.lost}D`}
        />
        <Tile
          icon={Goal}
          label="Buts marqués"
          value={data.goalsFor.toString()}
          sub={`${data.goalsForPerMatch.toFixed(2)} / match`}
          valueClass="text-fg-bright"
        />
        <Tile
          icon={Shield}
          label="Buts encaissés"
          value={data.goalsAgainst.toString()}
          sub={`${data.goalsAgainstPerMatch.toFixed(2)} / match`}
          valueClass="text-fg-bright"
        />
        <Tile
          icon={Shield}
          label="Clean sheets"
          value={data.cleanSheets.toString()}
          sub={`${data.cleanSheetRate.toFixed(0)}% des matchs`}
          // Clean sheet pourcentage = sémantique "défense réussie" → vert acceptable
          // côté valeur seulement (pas de teinte décorative)
          valueClass="text-win"
        />
      </div>

      <div className="rounded-md border border-border bg-surface-2/40 p-3 lg:p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="eyebrow">Évolution diff. de buts cumulée</span>
          <span className="text-xs text-fg-dim num">
            Diff. : <span className={cn(data.goalDifference >= 0 ? 'text-win' : 'text-loss', 'font-semibold')}>
              {data.goalDifference >= 0 ? '+' : ''}{data.goalDifference}
            </span>
          </span>
        </div>
        <div className="h-[160px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data.chart} margin={{ top: 8, right: 8, left: -12, bottom: 4 }}>
              <defs>
                <linearGradient id="gd-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={TRAJECTORY_COLOR} stopOpacity={0.4} />
                  <stop offset="100%" stopColor={TRAJECTORY_COLOR} stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={GRID_COLOR} strokeDasharray="3 4" vertical={false} />
              <XAxis
                dataKey="matchIndex"
                stroke={AXIS_COLOR}
                tick={{ fill: AXIS_COLOR, fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                interval={data.chart.length > 20 ? Math.floor(data.chart.length / 8) : 1}
              />
              <YAxis
                stroke={AXIS_COLOR}
                tick={{ fill: AXIS_COLOR, fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                width={28}
              />
              <Tooltip content={<ChartTooltip />} cursor={{ stroke: GRID_COLOR, strokeDasharray: '3 4' }} />
              <Area
                type="monotone"
                dataKey="goalDifference"
                stroke={TRAJECTORY_COLOR}
                strokeWidth={2.25}
                fill={TRAJECTORY_FILL}
                fillOpacity={1}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {data.perCompetition.map((c) => (
          <CompChip key={c.competitionCode} c={c} />
        ))}
      </div>
    </>
  );
}

interface TileProps {
  icon: typeof Calendar;
  label: string;
  value: string;
  sub: string;
  valueClass?: string;
}

function Tile({ icon: Icon, label, value, sub, valueClass }: TileProps) {
  return (
    <div className="rounded-md bg-surface-2/40 border border-border p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="eyebrow">{label}</span>
        <Icon className="h-4 w-4 text-fg-dim" strokeWidth={1.75} />
      </div>
      <div
        className={cn(
          'font-mono tabular-nums text-2xl lg:text-3xl font-bold text-fg-bright leading-none',
          valueClass,
        )}
      >
        {value}
      </div>
      <div className="text-xs text-fg-dim mt-1.5">{sub}</div>
    </div>
  );
}

function CompChip({ c }: { c: PerCompetitionTeamStats }) {
  const label = COMP_LABEL[c.competitionCode];
  return (
    <div
      className="inline-flex items-center gap-2 rounded-md border border-border bg-surface-2/40 px-3 py-1.5 text-xs"
      title={`${c.played} matchs · ${c.won}V · ${c.draw}N · ${c.lost}D · ${c.goalsFor}-${c.goalsAgainst}${c.competitionCode === 'L1' ? ` · ${c.points} pts` : ''}`}
    >
      <span className="font-semibold text-fg-bright">{label}</span>
      <span className="text-fg-muted num">
        {c.played} <span className="text-fg-dim">match{c.played > 1 ? 's' : ''}</span>
      </span>
      <span className="text-fg-dim">·</span>
      <span className="num">
        <span className="text-win">{c.won}V</span>
        <span className="text-fg-dim">·</span>
        <span className="text-fg-muted">{c.draw}N</span>
        <span className="text-fg-dim">·</span>
        <span className="text-loss">{c.lost}D</span>
      </span>
      {c.competitionCode === 'L1' && (
        <>
          <span className="text-fg-dim">·</span>
          <span className="text-fg-bright font-semibold num">{c.points} pts</span>
        </>
      )}
    </div>
  );
}
