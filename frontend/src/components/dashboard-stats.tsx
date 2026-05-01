import { TrendingUp, Target, Activity, Award } from 'lucide-react';
import { useStandings } from '@/hooks/use-standings';
import { useSeasonRankings } from '@/hooks/use-season-rankings';
import { OL_TEAM_ID, type FormOutcome } from '@/types/api';
import { cn } from '@/lib/utils';

export function DashboardStats() {
  const { data: standings } = useStandings();
  const { data: rankings } = useSeasonRankings();

  const ol = standings?.table.find((t) => t.teamId === OL_TEAM_ID);
  const positionTrend = useMemoTrend(rankings ?? []);
  const wins = ol?.won ?? 0;
  const points = ol?.points ?? 0;
  const matchday = standings?.currentMatchday ?? 0;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <StatCard
        label="Position"
        value={ol ? `${ol.position}` : '—'}
        suffix={ol?.position === 1 ? 'er' : 'e'}
        sub={`Ligue 1 · J${matchday}`}
        icon={Award}
        trend={positionTrend}
      />
      <StatCard
        label="Points"
        value={`${points}`}
        sub={ol ? `${ol.played} matchs · ${(points / Math.max(1, ol.played)).toFixed(2)} ppm` : ''}
        icon={Target}
      />
      <StatCard
        label="Différence buts"
        value={ol ? `${ol.goalDifference > 0 ? '+' : ''}${ol.goalDifference}` : '—'}
        valueClass={
          ol && ol.goalDifference > 0 ? 'text-win' : ol && ol.goalDifference < 0 ? 'text-loss' : ''
        }
        sub={ol ? `${ol.goalsFor} pour · ${ol.goalsAgainst} contre` : ''}
        icon={Activity}
      />
      <StatCard
        label="Forme"
        value={`${wins}V`}
        sub={ol ? `${ol.draw}N · ${ol.lost}D` : ''}
        icon={TrendingUp}
        formStrip={ol?.recentForm}
      />
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string;
  suffix?: string;
  sub?: string;
  icon: typeof Award;
  valueClass?: string;
  trend?: 'up' | 'down' | 'flat' | null;
  formStrip?: FormOutcome[];
}

function StatCard({ label, value, suffix, sub, icon: Icon, valueClass, trend, formStrip }: StatCardProps) {
  return (
    <div className="rounded-md bg-surface border border-border p-4 lg:p-5">
      <div className="flex items-center justify-between mb-2">
        <span className="eyebrow">{label}</span>
        <Icon className="h-4 w-4 text-fg-dim" strokeWidth={1.75} />
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className={cn('font-mono tabular-nums text-3xl lg:text-4xl font-bold text-fg-bright', valueClass)}>
          {value}
        </span>
        {suffix && (
          <span className="text-base text-fg-muted font-semibold">{suffix}</span>
        )}
        {trend === 'up' && <span className="text-win text-sm font-bold ml-1">↑</span>}
        {trend === 'down' && <span className="text-loss text-sm font-bold ml-1">↓</span>}
      </div>
      {sub && <div className="text-xs text-fg-dim mt-1">{sub}</div>}
      {formStrip && formStrip.length > 0 && (
        <div className="flex items-center gap-1 mt-2.5">
          {[...formStrip].reverse().map((o, i) => (
            <span
              key={i}
              className={cn(
                'inline-flex items-center justify-center w-[14px] h-[14px] rounded-full text-[8px] font-bold leading-none',
                o === 'W' ? 'bg-win text-bg' : o === 'L' ? 'bg-loss text-bg' : 'bg-transparent border border-fg-dim text-fg-dim',
              )}
              title={o === 'W' ? 'Victoire' : o === 'L' ? 'Défaite' : 'Match nul'}
            >
              {o}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function useMemoTrend(rankings: { matchday: number; position: number }[]): 'up' | 'down' | 'flat' | null {
  if (rankings.length < 2) return null;
  const last = rankings[rankings.length - 1];
  const prev = rankings[rankings.length - 2];
  if (last.position < prev.position) return 'up';
  if (last.position > prev.position) return 'down';
  return 'flat';
}
