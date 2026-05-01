import { TeamLogo } from './team-logo';
import { OL_TEAM_ID, type Fixture } from '@/types/api';
import { cn } from '@/lib/utils';
import { teamShortName } from '@/lib/team-queries';

interface MatchCardProps {
  fixture: Fixture;
}

const WEEKDAY = ['Dim.', 'Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.'];

function formatDate(iso: string): { day: string; time: string } {
  const d = new Date(iso);
  const day = `${WEEKDAY[d.getDay()]} ${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
  const time = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  return { day, time };
}

function statusLabel(f: Fixture): string {
  switch (f.status) {
    case 'FINISHED':
      return 'Terminé';
    case 'IN_PLAY':
      return 'En cours';
    case 'POSTPONED':
      return 'Reporté';
    case 'SCHEDULED':
    case 'TIMED':
      return 'Programmé';
    default:
      return f.status;
  }
}

export function MatchCard({ fixture }: MatchCardProps) {
  const { day, time } = formatDate(fixture.date);
  const isFinished = fixture.status === 'FINISHED';
  const isLive = fixture.status === 'IN_PLAY';
  const hasScore = fixture.homeScore !== null && fixture.awayScore !== null;

  const homeWon = hasScore && fixture.homeScore! > fixture.awayScore!;
  const awayWon = hasScore && fixture.awayScore! > fixture.homeScore!;

  const olIsHome = fixture.homeTeamId === OL_TEAM_ID;
  const olIsAway = fixture.awayTeamId === OL_TEAM_ID;

  return (
    <article
      className={cn(
        'rounded-md bg-surface border border-border overflow-hidden hover:border-border-strong transition-colors',
        isLive && 'border-l-[3px] border-l-live',
      )}
    >
      <div className="grid grid-cols-[1fr_auto] divide-x divide-border">
        <div className="flex flex-col">
          <TeamRow
            id={fixture.homeTeamId}
            name={fixture.homeTeam}
            score={fixture.homeScore}
            won={homeWon}
            isOL={olIsHome}
            hasScore={hasScore}
          />
          <div className="border-t border-border" />
          <TeamRow
            id={fixture.awayTeamId}
            name={fixture.awayTeam}
            score={fixture.awayScore}
            won={awayWon}
            isOL={olIsAway}
            hasScore={hasScore}
          />
        </div>
        <div className="flex flex-col items-center justify-center px-5 py-3 min-w-[110px] text-center">
          <div className="text-[11px] font-medium text-fg-muted">{day}</div>
          {isFinished ? (
            <div className="text-[10px] uppercase tracking-wide text-fg-dim mt-0.5">
              {statusLabel(fixture)}
            </div>
          ) : isLive ? (
            <div className="text-[11px] font-semibold text-live mt-0.5 animate-pulse-live">LIVE</div>
          ) : (
            <>
              <div className="text-sm font-semibold num text-fg mt-0.5">{time}</div>
              <div className="text-[10px] uppercase tracking-wide text-fg-dim mt-0.5">
                {statusLabel(fixture)}
              </div>
            </>
          )}
        </div>
      </div>
    </article>
  );
}

interface TeamRowProps {
  id: number;
  name: string;
  score: number | null;
  won: boolean;
  isOL: boolean;
  hasScore: boolean;
}

function TeamRow({ id, name, score, won, isOL, hasScore }: TeamRowProps) {
  const display = teamShortName(name);
  return (
    <div
      className={cn(
        'flex items-center gap-3 px-4 py-2.5',
        hasScore && !won && 'opacity-60',
      )}
    >
      <TeamLogo teamId={id} name={name} size={22} />
      <span
        className={cn(
          'flex-1 truncate text-sm',
          isOL ? 'font-semibold text-fg-bright' : 'text-fg',
        )}
      >
        {display}
      </span>
      {hasScore ? (
        <span
          className={cn(
            'num text-lg font-bold w-7 text-right',
            won ? 'text-fg-bright' : 'text-fg-muted',
          )}
        >
          {score}
        </span>
      ) : null}
      {won && hasScore && (
        <span className="text-fg-dim text-sm leading-none ml-1" aria-label="vainqueur">
          ←
        </span>
      )}
    </div>
  );
}
