import type { CSSProperties, ReactNode } from 'react';
import { useParams, useSearch, Link } from '@tanstack/react-router';
import { Loader2, Radio, ArrowLeft, Pause, Trophy, Clock } from 'lucide-react';
import { useLiveMatchStats } from '@/hooks/use-live-match';
import { useMatchEventBurst } from '@/hooks/use-match-event-burst';
import { ShotMap } from '@/components/shot-map';
import { MomentumChart } from '@/components/momentum-chart';
import { LineupCard } from '@/components/lineup-card';
import { MiniStandings } from '@/components/mini-standings';
import { MatchEventBurst } from '@/components/match-event-burst';
import { deriveClock } from '@/lib/match-clock';
import { MatchScore } from '@/components/match-score';
import { cn } from '@/lib/utils';
import { OL_365SCORES_ID as OL_ID, type LiveMatchTimelineEvent, type LiveMatchTopPerformer } from '@/types/api';

const EVENT_LABEL: Record<string, string> = {
  goal: '⚽ But',
  penalty_goal: '⚽ But sur penalty',
  own_goal: '⚽ Csc',
  yellow_card: '🟨 Carton jaune',
  red_card: '🟥 Carton rouge',
  second_yellow_red: '🟥 2e jaune',
  card: '🟨 Carton',
  substitution: '↔ Remplacement',
  var: 'VAR',
  penalty_missed: '❌ Penalty raté',
};

type StatDef = { key: string; label: string; fmt?: (n: number) => string };

/** Mesures comparées par des barres au centre (L160 R9). */
const COMPARED_STATS: StatDef[] = [
  { key: 'Touches', label: 'Possession (touches)' },
  { key: 'Tirs au total', label: 'Tirs' },
  { key: 'Tirs cadrés', label: 'Tirs cadrés' },
  { key: 'Buts attendus', label: 'xG (buts attendus)', fmt: (n) => n.toFixed(2) },
];

/** Mesures listées seules (libellé, nombre) dans la colonne de chaque équipe (L160 R9). */
const TEAM_STATS: StatDef[] = [
  { key: 'Passes Completed', label: 'Passes complétées' },
  { key: 'Passes dans le dernier tiers', label: 'Passes dans la moitié adverse' },
  { key: 'Centres réussis', label: 'Centres réussis' },
  { key: 'Tacles Gagnés', label: 'Tacles gagnés' },
  { key: 'Les interceptions', label: 'Interceptions' },
  { key: 'Duels au sol gagnés', label: 'Duels au sol' },
  { key: 'Duels aériens gagnés', label: 'Duels aériens' },
  { key: 'Récupération du ballon', label: 'Récupérations' },
  { key: 'Fautes faites', label: 'Fautes' },
  { key: 'Hors jeu', label: 'Hors-jeu' },
];

function StatRow({
  label,
  home,
  away,
  fmt,
  homeIsOl,
}: {
  label: string;
  home: number;
  away: number;
  fmt?: (n: number) => string;
  homeIsOl: boolean;
}) {
  const total = home + away;
  const pctHome = total > 0 ? (home / total) * 100 : 50;
  const f = fmt ?? ((n: number) => `${Math.round(n)}`);

  return (
    <div className="grid grid-cols-[60px_1fr_60px] items-center gap-3">
      <span className="text-right num tabular-nums font-bold text-fg-bright">{f(home)}</span>
      <div>
        <div className="text-[10px] uppercase tracking-wider text-fg-muted text-center mb-1">{label}</div>
        {/* La couleur suit le club (OL rouge, adversaire bleu), pas le côté ; 2 px de --surface entre les segments. */}
        <div className="flex gap-0.5 h-2 rounded-full bg-surface overflow-hidden">
          {home > 0 && <div className={cn('transition-all', homeIsOl ? 'bg-ol-red' : 'bg-ol-blue-bright')} style={{ flexGrow: pctHome, flexBasis: 0 }} />}
          {away > 0 && <div className={cn('transition-all', homeIsOl ? 'bg-ol-blue-bright' : 'bg-ol-red')} style={{ flexGrow: 100 - pctHome, flexBasis: 0 }} />}
        </div>
      </div>
      <span className="text-left num tabular-nums font-bold text-fg-bright">{f(away)}</span>
    </div>
  );
}

