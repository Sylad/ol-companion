import { isOlTeamName } from '@/lib/ol-name';
import { TeamLogo } from './team-logo';
import { OL_TEAM_ID, type CupMatch } from '@/types/api';
import { cn } from '@/lib/utils';
import { teamShortName } from '@/lib/team-queries';
import { cupResult } from '@/lib/cup-result';
import { kickoffTime } from '@/lib/kickoff';

const WEEKDAY = ['Dim.', 'Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.'];

function formatDate(iso: string): { day: string; time: string } {
  const d = new Date(iso);
  const day = `${WEEKDAY[d.getDay()]} ${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
  return { day, time: kickoffTime({ date: iso }) ?? '' };
}

function teamIdForLogo(teamName: string, teamId: number): number {
  if (teamName.toLowerCase() === 'lyon') return OL_TEAM_ID;
  return teamId;
}

export function CupMatchRow({ match, tie }: { match: CupMatch; tie?: CupMatch[] }) {
  const { day, time } = formatDate(match.date);
  const isFinished = match.status === 'FINISHED';
  const isLive = match.status === 'IN_PLAY';
  const hasScore = match.homeScore !== null && match.awayScore !== null;

  const homeIsOL = isOlTeamName(match.homeTeam);
  const awayIsOL = isOlTeamName(match.awayTeam);

  // isFinished : sans lui le badge « Victoire » s'affichait dès la 10e minute
  // d'un match en cours où OL menait. Review 2026-08-14.
  // L140 : un nul décidé aux tirs au but est une victoire ou une défaite (cupResult).
  const outcome = cupResult(match, tie ?? [match]);
  const shootout = outcome?.shootout ?? false;
  // Le qualifié aux tirs au but se met en avant comme un vainqueur.
  const olAhead = outcome?.result === 'W';
  const homeWon = hasScore && (match.homeScore! > match.awayScore! || (shootout && homeIsOL === olAhead));
  const awayWon = hasScore && (match.awayScore! > match.homeScore! || (shootout && awayIsOL === olAhead));

  let resultBadge: { label: string; cls: string } | null = null;
  if (outcome?.result === 'W') resultBadge = { label: 'V', cls: 'bg-win text-bg' };
  else if (outcome?.result === 'D') resultBadge = { label: 'N', cls: 'bg-draw text-bg' };
  else if (outcome?.result === 'L') resultBadge = { label: 'D', cls: 'bg-loss text-bg' };

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
            title={shootout ? (resultBadge.label === 'V' ? 'Qualifié aux tirs au but' : 'Éliminé aux tirs au but') : undefined}
          >
            {resultBadge.label}
          </span>
        )}
        <span className="ml-auto text-[11px] text-fg-dim">
          {day} · {isFinished ? 'Terminé' : isLive ? 'LIVE' : time}
          {shootout && (
            <>
              {' · '}
              <abbr title="Qualifié aux tirs au but" className="no-underline">
                <span aria-hidden="true">t.a.b.</span>
                <span className="sr-only">tirs au but</span>
              </abbr>
            </>
          )}
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
