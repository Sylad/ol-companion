import type { BracketMatch as BracketMatchType } from '@/types/api';
import { cn } from '@/lib/utils';

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

interface Props { match: BracketMatchType }

export function BracketMatch({ match }: Props) {
  const { homeTeam, awayTeam, homeScore, awayScore, status, hasOL } = match;
  const isFinished = status === 'FINISHED';
  const homeWon = isFinished && homeScore !== null && awayScore !== null && homeScore > awayScore;
  const awayWon = isFinished && homeScore !== null && awayScore !== null && awayScore > homeScore;

  return (
    <div
      className={cn(
        'rounded-md border bg-surface p-2 text-sm',
        hasOL ? 'border-ol-red bg-ol-red/10' : 'border-border',
      )}
    >
      <Row name={homeTeam} score={homeScore} won={homeWon} dim={isFinished && !homeWon} highlight={hasOL && homeTeam.toLowerCase() === 'lyon'} />
      <Row name={awayTeam} score={awayScore} won={awayWon} dim={isFinished && !awayWon} highlight={hasOL && awayTeam.toLowerCase() === 'lyon'} />
      {!isFinished && (
        <div className="text-[10px] uppercase tracking-wider text-fg-dim mt-1">
          {formatShortDate(match.date)}
        </div>
      )}
    </div>
  );
}

function Row({ name, score, won, dim, highlight }: { name: string; score: number | null; won: boolean; dim: boolean; highlight: boolean }) {
  return (
    <div className={cn(
      'flex items-center justify-between gap-2 leading-tight py-0.5',
      won && 'text-fg-bright font-semibold',
      dim && 'text-fg-dim',
      highlight && 'font-semibold',
    )}>
      <span className="truncate">{name || '—'}</span>
      <span className="num tabular-nums">{score ?? ''}</span>
    </div>
  );
}