function TimelineRow({ event, homeId, homeSymbol, awaySymbol }: {
  event: LiveMatchTimelineEvent; homeId: number; homeSymbol: string; awaySymbol: string;
}) {
  const isHome = event.competitorId === homeId;
  const base = EVENT_LABEL[event.type] ?? event.description;
  const who = event.playerShortName ?? event.playerName;
  const label = who ? `${base} · ${who}` : base;
  // Tooltip : nom complet, et passeur / entrant selon l'événement.
  const extra = event.extraPlayerName
    ? ` — ${event.type === 'substitution' ? 'entrant' : 'passe'} : ${event.extraPlayerName}`
    : '';
  const tooltip = event.playerName ? `${event.playerName}${extra}` : undefined;
  return (
    <div className="grid grid-cols-[1fr_60px_1fr] items-center gap-3 py-0.5">
      <div className={cn('text-right text-sm', !isHome && 'text-fg-dim')}>
        {isHome && <span className="font-medium" title={tooltip}>{label}</span>}
      </div>
      <div className="text-center">
        <span className="num tabular-nums text-xs font-bold text-fg-bright">{event.gameTimeDisplay}</span>
        <div className="text-[10px] uppercase tracking-wider text-fg-dim">{isHome ? homeSymbol : awaySymbol}</div>
      </div>
      <div className={cn('text-left text-sm', isHome && 'text-fg-dim')}>
        {!isHome && <span className="font-medium" title={tooltip}>{label}</span>}
      </div>
    </div>
  );
}

function PerformerCell({ player, align }: { player: LiveMatchTopPerformer['homePlayer']; align: 'right' | 'left' }) {
  if (!player) return <span className={cn('text-fg-dim text-xs', align === 'right' ? 'text-right' : 'text-left')}>—</span>;
  return (
    <div className={cn('min-w-0', align === 'right' ? 'text-right' : 'text-left')}>
      <div className="font-semibold text-fg text-sm break-words">{player.name}</div>
      <div data-stat-ligne className="text-xs text-fg-muted whitespace-nowrap">
        {player.statName} : <span className="num tabular-nums font-semibold text-fg">{player.statValue}</span>
      </div>
    </div>
  );
}

const GOAL_TYPES = new Set(['goal', 'penalty_goal', 'own_goal']);

/** « Nuamah 7', 30' (pen.) » — buts crédités à `teamId`, groupés par joueur. Un csc profite à l'adversaire. */
function scorersFor(events: LiveMatchTimelineEvent[], teamId: number, opponentId: number): { name: string; marks: string }[] {
  const byPlayer = new Map<string, string[]>();
  for (const e of events) {
    if (!GOAL_TYPES.has(e.type)) continue;
    const creditedTo = e.type === 'own_goal' ? (e.competitorId === teamId ? opponentId : teamId) : e.competitorId;
    if (creditedTo !== teamId) continue;
    const name = e.playerName ?? 'Inconnu';
    const suffix = e.type === 'penalty_goal' ? ' (pen.)' : e.type === 'own_goal' ? ' (csc)' : '';
    const arr = byPlayer.get(name) ?? [];
    arr.push(`${e.gameTimeDisplay}${suffix}`);
    byPlayer.set(name, arr);
  }
  return [...byPlayer.entries()].map(([name, marks]) => ({ name, marks: marks.join(', ') }));
}

function Scorers({ items, align }: { items: { name: string; marks: string }[]; align: 'right' | 'left' }) {
  if (!items.length) return <div />;
  return (
    <ul className={cn('space-y-0.5 text-xs text-fg-muted', align === 'right' ? 'text-right' : 'text-left')}>
      {items.map((s) => (
        <li key={s.name}>
          <span className="text-fg">{s.name}</span>{' '}
          <span className="num tabular-nums text-fg-dim">{s.marks}</span>
        </li>
      ))}
    </ul>
  );
}

interface MatchSearch {
  matchupId?: string;
}

// Les classes `min-[1440px]:` (point de rupture de la disposition en trois colonnes, L160 R4) sont écrites en
// entier : Tailwind ne voit pas celles qu'on compose.

/**
 * Cellule d'un côté : aplatie sous 1440 px (display: contents, div neutre), placée à 1440 px par
 * les variables --c (colonne 1 ou 3) et --r (rangée 1 : composition, 2 : statistiques d'équipe).
 * Le DOM reste l'ordre de lecture : aucun order, grid-row ou grid-column sous 1440 px.
 */
