import { useMemo, useState } from 'react';
import { useSeasonMatches } from '@/hooks/use-season-matches';
import { KnowledgeHeader } from '@/components/knowledge-header';
import { TeamLogo } from '@/components/team-logo';
import { CalendarDays, Loader2, Trophy } from 'lucide-react';
import type { SeasonMatch } from '@/types/api';
import { OL_TEAM_ID } from '@/types/api';
import { cn } from '@/lib/utils';
import { teamShortName } from '@/lib/team-queries';
import { seasonLabel } from '@/lib/season-label';
import { KICKOFF_TBD, kickoffTime, unconfirmedDay } from '@/lib/kickoff';
import {
  byCompetition,
  byStatus,
  competitionOptions,
  countResults,
  groupMatches,
  isUpcoming,
  seasonTeamLogoUrl,
  statusCounts,
  type CompetitionFilter,
  type StatusTab,
} from '@/lib/calendar';

const TABS: { key: StatusTab; label: string }[] = [
  { key: 'all', label: 'Tout' },
  { key: 'upcoming', label: 'À venir' },
  { key: 'past', label: 'Joués' },
];

const WEEKDAY = ['Dim.', 'Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.'];

const pad2 = (n: number): string => n.toString().padStart(2, '0');

/**
 * Jour, mois, heure et libellé court de la date ; `time` est `null` quand
 * l'heure n'est pas fixée. Un horaire non fixé veut dire un jour non fixé (L47) :
 * « Week-end du 05/12 » (vendredi, samedi ou dimanche), sinon « Date à confirmer ».
 */
function formatDateParts(match: SeasonMatch): {
  day: string;
  month: string;
  time: string | null;
  label: string;
} {
  const d = new Date(match.date);
  const unconfirmed = match.status === 'SCHEDULED' || match.status === 'TIMED' ? unconfirmedDay(match) : null;
  if (unconfirmed?.kind === 'weekend') {
    const sat = `${pad2(unconfirmed.saturday.getDate())}/${pad2(unconfirmed.saturday.getMonth() + 1)}`;
    return { day: 'Week-end', month: `du ${sat}`, time: null, label: `Week-end du ${sat}` };
  }
  if (unconfirmed) {
    return { day: 'Date', month: 'à confirmer', time: null, label: 'Date à confirmer' };
  }
  const day = `${WEEKDAY[d.getDay()]} ${pad2(d.getDate())}`;
  const month = pad2(d.getMonth() + 1);
  return { day, month, time: kickoffTime(match), label: `${day}/${month}` };
}

