import { useMemo } from 'react';
import { CalendarDays, MapPin } from 'lucide-react';
import { useFixtures } from '@/hooks/use-fixtures';
import { useWikiImage } from '@/hooks/use-wiki-image';
import { TeamLogo } from './team-logo';
import { OL_TEAM_ID, type Fixture } from '@/types/api';
import { cn } from '@/lib/utils';
import { teamShortName } from '@/lib/team-queries';

const WEEKDAY_LONG = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MONTH = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

function formatLong(iso: string): string {
  const d = new Date(iso);
  return `${WEEKDAY_LONG[d.getDay()]} ${d.getDate()} ${MONTH[d.getMonth()]} · ${d.getHours().toString().padStart(2, '0')}h${d.getMinutes().toString().padStart(2, '0')}`;
}

function countdown(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff < 0) return 'En cours';
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  if (days > 1) return `dans ${days} jours`;
  if (days === 1) return `dans 1 jour`;
  if (hours >= 2) return `dans ${hours}h`;
  const minutes = Math.floor(diff / 60000);
  return `dans ${minutes} min`;
}

export function DashboardHero() {
  const { data: fixtures } = useFixtures();
  const { data: stadiumImg } = useWikiImage('Groupama Stadium');

  const nextMatch = useMemo<Fixture | null>(() => {
    if (!fixtures) return null;
    const upcoming = fixtures.filter(
      (f) => f.status === 'SCHEDULED' || f.status === 'TIMED' || f.status === 'IN_PLAY',
    );
    if (upcoming.length === 0) return null;
    return upcoming.reduce((earliest, f) =>
      new Date(f.date).getTime() < new Date(earliest.date).getTime() ? f : earliest,
    );
  }, [fixtures]);

  if (!nextMatch) {
    return (
      <section className="rounded-md bg-surface border border-border p-8 text-center text-fg-muted">
        Aucun match programmé.
      </section>
    );
  }

  const olIsHome = nextMatch.homeTeamId === OL_TEAM_ID;
  const opponent = olIsHome
    ? { id: nextMatch.awayTeamId, name: nextMatch.awayTeam }
    : { id: nextMatch.homeTeamId, name: nextMatch.homeTeam };
  const isLive = nextMatch.status === 'IN_PLAY';

  return (
    <section className="relative overflow-hidden rounded-md border border-border bg-surface min-h-[260px]">
      {stadiumImg?.imageUrl && (
        <div
          className="absolute inset-0 bg-cover bg-center opacity-30"
          style={{ backgroundImage: `url(${stadiumImg.imageUrl})` }}
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-r from-bg via-bg/85 to-bg/40" />
      <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/60 to-transparent" />

      <div className="relative z-10 p-6 lg:p-8 grid lg:grid-cols-[1.4fr_auto] gap-6 items-center">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span className={cn(
              'eyebrow',
              isLive ? 'text-live animate-pulse-live px-2 py-0.5 rounded-sm bg-live/10' : 'text-ol-red-bright'
            )}>
              {isLive ? 'Live' : 'Prochain match'}
            </span>
            <span className="text-xs text-fg-dim">· {nextMatch.competition}{nextMatch.matchday ? ` · J${nextMatch.matchday}` : ''}</span>
          </div>

          <div className="flex items-center gap-4 lg:gap-6">
            <TeamSlot
              isOL={olIsHome}
              teamId={olIsHome ? OL_TEAM_ID : opponent.id}
              name={olIsHome ? 'Olympique Lyonnais' : teamShortName(nextMatch.homeTeam)}
            />
            <div className="text-center px-2">
              <div className="font-display text-3xl lg:text-display-md font-bold text-fg-bright leading-none">
                {isLive
                  ? `${nextMatch.homeScore ?? '-'} : ${nextMatch.awayScore ?? '-'}`
                  : 'VS'}
              </div>
              <div className="text-[11px] uppercase tracking-wider text-fg-dim mt-2 font-semibold">
                {isLive ? 'En cours' : countdown(nextMatch.date)}
              </div>
            </div>
            <TeamSlot
              isOL={!olIsHome}
              teamId={!olIsHome ? OL_TEAM_ID : opponent.id}
              name={!olIsHome ? 'Olympique Lyonnais' : teamShortName(nextMatch.awayTeam)}
            />
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-fg-muted">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5" strokeWidth={2} />
              {formatLong(nextMatch.date)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" strokeWidth={2} />
              {olIsHome ? 'Groupama Stadium · Décines-Charpieu' : `Stade ${teamShortName(nextMatch.homeTeam)}`}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

interface TeamSlotProps {
  teamId: number;
  name: string;
  isOL: boolean;
}

function TeamSlot({ teamId, name, isOL }: TeamSlotProps) {
  return (
    <div className="flex flex-col items-center text-center min-w-0 flex-1">
      <TeamLogo teamId={teamId} name={name} size={56} className="mb-2" />
      <div
        className={cn(
          'text-xs lg:text-sm font-semibold leading-tight max-w-[140px] truncate',
          isOL ? 'text-fg-bright' : 'text-fg',
        )}
        title={name}
      >
        {name}
      </div>
    </div>
  );
}
