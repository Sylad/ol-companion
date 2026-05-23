import { useMemo, useState } from 'react';
import { useFixtures } from '@/hooks/use-fixtures';
import { KnowledgeHeader } from '@/components/knowledge-header';
import { TeamLogo } from '@/components/team-logo';
import { CalendarDays, Loader2, Trophy } from 'lucide-react';
import type { Fixture } from '@/types/api';
import { OL_TEAM_ID } from '@/types/api';
import { cn } from '@/lib/utils';
import { teamShortName } from '@/lib/team-queries';

type FilterTab = 'all' | 'upcoming' | 'past';

const TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'Tout' },
  { key: 'upcoming', label: 'À venir' },
  { key: 'past', label: 'Joués' },
];

const WEEKDAY = ['Dim.', 'Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.'];

function formatDateParts(iso: string): { day: string; month: string; time: string } {
  const d = new Date(iso);
  return {
    day: `${WEEKDAY[d.getDay()]} ${d.getDate().toString().padStart(2, '0')}`,
    month: `${(d.getMonth() + 1).toString().padStart(2, '0')}`,
    time: `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`,
  };
}

function isPast(f: Fixture): boolean {
  return f.status === 'FINISHED' || f.status === 'POSTPONED';
}

function isUpcoming(f: Fixture): boolean {
  return f.status === 'SCHEDULED' || f.status === 'TIMED' || f.status === 'IN_PLAY';
}

