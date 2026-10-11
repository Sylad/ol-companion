import { Link } from '@tanstack/react-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSeasonMatches } from '@/hooks/use-season-matches';
import { KnowledgeHeader } from '@/components/knowledge-header';
import { TeamLogo } from '@/components/team-logo';
import { CalendarDays, ChevronRight, Loader2, Trophy } from 'lucide-react';
import type { SeasonMatch } from '@/types/api';
import { OL_TEAM_ID } from '@/types/api';
import { cn } from '@/lib/utils';
import { teamShortName } from '@/lib/team-queries';
import { seasonLabel } from '@/lib/season-label';
import { competitionLong, competitionShort } from '@/lib/competitions';
import { KICKOFF_TBD, kickoffTime, unconfirmedDay } from '@/lib/kickoff';
import {
  byCompetition,
  byStatus,
  competitionOptions,
  countResults,
  groupByMonth,
  isUpcoming,
  matchupId,
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

const dateLong = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

/**
 * Jour de la semaine et quantième, sans le mois (le titre du bloc le porte, L50), heure et libellé
 * court de la date ; `time` est `null` quand l'heure n'est pas fixée. Un horaire non fixé veut dire
 * un jour non fixé (L47) : « Week-end du 05/12 » (vendredi, samedi ou dimanche), sinon « Date à confirmer ».
 */
function formatDateParts(match: SeasonMatch): {
  day: string;
  /** Seconde ligne de la colonne, seulement pour un jour non fixé (« du 05/12 », « à confirmer »). */
  detail?: string;
  /** Forme courte de `detail` sous 360 px, quand il ne tient pas dans la colonne de 40 px (L48). */
  detailShort?: string;
  time: string | null;
  label: string;
  /** `YYYY-MM-DD` et date en toutes lettres avec l'année, pour `<time>` ; absents si le jour n'est pas fixé (L98). */
  iso?: string;
  title?: string;
} {
  const d = new Date(match.date);
  const unconfirmed = match.status === 'SCHEDULED' || match.status === 'TIMED' ? unconfirmedDay(match) : null;
  if (unconfirmed?.kind === 'weekend') {
    const sat = `${pad2(unconfirmed.saturday.getDate())}/${pad2(unconfirmed.saturday.getMonth() + 1)}`;
    return { day: 'Week-end', detail: `du ${sat}`, time: null, label: `Week-end du ${sat}` };
  }
  if (unconfirmed) {
    return { day: 'Date', detail: 'à confirmer', detailShort: 'à conf.', time: null, label: 'Date à confirmer' };
  }
  const day = `${WEEKDAY[d.getDay()]} ${pad2(d.getDate())}`;
  return {
    day,
    time: kickoffTime(match),
    label: `${day}/${pad2(d.getMonth() + 1)}`,
    iso: `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`,
    title: dateLong.format(d),
  };
}

export function FixturesPage() {
  // Toute la saison, toutes compétitions : /api/season-matches (L39).
  const { data, isLoading, isError } = useSeasonMatches();
  const [tab, setTab] = useState<StatusTab>('all');
  const [competition, setCompetition] = useState<CompetitionFilter>('all');

  const competitions = useMemo(() => competitionOptions(data ?? []), [data]);
  // Les compteurs d'un groupe de pastilles suivent le choix de l'autre (L50) : un choix à 0 se voit avant le clic.
  const competitionCounts = useMemo(() => {
    const inTab = byStatus(data ?? [], tab);
    return { all: inTab.length, ...Object.fromEntries(competitions.map((c) => [c.code, byCompetition(inTab, c.code).length])) } as Record<string, number>;
  }, [data, tab, competitions]);
  // La compétition choisie borne tout le reste : compteurs, vue rapide, liste.
  const scoped = useMemo(() => byCompetition(data ?? [], competition), [data, competition]);
  const filtered = useMemo(() => byStatus(scoped, tab), [scoped, tab]);
  const months = useMemo(() => groupByMonth(filtered), [filtered]);
  const counts = useMemo(() => statusCounts(scoped), [scoped]);
  const nextMatch = useMemo(() => scoped.filter(isUpcoming)[0] ?? null, [scoped]);
  const lastMatch = useMemo(() => {
    const past = scoped.filter((f) => f.status === 'FINISHED');
    return past[past.length - 1] ?? null;
  }, [scoped]);
  const record = useMemo(() => countResults(scoped), [scoped]);

  // La barre collante change de hauteur (4 compétitions : 163 px à 390 px, 139 à 320) : on la mesure pour que
  // `scroll-padding-top` (index.css, repli 124 px) la suive, sinon un focus clavier passe dessous (WCAG 2.4.11).
  const barRef = useRef<HTMLDivElement>(null);
  const hasBar = Boolean(data);
  useEffect(() => {
    const bar = barRef.current;
    if (!bar || typeof ResizeObserver === 'undefined') return;
    const root = document.documentElement;
    const apply = () => root.style.setProperty('--barre-filtres-h', `${Math.ceil(bar.getBoundingClientRect().height)}px`);
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(bar);
    return () => {
      observer.disconnect();
      root.style.removeProperty('--barre-filtres-h');
    };
  }, [hasBar]);

  return (
    <div className="space-y-8">
      <KnowledgeHeader />

      {/* overflow-clip, pas overflow-hidden : même coupe aux coins arrondis, mais
          la section ne devient pas le conteneur de défilement de la barre des filtres
          (max-lg:sticky) ni de la vue rapide (lg:sticky), qui sinon ne collent plus. */}
      <section className="rounded-md bg-surface border border-border overflow-clip">
        <header className="px-5 py-4 border-b border-border">
          <div className="eyebrow mb-1 whitespace-nowrap">Saison {seasonLabel(data)}</div>
          <h2 data-testid="titre-page" className="font-display text-xl font-bold text-fg-bright leading-none">
            Calendrier
          </h2>
        </header>

        {data && (
          <>
            {/* Sous 1024 px, la barre colle en haut de la fenêtre (fond opaque, 115 px à 390 px) ; au bureau elle
                reste dans le flux, sous le titre. La légende est dehors, dans le flux. */}
            <div
              ref={barRef}
              data-testid="barre-filtres"
              className="flex flex-col gap-1.5 bg-surface px-3 py-1.5 sm:px-5 max-lg:sticky max-lg:top-0 max-lg:z-20 max-lg:border-b max-lg:border-border max-lg:shadow-[0_6px_12px_-8px_rgba(0,0,0,0.9)] lg:flex-row lg:flex-wrap lg:items-center lg:justify-end lg:gap-2 lg:py-3"
            >
              {competitions.length > 1 && (
                <FilterPills
                  testId="filtre-competition"
                  label="Filtrer par compétition"
                  value={competition}
                  onChange={setCompetition}
                  options={[
                    { key: 'all', label: 'Toutes', count: competitionCounts.all },
                    ...competitions.map((c) => ({ key: c.code, label: c.label, count: competitionCounts[c.code], name: c.name, abbr: true })),
                  ]}
                />
              )}
              <FilterPills
                testId="filtre-statut"
                label="Filtrer par statut"
                value={tab}
                onChange={setTab}
                options={TABS.map((t) => ({ key: t.key, label: t.label, count: counts[t.key] }))}
              />
            </div>
            {competitions.length > 1 && (
              // Le toucher n'a pas d'infobulle : le nom long des sigles reste écrit à l'écran.
              <p data-testid="legende-competitions" className="px-3 py-2 text-xs text-fg-muted sm:px-5 lg:pt-0 lg:text-right">
                Comp. : {competitions.map((c) => `${c.label} = ${c.name}`).join(' · ')}
              </p>
            )}
          </>
        )}

        <div className="p-3 sm:p-5">
          {isLoading && (
            <div data-testid="message-chargement" className="flex items-center justify-center py-20 text-fg-dim">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              <span>Chargement des matchs…</span>
            </div>
          )}
          {isError && (
            <p data-testid="message-erreur" className="py-20 text-center text-loss">Erreur de chargement.</p>
          )}
          {data && filtered.length === 0 && (
            <p data-testid="message-vide" className="py-20 text-center text-fg-muted">Aucun match dans cette catégorie.</p>
          )}
          {data && filtered.length > 0 && (
            <div className="grid gap-3 lg:grid-cols-[280px_1fr] lg:gap-5">
              <FixtureSummary
                total={filtered.length}
                record={record}
                nextMatch={nextMatch}
                lastMatch={lastMatch}
              />
              <div data-testid="liste-mois" className="space-y-3 lg:space-y-5">
                {months.map((month) => (
                  <section
                    key={month.key}
                    data-testid="bloc-mois"
                    className="rounded-md border border-border bg-surface-2/25 overflow-hidden"
                  >
                    <h3 className="eyebrow flex items-baseline justify-between px-4 py-2 border-b border-border bg-surface-2/50">
                      <span data-testid="titre-mois">{month.label}</span>
                      <span data-testid="nombre-matchs-mois" className="num normal-case tracking-normal font-normal">
                        {month.matches.length} {month.matches.length > 1 ? 'matchs' : 'match'}
                      </span>
                    </h3>
                    <div className="divide-y divide-border">
                      {month.matches.map((f) => (
                        <CompactFixtureRow key={f.id} fixture={f} />
                      ))}
                    </div>
                  </section>
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
  /** Libellé abrégé : le nom long passe en infobulle (`title`). */
  abbr?: boolean;
}

function FilterPills<K extends string>({
  testId,
  label,
  options,
  value,
  onChange,
}: {
  testId: string;
  label: string;
  options: PillOption<K>[];
  value: K;
  onChange: (key: K) => void;
}) {
  return (
    // rounded-[17px] (lg) = la demi-hauteur d'une rangée (34 px) ; 24 px en dessous (rangée de 48 px) : même capsule que
    // rounded-full sur une ligne, et un bloc arrondi propre si les pastilles
    // passent sur deux lignes (4 compétitions sur un téléphone de 390 px).
    <div data-testid={testId} role="group" aria-label={label} className="flex flex-wrap items-center gap-1 rounded-[24px] border border-border p-1 lg:rounded-[17px]">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          aria-pressed={value === o.key}
          // Nom = « <sigle> — <nom> · n matchs » : il commence par le texte affiché (WCAG 2.5.3) ;
          // sans nom explicite, le libellé et le compteur seraient lus collés (« À venir36 »).
          aria-label={`${o.abbr && o.name ? `${o.label} — ${o.name}` : o.name ?? o.label} · ${o.count} ${o.count > 1 ? 'matchs' : 'match'}`}
          onClick={() => onChange(o.key)}
          className={cn(
            // Sous lg (téléphone, tablette) : cible de 40 px (WCAG 2.5.8 exige 24 px, 40 px au pouce) ;
            // le bureau garde la pastille de 24 px (pointeur fin). Sous 360 px : 32 px, pour que les pastilles tiennent à 320 px.
            'whitespace-nowrap px-3 py-1 text-xs font-semibold rounded-full transition-colors min-h-10 lg:min-h-0 max-[359px]:min-h-8 max-[359px]:px-2',
            // Au clavier : contour rouge 2 px (outline, pas ring : le ring est le box-shadow
            // de l'anneau gris et l'écraserait), à 1 px de la pastille, donc l'anneau gris de la
            // pastille choisie reste visible dessous (WCAG 2.4.7). 1 + 2 px tiennent dans le p-1.
            'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ol-red-bright',
            // Pastille choisie : le fond seul fait 1,07:1 sur le groupe et le texte
            // ne change que de clarté — l'anneau fg-muted porte l'état (≥ 3:1,
            // WCAG 1.4.1 / 1.4.11).
            value === o.key
              ? 'bg-surface-2 text-fg-bright ring-1 ring-fg-muted'
              : 'text-fg-muted hover:text-fg',
          )}
        >
          {o.abbr && o.name ? <abbr title={o.name} className="no-underline">{o.label}</abbr> : o.label}
          {/* 10 px : fg-muted (≥ 4,5:1 dans les deux états) ; fg-dim (≥ 4,6:1 depuis L52) passerait aussi, mais le compteur suit le texte du bouton. */}
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
    <aside className="space-y-2 lg:sticky lg:top-6 lg:self-start lg:space-y-3">
      <div data-testid="vue-rapide" className="rounded-md border border-border bg-surface-2/35 px-3 py-2.5 lg:p-4">
        <div className="eyebrow">Vue rapide</div>
        {/* V N D et « Matchs listés » sur une seule ligne ; chiffres en 20 px gras (grand texte, WCAG 1.4.3). */}
        <div className="mt-1.5 flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <span className="num text-xl font-bold leading-none text-win">{record.wins} V</span>
          <span className="num text-xl font-bold leading-none text-draw">{record.draws} N</span>
          <span className="num text-xl font-bold leading-none text-loss">{record.losses} D</span>
          <span className="ml-auto text-sm text-fg-muted">
            Matchs listés <span className="num font-bold text-fg-bright">{total}</span>
          </span>
        </div>
      </div>

      {nextMatch && (
        <SummaryMatch testId="carte-prochain" icon={CalendarDays} label="Prochain" fixture={nextMatch} />
      )}
      {lastMatch && (
        <SummaryMatch testId="carte-dernier-resultat" icon={Trophy} label="Dernier résultat" fixture={lastMatch} />
      )}
    </aside>
  );
}

function SummaryMatch({
  testId,
  icon: Icon,
  label,
  fixture,
}: {
  testId: string;
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
    <div data-testid={testId} className="relative rounded-md border border-border bg-surface-2/35 px-3 py-2.5 transition-colors hover:border-border-strong lg:p-4">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.14em] text-fg-dim font-semibold">
        <Icon className="h-3.5 w-3.5 text-ol-red-bright" strokeWidth={2} />
        {label}
      </div>
      <div className="mt-1.5 flex items-center gap-3 lg:mt-3">
        <TeamLogo
          teamId={olIsHome ? fixture.awayTeamId : fixture.homeTeamId}
          name={opponent}
          size={30}
          src={seasonTeamLogoUrl(olIsHome ? fixture.awayTeamId : fixture.homeTeamId)}
        />
        <div className="min-w-0 flex-1">
          <div className="break-words text-sm font-semibold text-fg-bright">
            <MatchLink fixture={fixture} prefix={label}>{teamShortName(opponent)}</MatchLink>
          </div>
          <div className="text-xs text-fg-dim">{dateLabel} · {competitionLong(fixture.competitionCode)}</div>
        </div>
        {score ? (
          <div className="num text-lg font-bold text-fg-bright">{score}</div>
        ) : (
          <KickoffTbd />
        )}
        {/* Le chevron signale que toute la carte est un lien. */}
        <ChevronRight aria-hidden="true" className="h-5 w-5 shrink-0 text-fg-muted" />
      </div>
    </div>
  );
}

/**
 * Nom accessible d'un match : les noms affichés et, pour un match joué, les scores
 * (« Sparta Praha 2, Lyon 1 — détail du match » ; à venir « Lyon contre Union SG — … »).
 */
function matchLinkName(fixture: SeasonMatch): string {
  const home = teamShortName(fixture.homeTeam);
  const away = teamShortName(fixture.awayTeam);
  const played = fixture.homeScore !== null && fixture.awayScore !== null;
  return `${played ? `${home} ${fixture.homeScore}, ${away} ${fixture.awayScore}` : `${home} contre ${away}`} — détail du match`;
}

/**
 * Lien vers la page du match (L96). Étiré sur toute la ligne ou la carte (le parent est
 * `relative`) par un pseudo-élément : la zone cliquable est la rangée entière, sans <a> autour
 * de blocs. Nom accessible = la rencontre, pas le seul nom du club.
 */
function MatchLink({
  fixture,
  prefix,
  block,
  children,
}: {
  fixture: SeasonMatch;
  prefix?: string;
  /** Lien en bloc : sa boîte entoure son contenu, le contour de focus s'affiche (WCAG 2.4.7). */
  block?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      to="/match/$gameId"
      params={{ gameId: String(fixture.id) }}
      search={{ matchupId: matchupId(fixture) }}
      aria-label={`${prefix ? `${prefix}, ` : ''}${matchLinkName(fixture)}`}
      title={`${fixture.homeTeam} contre ${fixture.awayTeam}`}
      className={cn(
        block && 'block',
        "after:absolute after:inset-0 after:z-10 after:content-[''] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ol-red-bright",
      )}
    >
      {children}
    </Link>
  );
}

/**
 * À la place de l'heure quand elle n'est pas fixée. 10 px en capitales, donc
 * `fg-muted` (≥ 4,5:1 sur le fond, WCAG 1.4.3) plutôt que `fg-dim` (≥ 4,6:1 aussi depuis L52, mais plus pâle) ; reste
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

/** « L1 · J6 » : sigle du glossaire (nom long en infobulle et pour les lecteurs d'écran), puis la journée. */
function CompetitionTag({ fixture }: { fixture: SeasonMatch }) {
  const long = competitionLong(fixture.competitionCode);
  return (
    <span data-testid="competition-match" className="whitespace-nowrap text-[11px] font-semibold text-fg-muted">
      <abbr title={long} className="no-underline">
        <span aria-hidden="true">{competitionShort(fixture.competitionCode)}</span>
        <span className="sr-only">{long}</span>
      </abbr>
      {fixture.matchday ? (
        <>
          {' '}
          <span aria-hidden="true" className="num">· J{fixture.matchday}</span>
          <span className="sr-only">, journée {fixture.matchday}</span>
        </>
      ) : null}
    </span>
  );
}

function CompactFixtureRow({ fixture }: { fixture: SeasonMatch }) {
  const { day, detail, detailShort, time, iso, title } = formatDateParts(fixture);
  const DateBlock = iso ? 'time' : 'div';
  const hasScore = fixture.homeScore !== null && fixture.awayScore !== null;
  const isLive = fixture.status === 'IN_PLAY';
  const homeWon = hasScore && fixture.homeScore! > fixture.awayScore!;
  const awayWon = hasScore && fixture.awayScore! > fixture.homeScore!;
  const drew = hasScore && fixture.status === 'FINISHED' && fixture.homeScore === fixture.awayScore;

  return (
    <article
      data-testid="ligne-match"
      className={cn(
        'relative grid grid-cols-[56px_1fr_auto] items-center gap-2 px-3 py-2 sm:gap-3 sm:px-4 hover:bg-surface-2/45 transition-colors',
        // Sous 360 px : colonne de la date resserrée et marges réduites, pour laisser la place aux noms (L48).
        'max-[359px]:grid-cols-[40px_1fr_auto] max-[359px]:gap-1 max-[359px]:px-2',
        isLive && 'border-l-[3px] border-l-live',
      )}
    >
      <DateBlock data-testid="date-match" className="block text-center" {...(iso ? { dateTime: iso, title } : {})}>
        <div className="whitespace-nowrap text-xs font-semibold text-fg max-[359px]:text-[10px]">{day}</div>
        {detail && (
          <div className="text-[10px] uppercase tracking-wider text-fg-muted">
            {detailShort ? (
              <>
                {/* Sous 360 px « à confirmer » (64 px) déborde la colonne de 40 px : forme courte à l'écran, forme entière pour les lecteurs d'écran (L48). */}
                <span className="max-[359px]:sr-only">{detail}</span>
                <span aria-hidden="true" className="hidden max-[359px]:inline">
                  {detailShort}
                </span>
              </>
            ) : (
              detail
            )}
          </div>
        )}
      </DateBlock>
      <div data-testid="equipes-match" className="min-w-0">
        <MatchLink fixture={fixture} block>
          <span className="block">
            <CompactTeamLine
              id={fixture.homeTeamId}
              name={fixture.homeTeam}
              score={fixture.homeScore}
              won={homeWon}
              drew={drew}
              dim={hasScore && !homeWon}
            />
            <CompactTeamLine
              id={fixture.awayTeamId}
              name={fixture.awayTeam}
              score={fixture.awayScore}
              won={awayWon}
              drew={drew}
              dim={hasScore && !awayWon}
            />
          </span>
          {!fixture.matchday && fixture.round && (
            <span data-testid="tour-match" className="mt-0.5 block text-[11px] leading-tight text-fg-muted">
              {fixture.round}
            </span>
          )}
        </MatchLink>
      </div>
      <div className="flex min-w-[62px] flex-col items-end gap-0.5 text-right">
        <div data-testid="score-match">
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
        <CompetitionTag fixture={fixture} />
      </div>
    </article>
  );
}

/**
 * Les noms de club se coupent aux espaces, sans ellipse (L48, L50) : un nom de plusieurs mots passe
 * à la ligne entre ses mots ; un mot plus long que la place disponible se casse (`break-words`)
 * plutôt que d'être tronqué. Le nom entier reste dans le `title` du lien de la ligne.
 */
function CompactTeamLine({
  id,
  name,
  score,
  won,
  drew,
  dim,
}: {
  id: number;
  name: string;
  score: number | null;
  won: boolean;
  drew: boolean;
  dim: boolean;
}) {
  const isOL = id === OL_TEAM_ID;
  return (
    <span className="flex min-w-0 items-center gap-1.5 max-[359px]:gap-1 sm:gap-2">
      {/* L94 : seul l'écusson du perdant est atténué (les deux sur un match nul : ni homeWon ni awayWon) ; une opacité sur le nom ou le score les ramenait à 2,97:1 (WCAG 1.4.3). */}
      <span className={cn('inline-flex shrink-0', dim && 'opacity-55')}>
        <TeamLogo teamId={id} name={name} size={18} src={seasonTeamLogoUrl(id)} />
      </span>
      <span
        className={cn(
          'min-w-0 flex-1 break-words text-[13px] leading-[1.35]',
          isOL ? 'font-semibold text-fg-bright' : 'text-fg',
        )}
      >
        {teamShortName(name)}
      </span>
      {score !== null && (
        <span className={cn('num w-6 text-right text-sm font-bold leading-tight', won ? 'text-fg-bright' : drew ? 'text-draw' : 'text-fg-muted')}>
          {score}
        </span>
      )}
    </span>
  );
}