function SideCell({ col, row, children }: { col: 1 | 3; row: 1 | 2; children: ReactNode }) {
  return (
    <div
      style={{ '--c': col, '--r': row } as CSSProperties}
      className={cn(
        'contents',
        'min-[1440px]:block min-[1440px]:min-w-0 min-[1440px]:pointer-events-auto min-[1440px]:[grid-column:var(--c)] min-[1440px]:[grid-row:var(--r)]',
        row === 1 ? 'min-[1440px]:self-stretch' : 'min-[1440px]:mt-4',
      )}
    >
      {children}
    </div>
  );
}

/** Statistiques d'équipe d'un côté : valeurs seules, sans les mesures comparées au centre ; une ligne à 0 des deux équipes est omise. */
function TeamStats({ testId, teamName, values, rows }: { testId: string; teamName: string; values: Record<string, number>; rows: StatDef[] }) {
  return (
    <section data-testid={testId} className="rounded-md bg-surface border border-border overflow-hidden">
      <header className="px-5 py-3 border-b border-border">
        <h2 className="eyebrow truncate min-w-0">Statistiques · {teamName}</h2>
      </header>
      <dl className="px-5 py-2 divide-y divide-border">
        {rows.map((s) => (
          <div key={s.key} className="flex justify-between gap-3 py-1.5 text-sm">
            <dt className="text-fg-muted">{s.label}</dt>
            <dd className="num tabular-nums font-bold text-fg-bright">{(s.fmt ?? ((n: number) => `${Math.round(n)}`))(values[s.key] ?? 0)}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function MatchPage() {
  const { gameId } = useParams({ from: '/match/$gameId' });
  const { matchupId } = useSearch({ from: '/match/$gameId' }) as MatchSearch;
  const numericGameId = Number(gameId);
  const { data, isLoading, isError } = useLiveMatchStats(
    Number.isFinite(numericGameId) ? numericGameId : null,
    matchupId ?? null,
  );
  const burst = useMatchEventBurst(data);

  if (!matchupId) {
    // Le backend exige matchupId (format homeId-awayId-gameId) : sans lui la
    // query est désactivée et la page affichait « Match introuvable » pour un
    // match valide (lien partagé sans query param). Review 2026-08-14.
    return (
      <div className="py-20 text-center text-fg-dim text-sm">
        Lien incomplet — ouvre ce match depuis le tableau de bord ou le calendrier.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div data-testid="message-chargement" className="flex items-center justify-center py-20 text-fg-dim">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Chargement du match…
      </div>
    );
  }
  if (isError || !data) {
    return (
      <div className="space-y-3 max-w-md mx-auto text-center py-20">
        <p data-testid="message-erreur" className="text-loss-fg font-semibold">Match introuvable</p>
        <Link to="/" className="text-fg-muted underline text-sm">Retour à l'accueil</Link>
      </div>
    );
  }

  const olIsHome = data.home.id === OL_ID;
  const isLive = data.status === 'live';
  const isUpcoming = data.status === 'upcoming';
  const clock = deriveClock(data);
  const isPaused = clock.phase === 'half-time';

  // Buts pour marquer le momentum : un csc profite à l'adversaire.
  const goalMinutes = data.events
    .filter((e) => e.type === 'goal' || e.type === 'penalty_goal' || e.type === 'own_goal')
    .map((e) => ({
      minute: Math.max(1, Math.floor(e.gameTime)),
      home: (e.competitorId === data.home.id) !== (e.type === 'own_goal'),
    }));
  // Noms courts pour le tooltip de la carte des tirs.
  const playerNames: Record<number, string> = {};
  if (data.lineups) {
    for (const l of [data.lineups.home, data.lineups.away]) {
      for (const p of [...l.starters, ...l.bench]) playerNames[p.id] = p.shortName;
    }
  }
  const homeScorers = scorersFor(data.events, data.home.id, data.away.id);
  const awayScorers = scorersFor(data.events, data.away.id, data.home.id);
  // Chaque côté porte son équipe : domicile à gauche, visiteur à droite ; la couleur suit le club (R5).
  const homeLineup = data.lineups?.home ?? null;
  const awayLineup = data.lineups?.away ?? null;
  const reserveBand = !!(homeLineup?.probable || awayLineup?.probable);
  const nonZero = (list: StatDef[]) =>
    list.filter((s) => (data.teamStats.home[s.key] ?? 0) !== 0 || (data.teamStats.away[s.key] ?? 0) !== 0);
  const comparedRows = nonZero(COMPARED_STATS);
  const teamRows = nonZero(TEAM_STATS);
  const hasSides = !!homeLineup || !!awayLineup || teamRows.length > 0;

  return (
    <div className="space-y-4">
      {burst && <MatchEventBurst key={burst.id} type={burst.type} />}
      <h1 className="sr-only">{data.home.name} – {data.away.name}</h1>
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg">
        <ArrowLeft className="h-4 w-4" /> Accueil
      </Link>

      {/* Header */}
      <section data-testid="entete-score" className="rounded-md bg-surface border border-border overflow-hidden">
        <header className="px-5 py-3 flex items-center justify-between border-b border-border">
          <div className="flex items-center gap-2">
            {isPaused ? (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-fg-muted/20 text-fg text-[10px] font-bold uppercase tracking-wider">
                <Pause className="h-3 w-3" strokeWidth={2.5} />
                Pause
              </span>
            ) : isLive ? (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-ol-red text-white text-[10px] font-bold uppercase tracking-wider">
                <Radio className="h-3 w-3 animate-pulse" strokeWidth={2.5} />
                Live
              </span>
            ) : isUpcoming ? (
              <span className="inline-flex items-center gap-1.5 text-fg-muted text-[10px] font-bold uppercase tracking-wider">
                <Clock className="h-3 w-3" strokeWidth={2.5} />
                À venir
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-fg-muted text-[10px] font-bold uppercase tracking-wider">
                {clock.phase === 'suspended' ? <Pause className="h-3 w-3" strokeWidth={2.5} /> : <Trophy className="h-3 w-3" strokeWidth={2.5} />}
                {clock.phase === 'suspended' ? clock.label : 'Terminé'}
              </span>
            )}
            <span className="text-xs text-fg-muted">{data.competitionName}</span>
          </div>
          <span className={cn(
            'text-xs num tabular-nums font-semibold',
            clock.isActive ? 'text-fg-bright' : 'text-fg-muted',
          )}>{clock.label}</span>
        </header>
        <div className="px-5 py-3 grid grid-cols-[1fr_auto_1fr] items-center gap-x-4 gap-y-1">
          <div className="text-right">
            <div className={cn('font-display font-bold text-2xl leading-none', olIsHome && 'text-ol-red-bright')}>
              {data.home.name}
            </div>
          </div>
          <div className="text-5xl font-bold tabular-nums num text-fg-bright">
            <MatchScore home={data.home} away={data.away} status={data.status} sepClass="mx-2" />
          </div>
          <div>
            <div className={cn('font-display font-bold text-2xl leading-none', !olIsHome && 'text-ol-red-bright')}>
              {data.away.name}
            </div>
          </div>
          {(homeScorers.length > 0 || awayScorers.length > 0) && (
            <>
              <Scorers items={homeScorers} align="right" />
              <div className="text-center text-fg-dim">⚽</div>
              <Scorers items={awayScorers} align="left" />
            </>
          )}
        </div>
      </section>

      {/* Écran de match (L160) : à partir de 1440 px, trois colonnes indépendantes — domicile à gauche,
          match au centre, visiteur à droite ; dessous, une seule colonne dans l'ordre du DOM. Le centre
          est coupé en deux (haut, puis les côtés, puis bas) pour que le DOM suive l'ordre de lecture. */}
      <div
        data-testid="grille-match"
        className={cn(
          'flex flex-col gap-4',
          'min-[1440px]:grid min-[1440px]:grid-cols-[280px_minmax(0,1fr)_280px] min-[1440px]:grid-rows-[auto_auto_1fr] min-[1440px]:gap-x-4 min-[1440px]:gap-y-0 min-[1440px]:items-start',
        )}
      >
        <div data-testid="colonne-centre" className={cn('flex flex-col gap-4 min-w-0', 'min-[1440px]:col-start-2 min-[1440px]:row-start-1')}>
          {data.events.length > 0 && (
            <section data-testid="faits-match" className="rounded-md bg-surface border border-border overflow-hidden">
              <header className="px-5 py-3 border-b border-border">
                <h2 className="eyebrow truncate min-w-0">Faits du match</h2>
              </header>
              <div className="px-5 py-2 divide-y divide-border">
                {data.events.map((e, i) => (
                  <TimelineRow
                    key={`${e.gameTime}-${i}`}
                    event={e}
                    homeId={data.home.id}
                    homeSymbol={data.home.symbolicName}
                    awaySymbol={data.away.symbolicName}
                  />
                ))}
              </div>
            </section>
          )}
          {!!data.momentum && data.momentum.length > 0 && (
            <MomentumChart
              points={data.momentum}
              homeName={data.home.name}
              awayName={data.away.name}
              goalMinutes={goalMinutes}
              homeIsOl={olIsHome}
            />
          )}
          {data.shots.length > 0 && (
            <ShotMap
              shots={data.shots}
              homeId={data.home.id}
              homeIsOl={olIsHome}
              homeName={data.home.name}
              awayName={data.away.name}
              homeSymbol={data.home.symbolicName}
              awaySymbol={data.away.symbolicName}
              playerNames={playerNames}
            />
          )}
          <section data-testid="bloc-statistiques" className="rounded-md bg-surface border border-border overflow-hidden">
            <header className="px-5 py-3 border-b border-border">
              <h2 className="eyebrow truncate min-w-0">Statistiques</h2>
            </header>
            <div className="px-5 py-3 space-y-2">
              {comparedRows.map((s) => (
                <StatRow
                  key={s.key}
                  label={s.label}
                  home={data.teamStats.home[s.key] ?? 0}
                  away={data.teamStats.away[s.key] ?? 0}
                  fmt={s.fmt}
                  homeIsOl={olIsHome}
                />
              ))}
              {comparedRows.length === 0 && (
                <p data-testid="message-stats-vide" className="text-xs text-fg-dim py-4 text-center">Pas encore de statistiques.</p>
              )}
            </div>
          </section>
        </div>

        {hasSides && (
          <div
            className={cn(
              'contents',
              'min-[1440px]:grid min-[1440px]:[grid-column:1/-1] min-[1440px]:[grid-row:1/-1] min-[1440px]:grid-cols-[280px_minmax(0,1fr)_280px] min-[1440px]:grid-rows-[auto_auto]',
              'min-[1440px]:gap-x-4 min-[1440px]:gap-y-0 min-[1440px]:items-start min-[1440px]:self-start min-[1440px]:pointer-events-none',
            )}
          >
            {homeLineup && (
              <SideCell col={1} row={1}>
                <LineupCard lineup={homeLineup} teamName={data.home.name} accent={olIsHome ? 'red' : 'blue'} reserveBand={reserveBand} />
              </SideCell>
            )}
            {teamRows.length > 0 && (
              <SideCell col={1} row={2}>
                <TeamStats testId="stats-equipe-domicile" teamName={data.home.name} values={data.teamStats.home} rows={teamRows} />
              </SideCell>
            )}
            {awayLineup && (
              <SideCell col={3} row={1}>
                <LineupCard lineup={awayLineup} teamName={data.away.name} accent={olIsHome ? 'blue' : 'red'} reserveBand={reserveBand} />
              </SideCell>
            )}
            {teamRows.length > 0 && (
              <SideCell col={3} row={2}>
                <TeamStats testId="stats-equipe-visiteur" teamName={data.away.name} values={data.teamStats.away} rows={teamRows} />
              </SideCell>
            )}
          </div>
        )}

        {(data.topPerformers.length > 0 || !!data.standings) && (
          <div
            data-testid="colonne-centre-bas"
            className={cn('contents', 'min-[1440px]:flex min-[1440px]:flex-col min-[1440px]:gap-4 min-[1440px]:min-w-0 min-[1440px]:mt-4 min-[1440px]:col-start-2 min-[1440px]:row-start-2')}
          >
            {data.topPerformers.length > 0 && (
              <section data-testid="joueurs-en-vue" className="rounded-md bg-surface border border-border overflow-hidden">
                <header className="px-5 py-3 border-b border-border">
                  <h2 className="eyebrow truncate min-w-0">Joueurs en vue</h2>
                </header>
                <div className="px-5 py-2 divide-y divide-border">
                  {data.topPerformers.map((tp, i) => (
                    <div key={i} className="py-1.5">
                      <div className="text-[10px] uppercase tracking-wider text-fg-dim text-center mb-0.5 whitespace-nowrap">
                        {tp.role}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <PerformerCell player={tp.homePlayer} align="right" />
                        <PerformerCell player={tp.awayPlayer} align="left" />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
            {!!data.standings && <MiniStandings rows={data.standings} />}
          </div>
        )}
      </div>
    </div>
  );
}