export function FixturesPage() {
  // Toute la saison, toutes compétitions : /api/season-matches (L39).
  const { data, isLoading, isError } = useSeasonMatches();
  const [tab, setTab] = useState<StatusTab>('all');
  const [competition, setCompetition] = useState<CompetitionFilter>('all');

  const competitions = useMemo(() => competitionOptions(data ?? []), [data]);
  // La compétition choisie borne tout le reste : compteurs, vue rapide, liste.
  const scoped = useMemo(() => byCompetition(data ?? [], competition), [data, competition]);
  const filtered = useMemo(() => byStatus(scoped, tab), [scoped, tab]);
  const grouped = useMemo(() => groupMatches(filtered), [filtered]);
  const counts = useMemo(() => statusCounts(scoped), [scoped]);
  const nextMatch = useMemo(() => scoped.filter(isUpcoming)[0] ?? null, [scoped]);
  const lastMatch = useMemo(() => {
    const past = scoped.filter((f) => f.status === 'FINISHED');
    return past[past.length - 1] ?? null;
  }, [scoped]);
  const record = useMemo(() => countResults(scoped), [scoped]);

  return (
    <div className="space-y-8">
      <KnowledgeHeader />

      {/* overflow-clip, pas overflow-hidden : même coupe aux coins arrondis, mais
          la section ne devient pas le conteneur de défilement de la vue rapide
          (lg:sticky), qui sinon ne colle plus. */}
      <section className="rounded-md bg-surface border border-border overflow-clip">
        <header className="px-5 py-4 flex flex-col gap-4 border-b border-border md:flex-row md:items-center md:justify-between">
          <div>
            <div className="eyebrow mb-1">Saison {seasonLabel(data)}</div>
            <h2 className="font-display text-xl font-bold text-fg-bright leading-none">
              Calendrier
            </h2>
          </div>
          <div className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center md:justify-end">
            {competitions.length > 1 && (
              <FilterPills
                label="Filtrer par compétition"
                value={competition}
                onChange={setCompetition}
                options={[
                  { key: 'all', label: 'Toutes', count: data?.length ?? 0, name: 'Toutes les compétitions' },
                  ...competitions.map((c) => ({ key: c.code, label: c.label, count: c.count, name: c.name })),
                ]}
              />
            )}
            <FilterPills
              label="Filtrer par statut"
              value={tab}
              onChange={setTab}
              options={TABS.map((t) => ({ key: t.key, label: t.label, count: counts[t.key] }))}
            />
          </div>
        </header>

        <div className="p-3 sm:p-5">
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
                total={scoped.length}
                record={record}
                nextMatch={nextMatch}
                lastMatch={lastMatch}
              />
              <div className="space-y-5">
                {grouped.map((group) => (
                  <div key={group.key} className="rounded-md border border-border bg-surface-2/25 overflow-hidden">
                    <h3 className="eyebrow px-4 py-2.5 border-b border-border bg-surface-2/50">
                      {group.label}
                    </h3>
                    <div className="divide-y divide-border">
                      {group.matches.map((f) => (
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

interface PillOption<K extends string> {
  key: K;
  label: string;
  count: number;
  /** Nom complet annoncé quand le libellé affiché est abrégé. */
  name?: string;
}

function FilterPills<K extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: PillOption<K>[];
  value: K;
  onChange: (key: K) => void;
}) {
  return (
    // rounded-[17px] = la demi-hauteur d'une rangée (34 px) : même capsule que
    // rounded-full sur une ligne, et un bloc arrondi propre si les pastilles
    // passent sur deux lignes (4 compétitions sur un téléphone de 390 px).
    <div role="group" aria-label={label} className="flex flex-wrap items-center gap-1 rounded-[17px] border border-border p-1">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          aria-pressed={value === o.key}
          // Sans nom explicite, le libellé et le compteur sont lus collés (« À venir36 »).
          aria-label={`${o.name ?? o.label} · ${o.count} ${o.count > 1 ? 'matchs' : 'match'}`}
          onClick={() => onChange(o.key)}
          className={cn(
            'whitespace-nowrap px-3 py-1 text-xs font-semibold rounded-full transition-colors',
            // Pastille choisie : le fond seul fait 1,07:1 sur le groupe et le texte
            // ne change que de clarté — l'anneau fg-muted porte l'état (≥ 3:1,
            // WCAG 1.4.1 / 1.4.11).
            value === o.key
              ? 'bg-surface-2 text-fg-bright ring-1 ring-fg-muted'
              : 'text-fg-muted hover:text-fg',
          )}
        >
          {o.label}
          {/* 10 px : fg-muted (≥ 4,5:1 dans les deux états), fg-dim restait sous le seuil. */}
          <span className="ml-1.5 text-[10px] text-fg-muted">
            {o.count}
          </span>
        </button>
      ))}
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
  nextMatch: SeasonMatch | null;
  lastMatch: SeasonMatch | null;
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
  fixture: SeasonMatch;
}) {
  const olIsHome = fixture.homeTeamId === OL_TEAM_ID;
  const opponent = olIsHome ? fixture.awayTeam : fixture.homeTeam;
  const { label: dateLabel, time } = formatDateParts(fixture);
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
        <TeamLogo
          teamId={olIsHome ? fixture.awayTeamId : fixture.homeTeamId}
          name={opponent}
          size={30}
          src={seasonTeamLogoUrl(olIsHome ? fixture.awayTeamId : fixture.homeTeamId)}
        />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-fg-bright">{teamShortName(opponent)}</div>
          <div className="text-xs text-fg-dim">{dateLabel} · {fixture.competition}</div>
        </div>
        {score ? (
          <div className="num text-lg font-bold text-fg-bright">{score}</div>
        ) : (
          <KickoffTbd />
        )}
      </div>
    </div>
  );
}

/**
 * À la place de l'heure quand elle n'est pas fixée. 10 px en capitales, donc
 * `fg-muted` (≥ 4,5:1 sur le fond, WCAG 1.4.3) et non `fg-dim` (3,9:1) ; reste
 * plus discret qu'une heure (14 px, gras).
 */
function KickoffTbd() {
  const [first, ...rest] = KICKOFF_TBD.split(' ');
  return (
    <div className="text-right text-[10px] uppercase leading-tight tracking-wider text-fg-muted">
      <span className="block whitespace-nowrap">{first}</span>{' '}
      <span className="block whitespace-nowrap">{rest.join(' ')}</span>
    </div>
  );
}

function CompactFixtureRow({ fixture }: { fixture: SeasonMatch }) {
  const { day, month, time } = formatDateParts(fixture);
  const hasScore = fixture.homeScore !== null && fixture.awayScore !== null;
  const isLive = fixture.status === 'IN_PLAY';
  const homeWon = hasScore && fixture.homeScore! > fixture.awayScore!;
  const awayWon = hasScore && fixture.awayScore! > fixture.homeScore!;

  return (
    <article className={cn('grid grid-cols-[56px_1fr_auto] items-center gap-2 px-3 py-3 sm:gap-3 sm:px-4 hover:bg-surface-2/45 transition-colors', isLive && 'border-l-[3px] border-l-live')}>
      <div className="text-center">
        <div className="text-xs font-semibold text-fg">{day}</div>
        <div className="text-[10px] uppercase tracking-wider text-fg-muted">{month}</div>
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
      <div className="text-right">
        {isLive ? (
          <div className="text-xs font-bold text-live animate-pulse-live">LIVE</div>
        ) : hasScore ? (
          <div className="text-[10px] uppercase tracking-wider text-fg-dim">Terminé</div>
        ) : time ? (
          <div className="num text-sm font-semibold text-fg">{time}</div>
        ) : (
          <KickoffTbd />
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
    <div className={cn('flex min-w-0 items-center gap-1.5 sm:gap-2', dim && 'opacity-55')}>
      <TeamLogo teamId={id} name={name} size={18} src={seasonTeamLogoUrl(id)} />
      <span
        title={name}
        className={cn('min-w-0 flex-1 break-words text-sm leading-tight sm:truncate', isOL ? 'font-semibold text-fg-bright' : 'text-fg')}
      >
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
