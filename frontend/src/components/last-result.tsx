import { useMemo } from 'react';
import { useSeasonMatches } from '@/hooks/use-season-matches';
import { OL_TEAM_ID, type SeasonMatch } from '@/types/api';
import { TeamLogo } from './team-logo';
import { teamShortName } from '@/lib/team-queries';
import { RetryMessage } from './retry-message';
import { cn } from '@/lib/utils';
import { seasonTeamLogoUrl } from '@/lib/calendar';

const WEEKDAY = ['Dim.', 'Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.'];

export function LastResult() {
  // Toutes les compétitions suivies (L131), même requête que le bandeau : /api/fixtures n'a que la Ligue 1.
  const { data: fixtures, isPending, isError, refetch } = useSeasonMatches();

  const lastFinished = useMemo<SeasonMatch | null>(() => {
    if (!fixtures) return null;
    const finished = fixtures.filter((f) => f.status === 'FINISHED');
    if (finished.length === 0) return null;
    return finished.reduce((latest, f) =>
      new Date(f.date).getTime() > new Date(latest.date).getTime() ? f : latest,
    );
  }, [fixtures]);

  if (!fixtures && isPending) {
    return (
      <section
        data-testid="squelette-dernier-resultat"
        role="status"
        aria-busy="true"
        className="rounded-md bg-surface border border-border h-[263px] lg:h-[189px] animate-pulse"
      >
        <span className="sr-only">Chargement…</span>
      </section>
    );
  }
  if (!fixtures && isError) {
    return (
      <section className="rounded-md bg-surface border border-border p-5">
        <RetryMessage
          message="Impossible de charger le dernier résultat."
          onRetry={() => void refetch()}
          messageTestId="message-erreur-dernier-resultat"
          buttonTestId="bouton-reessayer-dernier-resultat"
        />
      </section>
    );
  }

  if (!lastFinished) return null;

  const olIsHome = lastFinished.homeTeamId === OL_TEAM_ID;
  const olScore = olIsHome ? lastFinished.homeScore : lastFinished.awayScore;
  const oppScore = olIsHome ? lastFinished.awayScore : lastFinished.homeScore;
  // Un FINISHED sans scores (match arrêté, trou API) rendait « Match nul »
  // sur un score vide. Review 2026-08-14.
  if (olScore === null || oppScore === null) return null;
  const opponentName = olIsHome ? lastFinished.awayTeam : lastFinished.homeTeam;
  const opponentId = olIsHome ? lastFinished.awayTeamId : lastFinished.homeTeamId;

  const won = olScore > oppScore;
  const lost = olScore < oppScore;
  const draw = olScore === oppScore;
  // L135 : le score ne compte pas les tirs au but — un nul de coupe avec un qualifié désigné n'est pas un nul.
  const shootout = draw && lastFinished.shootoutWinnerId != null;
  const shootoutWon = shootout && lastFinished.shootoutWinnerId === OL_TEAM_ID;

  let resultLabel = 'Match nul';
  let resultTone = 'text-draw bg-draw/10 border-draw/40';
  if (shootout) {
    resultLabel = shootoutWon ? 'Victoire aux tirs au but' : 'Défaite aux tirs au but';
    resultTone = shootoutWon ? 'text-win bg-win/10 border-win/40' : 'text-loss bg-loss/10 border-loss/40';
  } else if (won) {
    resultLabel = 'Victoire';
    resultTone = 'text-win bg-win/10 border-win/40';
  } else if (lost) {
    resultLabel = 'Défaite';
    resultTone = 'text-loss bg-loss/10 border-loss/40';
  }

  const d = new Date(lastFinished.date);
  const dateLabel = `${WEEKDAY[d.getDay()]} ${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;

  return (
    <section data-testid="dernier-resultat" className="rounded-md bg-surface border border-border overflow-hidden">
      <header className="px-5 py-4 flex items-center justify-between border-b border-border">
        <div>
          <div className="eyebrow mb-1">Dernier résultat</div>
          <h2 className="font-display text-xl font-bold text-fg-bright leading-none">
            {olIsHome ? 'À domicile' : "À l'extérieur"}
          </h2>
        </div>
        <span className={cn('text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-sm border', resultTone)}>
          {resultLabel}
        </span>
      </header>

      <div className="p-5 grid sm:grid-cols-[1fr_auto_1fr] gap-4 items-center">
        <div className="flex items-center gap-3 sm:justify-end">
          {olIsHome ? (
            <>
              <span className={cn('font-semibold', 'text-fg-bright', !won && draw === false && 'opacity-60')}>
                Olympique Lyonnais
              </span>
              <TeamLogo teamId={OL_TEAM_ID} name="Olympique Lyonnais" size={28} src={seasonTeamLogoUrl(OL_TEAM_ID)} />
            </>
          ) : (
            <>
              <span className={cn('truncate font-medium', !won && draw === false && 'opacity-60')}>
                {teamShortName(opponentName)}
              </span>
              <TeamLogo teamId={opponentId} name={opponentName} size={28} src={seasonTeamLogoUrl(opponentId)} />
            </>
          )}
        </div>
        <div className="text-center px-3">
          <div className="font-mono tabular-nums text-3xl font-bold text-fg-bright">
            {lastFinished.homeScore} <span className="text-fg-dim">·</span> {lastFinished.awayScore}
          </div>
          {shootout && (
            <div className="mt-1 text-xs text-fg-dim">
              {shootoutWon ? 'Qualifié aux tirs au but' : 'Éliminé aux tirs au but'}
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          {olIsHome ? (
            <>
              <TeamLogo teamId={opponentId} name={opponentName} size={28} src={seasonTeamLogoUrl(opponentId)} />
              <span className={cn('truncate font-medium', !won && draw === false && 'opacity-60')}>
                {teamShortName(opponentName)}
              </span>
            </>
          ) : (
            <>
              <TeamLogo teamId={OL_TEAM_ID} name="Olympique Lyonnais" size={28} src={seasonTeamLogoUrl(OL_TEAM_ID)} />
              <span className={cn('font-semibold', 'text-fg-bright', !won && draw === false && 'opacity-60')}>
                Olympique Lyonnais
              </span>
            </>
          )}
        </div>
      </div>

      {/* L134 : la date ne se coupe jamais — c'est le tour (long) qui passe à la ligne. */}
      <footer className="px-5 py-2.5 bg-surface-2/30 border-t border-border text-xs text-fg-dim flex items-center justify-between gap-3">
        <span className="min-w-0">{lastFinished.competition}{lastFinished.matchday ? ` · J${lastFinished.matchday}` : lastFinished.round ? ` · ${lastFinished.round}` : ''}</span>
        <span className="shrink-0 whitespace-nowrap">{dateLabel}</span>
      </footer>
    </section>
  );
}
