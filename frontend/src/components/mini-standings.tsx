import { Link } from '@tanstack/react-router';
import type { LiveStandingRow } from '@/types/api';
import { cn } from '@/lib/utils';

/**
 * Classement Ligue 1 en direct, réduit à l'OL et ses voisins. 365scores compte
 * les résultats provisoires des matchs en cours : les lignes « live » bougent
 * pendant le match (point rouge pulsant). Le classement complet reste sur /standings.
 */
export function MiniStandings({ rows }: { rows: LiveStandingRow[] }) {
  if (!rows.length) return null;
  return (
    <section className="rounded-md bg-surface border border-border overflow-hidden">
      <header className="px-5 py-3 border-b border-border flex items-center justify-between">
        <div className="eyebrow">Classement en direct</div>
        <Link to="/standings" className="text-[10px] uppercase tracking-wider text-fg-dim hover:text-fg">
          Ligue 1 →
        </Link>
      </header>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-[10px] uppercase tracking-wider text-fg-dim">
            <th className="px-3 py-1.5 text-right font-medium w-8">#</th>
            <th className="px-2 py-1.5 text-left font-medium">Équipe</th>
            <th className="px-2 py-1.5 text-right font-medium w-8">J</th>
            <th className="px-2 py-1.5 text-right font-medium w-10">Diff</th>
            <th className="px-3 py-1.5 text-right font-medium w-10">Pts</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((r) => (
            <tr key={r.teamId} className={cn(r.isOl && 'bg-ol-red/10')}>
              <td className={cn('px-3 py-1.5 text-right num tabular-nums', r.isOl ? 'text-ol-red-bright font-bold' : 'text-fg-muted')}>
                {r.position}
              </td>
              <td className={cn('px-2 py-1.5 truncate', r.isOl ? 'font-semibold text-fg-bright' : 'text-fg')}>
                <span className="inline-flex items-center gap-1.5">
                  {r.isLive && <span className="h-1.5 w-1.5 rounded-full bg-ol-red animate-pulse" aria-label="joue en ce moment" />}
                  {r.name}
                </span>
              </td>
              <td className="px-2 py-1.5 text-right num tabular-nums text-fg-muted">{r.played}</td>
              <td className={cn('px-2 py-1.5 text-right num tabular-nums', r.goalDifference > 0 ? 'text-win' : r.goalDifference < 0 ? 'text-loss' : 'text-fg-muted')}>
                {r.goalDifference > 0 ? `+${r.goalDifference}` : r.goalDifference}
              </td>
              <td className="px-3 py-1.5 text-right num tabular-nums font-bold text-fg-bright">{r.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
