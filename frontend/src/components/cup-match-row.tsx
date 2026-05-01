import { TeamLogo } from './team-logo';
import { OL_TEAM_ID, type CupMatch } from '@/types/api';
import { cn } from '@/lib/utils';
import { teamShortName } from '@/lib/team-queries';

const WEEKDAY = ['Dim.', 'Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.'];

function formatDate(iso: string): { day: string; time: string } {
  const d = new Date(iso);
  const day = `${WEEKDAY[d.getDay()]} ${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
  const time = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  return { day, time };
}

function teamIdForLogo(teamName: string, teamId: number): number {
  if (teamName.toLowerCase() === 'lyon') return OL_TEAM_ID;
  return teamId;
}

export function CupMatchRow({ match }: { match: CupMatch }) {
  const { day, time } = formatDate(match.date);
  const isFinished = match.status === 'FINISHED';
  const isLive = match.status === 'IN_PLAY';
  const hasScore = match.homeScore !== null && match.awayScore !== null;

  const homeWon = hasScore && match.homeScore! > match.awayScore!;
  const awayWon = hasScore && match.awayScore! > match.homeScore!;

  const homeIsOL = match.homeTeam.toLowerCase() === 'lyon';
  const awayIsOL = match.awayTeam.toLowerCase() === 'lyon';

  const olWon = (homeIsOL && homeWon) || (awayIsOL && awayWon);
  const olLost = isFinished && !olWon && hasScore && match.homeScore !== match.awayScore;
  const olDrew = isFinished && hasScore && match.homeScore === match.awayScore;

  let resultBadge: { label: string; cls: string } | null = null;
  if (olWon) resultBadge = { label: 'V', cls: 'bg-win text-bg' };
  else if (olDrew) resultBadge = { label: 'N', cls: 'bg-draw text-bg' };
  else if (olLost) resultBadge = { label: 'D', cls: 'bg-loss text-bg' };

  return (
    <div
      className={cn(
        'rounded-md border border-border bg-surface overflow-hidden hover:border-border-strong transition-colors',
        isLive && 'border-l-[3px] border-l-live',
      )}
    >
      <div className="flex items-center gap-3 px-4 py-2 border-b border-border bg-surface-2/40">
        <span className="text-[11px] uppercase tracking-wider font-semibold text-fg-muted">
          {match.stage}
        </span>
        {resultBadge && (
          <span
            className={cn(
              'inline-flex items-center justify-center w-5 h-5 text-[11px] font-bold rounded-sm',
              resultBadge.cls,
            )}
            aria-label={resultBadge.label === 'V' ? 'Victoire' : resultBadge.label === 'N' ? 'Match nul' : 'Défaite'}
          >
            {resultBadge.label}
          </span>
        )}
        <span className="ml-auto text-[11px] text-fg-dim">
          {day} · {isFinished ? 'Terminé' : isLive ? 'LIVE' : time}
        </span>
      </div>

      <div className="px-4 py-3 space-y-2">
        <TeamLine
          name={match.homeTeam}
          teamId={teamIdForLogo(match.homeTeam, match.homeTeamId)}
          score={match.homeScore}
          won={homeWon}
          isOL={homeIsOL}
          hasScore={hasScore}
        />
        <TeamLine
          name={match.awayTeam}
          teamId={teamIdForLogo(match.awayTeam, match.awayTeamId)}
          score={match.awayScore}
          won={awayWon}
          isOL={awayIsOL}
          hasScore={hasScore}
        />
      </div>
    </div>
  );
}

interface TeamLineProps {
  name: string;
  teamId: number;
  score: number | null;
  won: boolean;
  isOL: boolean;
  hasScore: boolean;
}

function TeamLine({ name, teamId, score, won, isOL, hasScore }: TeamLineProps) {
  const display = isOL ? 'Olympique Lyonnais' : teamShortName(name);
  return (
    <div
      className={cn(
        'flex items-center gap-3',
        hasScore && !won && 'opacity-55',
      )}
    >
      <TeamLogo teamId={teamId} name={display} size={20} />
      <span
        className={cn(
          'flex-1 truncate text-sm',
          isOL ? 'font-semibold text-fg-bright' : 'text-fg',
        )}
      >
        {display}
      </span>
      {hasScore && (
        <span
          className={cn(
            'num text-base font-bold w-6 text-right',
            won ? 'text-fg-bright' : 'text-fg-muted',
          )}
        >
          {score}
        </span>
      )}
    </div>
  );
}