function groupByMatchday(fixtures: Fixture[]): Map<string, Fixture[]> {
  const groups = new Map<string, Fixture[]>();
  for (const f of fixtures) {
    const md = f.matchday ?? 0;
    const comp = f.competition ?? 'Autres';
    const key = `${comp} · J${md}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(f);
  }
  return groups;
}

function countResults(fixtures: Fixture[]): { wins: number; draws: number; losses: number } {
  let wins = 0;
  let draws = 0;
  let losses = 0;
  for (const f of fixtures) {
    if (f.status !== 'FINISHED' || f.homeScore === null || f.awayScore === null) continue;
    const olIsHome = f.homeTeamId === OL_TEAM_ID;
    const olScore = olIsHome ? f.homeScore : f.awayScore;
    const oppScore = olIsHome ? f.awayScore : f.homeScore;
    if (olScore > oppScore) wins++;
    else if (olScore < oppScore) losses++;
    else draws++;
  }
  return { wins, draws, losses };
}

export function FixturesPage() {
  const { data, isLoading, isError } = useFixtures();
  const [tab, setTab] = useState<FilterTab>('all');

  const filtered = useMemo(() => {
    if (!data) return [];
    if (tab === 'upcoming') return data.filter(isUpcoming);
    if (tab === 'past') return data.filter(isPast);
    return data;
  }, [data, tab]);

  const grouped = useMemo(() => groupByMatchday(filtered), [filtered]);
  const counts = useMemo(() => ({
    all: data?.length ?? 0,
    upcoming: data?.filter(isUpcoming).length ?? 0,
    past: data?.filter(isPast).length ?? 0,
  }), [data]);
  const nextMatch = useMemo(() => {
    const upcoming = data?.filter(isUpcoming) ?? [];
    return upcoming[0] ?? null;
  }, [data]);
  const lastMatch = useMemo(() => {
    const past = data?.filter((f) => f.status === 'FINISHED') ?? [];
    return past[past.length - 1] ?? null;
  }, [data]);
  const record = useMemo(() => countResults(data ?? []), [data]);

  return (
    <div className="space-y-8">
      <KnowledgeHeader />

      <section className="rounded-md bg-surface border border-border overflow-hidden">
        <header className="px-5 py-4 flex flex-col gap-4 border-b border-border md:flex-row md:items-center md:justify-between">
          <div>
            <div className="eyebrow mb-1">Saison 2025-26</div>
            <h2 className="font-display text-xl font-bold text-fg-bright leading-none">
              Calendrier
            </h2>
          </div>
          <div className="flex items-center gap-1 rounded-full border border-border p-1">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  'px-3 py-1 text-xs font-semibold rounded-full transition-colors',
                  tab === t.key
                    ? 'bg-surface-2 text-fg-bright'
                    : 'text-fg-muted hover:text-fg',
                )}
              >
                {t.label}
                <span className="ml-1.5 text-[10px] text-fg-dim">
                  {counts[t.key]}
                </span>
              </button>
            ))}
          </div>
        </header>

        <div className="p-5">
          {isLoading && (
            <div className="flex items-center justify-center py-20 text-fg-dim">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              <span>Chargement des matchs…</span>
            </div>
          )}
          {isError && (
            <p className="py-20 text-center text-loss">Erreur de chargement.</p>
          )}
          {data && filtered.length === 0 && (
            <p className="py-20 text-center text-fg-muted">Aucun match dans cette catégorie.</p>
          )}
          {data && filtered.length > 0 && (
            <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
              <FixtureSummary
                total={data.length}
                record={record}
                nextMatch={nextMatch}
                lastMatch={lastMatch}
              />
              <div className="space-y-5">
                {Array.from(grouped.entries()).map(([groupKey, fixtures]) => (
                  <div key={groupKey} className="rounded-md border border-border bg-surface-2/25 overflow-hidden">
                    <h3 className="eyebrow px-4 py-2.5 border-b border-border bg-surface-2/50">
                      {groupKey}
                    </h3>
                    <div className="divide-y divide-border">
                      {fixtures.map((f) => (
                        <CompactFixtureRow key={f.id} fixture={f} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function FixtureSummary({
  total,
  record,
  nextMatch,
  lastMatch,
}: {
  total: number;
  record: { wins: number; draws: number; losses: number };
  nextMatch: Fixture | null;
  lastMatch: Fixture | null;
}) {
  return (
    <aside className="space-y-3 lg:sticky lg:top-6 lg:self-start">
      <div className="rounded-md border border-border bg-surface-2/35 p-4">
        <div className="eyebrow mb-3">Vue rapide</div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <MiniStat label="V" value={record.wins} tone="text-win" />
          <MiniStat label="N" value={record.draws} tone="text-draw" />
          <MiniStat label="D" value={record.losses} tone="text-loss" />
        </div>
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-fg-muted">Matchs listés</span>
          <span className="num font-bold text-fg-bright">{total}</span>
        </div>
      </div>

      {nextMatch && (
        <SummaryMatch icon={CalendarDays} label="Prochain" fixture={nextMatch} />
      )}
      {lastMatch && (
        <SummaryMatch icon={Trophy} label="Dernier résultat" fixture={lastMatch} />
      )}
    </aside>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-md border border-border bg-surface px-2 py-3">
      <div className={cn('num text-xl font-bold leading-none', tone)}>{value}</div>
      <div className="mt-1 text-[10px] uppercase tracking-wider text-fg-dim">{label}</div>
    </div>
  );
}

function SummaryMatch({
  icon: Icon,
  label,
  fixture,
}: {
  icon: typeof CalendarDays;
  label: string;
  fixture: Fixture;
}) {
  const olIsHome = fixture.homeTeamId === OL_TEAM_ID;
  const opponent = olIsHome ? fixture.awayTeam : fixture.homeTeam;
  const { day, month, time } = formatDateParts(fixture.date);
  const score = fixture.homeScore !== null && fixture.awayScore !== null
    ? `${fixture.homeScore}-${fixture.awayScore}`
    : time;

  return (
    <div className="rounded-md border border-border bg-surface-2/35 p-4">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.14em] text-fg-dim font-semibold">
        <Icon className="h-3.5 w-3.5 text-ol-red-bright" strokeWidth={2} />
        {label}
      </div>
      <div className="mt-3 flex items-center gap-3">
        <TeamLogo teamId={olIsHome ? fixture.awayTeamId : fixture.homeTeamId} name={opponent} size={30} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-fg-bright">{teamShortName(opponent)}</div>
          <div className="text-xs text-fg-dim">{day}/{month} · {fixture.competition}</div>
        </div>
        <div className="num text-lg font-bold text-fg-bright">{score}</div>
      </div>
    </div>
  );
}

function CompactFixtureRow({ fixture }: { fixture: Fixture }) {
  const { day, month, time } = formatDateParts(fixture.date);
  const hasScore = fixture.homeScore !== null && fixture.awayScore !== null;
  const isLive = fixture.status === 'IN_PLAY';
  const homeWon = hasScore && fixture.homeScore! > fixture.awayScore!;
  const awayWon = hasScore && fixture.awayScore! > fixture.homeScore!;

  return (
    <article className={cn('grid grid-cols-[72px_1fr_auto] items-center gap-3 px-4 py-3 hover:bg-surface-2/45 transition-colors', isLive && 'border-l-[3px] border-l-live')}>
      <div className="text-center">
        <div className="text-xs font-semibold text-fg">{day}</div>
        <div className="text-[10px] uppercase tracking-wider text-fg-dim">{month}</div>
      </div>
      <div className="min-w-0 space-y-1.5">
        <CompactTeamLine
          id={fixture.homeTeamId}
          name={fixture.homeTeam}
          score={fixture.homeScore}
          won={homeWon}
          dim={hasScore && !homeWon}
        />
        <CompactTeamLine
          id={fixture.awayTeamId}
          name={fixture.awayTeam}
          score={fixture.awayScore}
          won={awayWon}
          dim={hasScore && !awayWon}
        />
      </div>
      <div className="min-w-[72px] text-right">
        {isLive ? (
          <div className="text-xs font-bold text-live animate-pulse-live">LIVE</div>
        ) : hasScore ? (
          <div className="text-[10px] uppercase tracking-wider text-fg-dim">Terminé</div>
        ) : (
          <div className="num text-sm font-semibold text-fg">{time}</div>
        )}
      </div>
    </article>
  );
}

function CompactTeamLine({
  id,
  name,
  score,
  won,
  dim,
}: {
  id: number;
  name: string;
  score: number | null;
  won: boolean;
  dim: boolean;
}) {
  const isOL = id === OL_TEAM_ID;
  return (
    <div className={cn('flex min-w-0 items-center gap-2', dim && 'opacity-55')}>
      <TeamLogo teamId={id} name={name} size={18} />
      <span className={cn('min-w-0 flex-1 truncate text-sm', isOL ? 'font-semibold text-fg-bright' : 'text-fg')}>
        {teamShortName(name)}
      </span>
      {score !== null && (
        <span className={cn('num w-6 text-right text-base font-bold', won ? 'text-fg-bright' : 'text-fg-muted')}>
          {score}
        </span>
      )}
    </div>
  );
}
