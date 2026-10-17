import { Link } from '@tanstack/react-router';
import { isOlTeamName } from '@/lib/ol-name';
import { TeamLogo } from './team-logo';
import type { CupMatch } from '@/types/api';
import { cn } from '@/lib/utils';
import { teamShortName } from '@/lib/team-queries';
import { cupResult } from '@/lib/cup-result';
import { kickoffTime } from '@/lib/kickoff';
import { matchupId, seasonTeamLogoUrl } from '@/lib/calendar';

const WEEKDAY = ['Dim.', 'Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.'];

function formatDate(iso: string): { day: string; time: string } {
  const d = new Date(iso);
  const day = `${WEEKDAY[d.getDay()]} ${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
  return { day, time: kickoffTime({ date: iso }) ?? '' };
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
  else if (outcome?.result === 'L') resultBadge = { label: 'D', cls: 'bg-loss-fg text-bg' };

  const homeName = displayName(match.homeTeam, homeIsOL);
  const awayName = displayName(match.awayTeam, awayIsOL);
  // Tirs au but : la teinte seule ne dit pas l'issue (WCAG 1.4.1), le nom du lien la dit (comme /fixtures).
  const qualified = shootout ? (olAhead ? 'Olympique Lyonnais' : homeIsOL ? awayName : homeName) : null;
  // WCAG 2.5.3 : le lien enveloppe le libellé de la phase, son nom accessible (aria-label) la reprend en tête, comme /fixtures (prefix).
  const linkName =
    `${match.stage}, ` +
    (hasScore
      ? `${homeName} ${match.homeScore}, ${awayName} ${match.awayScore}`
      : `${homeName} contre ${awayName}`) +
    (qualified ? `, ${qualified} qualifié aux tirs au but` : '') +
    ' — détail du match';

  return (
    <div
      className={cn(
        'relative rounded-md border border-border bg-surface overflow-hidden hover:border-border-strong transition-colors',
        isLive && 'border-l-[3px] border-l-live',
      )}
    >
      <div className="flex items-center gap-3 px-4 py-2 border-b border-border bg-surface-2/40">
        {/* Lien étiré sur toute la carte par un pseudo-élément (z-10) : le contenu reste lu hors du lien ; la pastille et « t.a.b. » (z-20) passent au-dessus pour garder leur infobulle. */}
        <Link
          to="/match/$gameId"
          params={{ gameId: String(match.id) }}
          search={{ matchupId: matchupId(match) }}
          aria-label={linkName}
          className="text-[11px] uppercase tracking-wider font-semibold text-fg-muted after:absolute after:inset-0 after:z-10 after:content-[''] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ol-red-bright"
        >
          {match.stage}
        </Link>
        {resultBadge && (
          <span
            className={cn(
              'relative z-20 inline-flex items-center justify-center w-5 h-5 text-[11px] font-bold rounded-sm',
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
              <abbr title={olAhead ? 'Qualifié aux tirs au but' : 'Éliminé aux tirs au but'} className="relative z-20 no-underline">
                <span aria-hidden="true">t.a.b.</span>
                <span className="sr-only">tirs au but</span>
              </abbr>
            </>
          )}
        </span>
      </div>

      <div className="px-4 py-3 space-y-2">
        <TeamLine
          name={homeName}
          teamId={match.homeTeamId}
          score={match.homeScore}
          won={homeWon}
          isOL={homeIsOL}
          hasScore={hasScore}
        />
        <TeamLine
          name={awayName}
          teamId={match.awayTeamId}
          score={match.awayScore}
          won={awayWon}
          isOL={awayIsOL}
          hasScore={hasScore}
        />
      </div>
    </div>
  );
}

/** Nom affiché d'un camp : « Olympique Lyonnais » pour l'OL, sinon le nom court. */
function displayName(name: string, isOL: boolean): string {
  return isOL ? 'Olympique Lyonnais' : teamShortName(name);
}

interface TeamLineProps {
  name: string;
  teamId: number;
  score: number | null;
  won: boolean;
  isOL: boolean;
  hasScore: boolean;
}

// Le perdant n'est plus atténué par `opacity` (3,02:1 sur son score) : ses textes passent en fg-muted (≥ 4,5:1).
function TeamLine({ name: display, teamId, score, won, isOL, hasScore }: TeamLineProps) {
  const lost = hasScore && !won;
  return (
    <div className="flex items-center gap-3">
      <TeamLogo teamId={teamId} name={display} size={20} src={seasonTeamLogoUrl(teamId)} />
      <span
        className={cn(
          'flex-1 truncate text-sm',
          isOL ? 'font-semibold text-fg-bright' : lost ? 'text-fg-muted' : 'text-fg',
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
