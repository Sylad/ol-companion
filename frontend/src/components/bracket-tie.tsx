import type { BracketMatch as BracketMatchType } from '@/types/api';
import { cn } from '@/lib/utils';

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

interface Props {
  /** Two legs of a knockout tie, in any order — sorted by date internally. */
  matches: [BracketMatchType, BracketMatchType];
}

interface TeamLine {
  name: string;
  id: number;
  leg1: number | null;
  leg2: number | null;
  aggregate: number;
}

export function BracketTie({ matches }: Props) {
  const [leg1, leg2] = [...matches].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );

  const teamA: TeamLine = {
    name: leg1.homeTeam,
    id: leg1.homeTeamId,
    leg1: leg1.homeScore,
    leg2: leg2.awayTeamId === leg1.homeTeamId ? leg2.awayScore : leg2.homeScore,
    aggregate: 0,
  };
  const teamB: TeamLine = {
    name: leg1.awayTeam,
    id: leg1.awayTeamId,
    leg1: leg1.awayScore,
    leg2: leg2.homeTeamId === leg1.awayTeamId ? leg2.homeScore : leg2.awayScore,
    aggregate: 0,
  };
  teamA.aggregate = (teamA.leg1 ?? 0) + (teamA.leg2 ?? 0);
  teamB.aggregate = (teamB.leg1 ?? 0) + (teamB.leg2 ?? 0);

  const bothLegsPlayed = leg2.status === 'FINISHED';
  const aWon = bothLegsPlayed && teamA.aggregate > teamB.aggregate;
  const bWon = bothLegsPlayed && teamB.aggregate > teamA.aggregate;

  const hasOL = leg1.hasOL;

  return (
    <div
      className={cn(
        'rounded-md border bg-surface p-2 text-sm',
        hasOL ? 'border-ol-red bg-ol-red/10' : 'border-border',
      )}
    >
      {/* Header: leg dates as column titles */}
      <div className="grid grid-cols-[1fr_auto_auto] gap-x-2 text-[9px] uppercase tracking-wider text-fg-dim mb-1">
        <span />
        <span className="text-center w-6">A</span>
        <span className="text-center w-6">R</span>
      </div>

      <TeamRow team={teamA} won={aWon} dim={bWon} highlight={hasOL && teamA.id === 465} />
      <TeamRow team={teamB} won={bWon} dim={aWon} highlight={hasOL && teamB.id === 465} />

      {/* Leg dates / status footer */}
      <div className="flex justify-between text-[10px] uppercase tracking-wider text-fg-dim mt-1.5">
        <span>{formatShortDate(leg1.date)}</span>
        <span>{leg2.status === 'SCHEDULED' ? `Retour ${formatShortDate(leg2.date)}` : formatShortDate(leg2.date)}</span>
      </div>
    </div>
  );
}

function TeamRow({
  team,
  won,
  dim,
  highlight,
}: {
  team: TeamLine;
  won: boolean;
  dim: boolean;
  highlight: boolean;
}) {
  return (
    <div
      className={cn(
        'grid grid-cols-[1fr_auto_auto] gap-x-2 items-center leading-tight py-0.5',
        won && 'text-fg-bright font-semibold',
        dim && 'text-fg-dim',
        highlight && 'font-semibold',
      )}
    >
      <span className="truncate">{team.name || '—'}</span>
      <span className="num tabular-nums text-center w-6">{team.leg1 ?? ''}</span>
      <span className="num tabular-nums text-center w-6">{team.leg2 ?? ''}</span>
    </div>
  );
}
