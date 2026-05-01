import { useMemo } from 'react';
import { useFixtures } from '@/hooks/use-fixtures';
import { OL_TEAM_ID, type Fixture } from '@/types/api';
import { TeamLogo } from './team-logo';
import { teamShortName } from '@/lib/team-queries';
import { cn } from '@/lib/utils';

const WEEKDAY = ['Dim.', 'Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.'];

export function LastResult() {
  const { data: fixtures } = useFixtures();

  const lastFinished = useMemo<Fixture | null>(() => {
    if (!fixtures) return null;
    const finished = fixtures.filter((f) => f.status === 'FINISHED');
    if (finished.length === 0) return null;
    return finished.reduce((latest, f) =>
      new Date(f.date).getTime() > new Date(latest.date).getTime() ? f : latest,
    );
  }, [fixtures]);

  if (!lastFinished) return null;

  const olIsHome = lastFinished.homeTeamId === OL_TEAM_ID;
  const olScore = olIsHome ? lastFinished.homeScore! : lastFinished.awayScore!;
  const oppScore = olIsHome ? lastFinished.awayScore! : lastFinished.homeScore!;
  const opponentName = olIsHome ? lastFinished.awayTeam : lastFinished.homeTeam;
  const opponentId = olIsHome ? lastFinished.awayTeamId : lastFinished.homeTeamId;

  const won = olScore > oppScore;
  const lost = olScore < oppScore;
  const draw = olScore === oppScore;

  let resultLabel = 'Match nul';
  let resultTone = 'text-draw bg-draw/10 border-draw/40';
  if (won) {
    resultLabel = 'Victoire';
    resultTone = 'text-win bg-win/10 border-win/40';
  } else if (lost) {
    resultLabel = 'Défaite';
    resultTone = 'text-loss bg-loss/10 border-loss/40';
  }

  const d = new Date(lastFinished.date);
  const dateLabel = `${WEEKDAY[d.getDay()]} ${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;

  return (
    <section className="rounded-md bg-surface border border-border overflow-hidden">
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
              <TeamLogo teamId={OL_TEAM_ID} name="Olympique Lyonnais" size={28} />
            </>
          ) : (
            <>
              <span className={cn('truncate font-medium', !won && draw === false && 'opacity-60')}>
                {teamShortName(opponentName)}
              </span>
              <TeamLogo teamId={opponentId} name={opponentName} size={28} />
            </>
          )}
        </div>
        <div className="font-mono tabular-nums text-3xl font-bold text-fg-bright text-center px-3">
          {lastFinished.homeScore} <span className="text-fg-dim">·</span> {lastFinished.awayScore}
        </div>
        <div className="flex items-center gap-3">
          {olIsHome ? (
            <>
              <TeamLogo teamId={opponentId} name={opponentName} size={28} />
              <span className={cn('truncate font-medium', !won && draw === false && 'opacity-60')}>
                {teamShortName(opponentName)}
              </span>
            </>
          ) : (
            <>
              <TeamLogo teamId={OL_TEAM_ID} name="Olympique Lyonnais" size={28} />
              <span className={cn('font-semibold', 'text-fg-bright', !won && draw === false && 'opacity-60')}>
                Olympique Lyonnais
              </span>
            </>
          )}
        </div>
      </div>

      <div className="px-5 py-2.5 bg-surface-2/30 border-t border-border text-xs text-fg-dim flex items-center justify-between">
        <span>{lastFinished.competition}{lastFinished.matchday ? ` · J${lastFinished.matchday}` : ''}</span>
        <span>{dateLabel}</span>
      </div>
    </section>
  );
}
