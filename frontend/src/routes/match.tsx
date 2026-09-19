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
import { cn } from '@/lib/utils';
import { OL_365SCORES_ID as OL_ID, type LiveMatchTimelineEvent } from '@/types/api';

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

const STAT_DISPLAY: { key: string; label: string; fmt?: (n: number) => string; isPercent?: boolean }[] = [
  { key: 'Touches', label: 'Possession (touches)' },
  { key: 'Tirs au total', label: 'Tirs' },
  { key: 'Tirs cadrés', label: 'Tirs cadrés' },
  { key: 'Buts attendus', label: 'xG (buts attendus)', fmt: (n) => n.toFixed(2) },
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
}: {
  label: string;
  home: number;
  away: number;
  fmt?: (n: number) => string;
}) {
  const total = home + away;
  const pctHome = total > 0 ? (home / total) * 100 : 50;
  const f = fmt ?? ((n: number) => `${Math.round(n)}`);

  return (
    <div className="grid grid-cols-[60px_1fr_60px] items-center gap-3">
      <span className="text-right num tabular-nums font-bold text-fg-bright">{f(home)}</span>
      <div>
        <div className="text-[10px] uppercase tracking-wider text-fg-muted text-center mb-1">{label}</div>
        <div className="relative h-2 rounded-full bg-surface-2 overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 bg-ol-red rounded-full transition-all"
            style={{ width: `${pctHome}%` }}
          />
          <div
            className="absolute inset-y-0 right-0 bg-ol-blue rounded-full transition-all"
            style={{ width: `${100 - pctHome}%` }}
          />
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
    <div className="grid grid-cols-[1fr_60px_1fr] items-center gap-3 py-1">
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
      <div className="flex items-center justify-center py-20 text-fg-dim">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Chargement du match…
      </div>
    );
  }
  if (isError || !data) {
    return (
      <div className="space-y-3 max-w-md mx-auto text-center py-20">
        <p className="text-loss font-semibold">Match introuvable</p>
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
  // Compos : OL à gauche (sous « Joueurs en vue »), adversaire à droite (sous les stats).
  const olLineup = data.lineups ? (olIsHome ? data.lineups.home : data.lineups.away) : null;
  const oppLineup = data.lineups ? (olIsHome ? data.lineups.away : data.lineups.home) : null;
  const olSide = olIsHome ? data.home : data.away;
  const oppSide = olIsHome ? data.away : data.home;
  const statRows = STAT_DISPLAY.filter((s) => (data.teamStats.home[s.key] ?? 0) !== 0 || (data.teamStats.away[s.key] ?? 0) !== 0);

  return (
    <div className="space-y-4">
      {burst && <MatchEventBurst key={burst.id} type={burst.type} />}
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg">
        <ArrowLeft className="h-4 w-4" /> Accueil
      </Link>

      {/* Header */}
      <section className="rounded-md bg-surface border border-border overflow-hidden">
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
            {data.home.score ?? '-'}<span className="text-fg-dim mx-2">·</span>{data.away.score ?? '-'}
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

      {/* Grille tableau de bord : faits + joueurs | carte des tirs | stats.
          En dessous de xl, empilement dans l'ordre de lecture. */}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,4fr)_minmax(0,5fr)_minmax(0,4fr)] 2xl:grid-cols-[minmax(0,3fr)_minmax(0,5fr)_minmax(0,4fr)] xl:items-start">
      <div className="space-y-4 min-w-0">
      {/* Timeline */}
      {data.events.length > 0 && (
        <section className="rounded-md bg-surface border border-border overflow-hidden">
          <header className="px-5 py-3 border-b border-border">
            <div className="eyebrow">Faits du match</div>
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

      {/* Top performers */}
      {data.topPerformers.length > 0 && (
        <section className="rounded-md bg-surface border border-border overflow-hidden">
          <header className="px-5 py-3 border-b border-border">
            <div className="eyebrow">Joueurs en vue</div>
          </header>
          <div className="px-5 py-2 divide-y divide-border">
            {data.topPerformers.map((tp, i) => (
              <div key={i} className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 py-2">
                <div className="text-right min-w-0">
                  {tp.homePlayer ? (
                    <>
                      <div className="font-semibold text-fg text-sm truncate">{tp.homePlayer.name}</div>
                      <div className="text-xs text-fg-muted">{tp.homePlayer.statName}: <span className="num tabular-nums font-semibold text-fg">{tp.homePlayer.statValue}</span></div>
                    </>
                  ) : <span className="text-fg-dim text-xs">—</span>}
                </div>
                <div className="text-[10px] uppercase tracking-wider text-fg-dim text-center px-2 whitespace-nowrap">
                  {tp.role}
                </div>
                <div className="text-left min-w-0">
                  {tp.awayPlayer ? (
                    <>
                      <div className="font-semibold text-fg text-sm truncate">{tp.awayPlayer.name}</div>
                      <div className="text-xs text-fg-muted">{tp.awayPlayer.statName}: <span className="num tabular-nums font-semibold text-fg">{tp.awayPlayer.statValue}</span></div>
                    </>
                  ) : <span className="text-fg-dim text-xs">—</span>}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
      {olLineup && <LineupCard lineup={olLineup} teamName={olSide.name} accent="red" />}
      {data.standings && <MiniStandings rows={data.standings} />}
      </div>

      {/* Shot map + momentum */}
      <div className="min-w-0 space-y-4">
      {data.momentum && data.momentum.length > 0 && (
        <MomentumChart
          points={data.momentum}
          homeName={data.home.name}
          awayName={data.away.name}
          goalMinutes={goalMinutes}
        />
      )}
      {data.shots.length > 0 && (
        <ShotMap
          shots={data.shots}
          homeId={data.home.id}
          homeName={data.home.name}
          awayName={data.away.name}
          homeSymbol={data.home.symbolicName}
          awaySymbol={data.away.symbolicName}
          playerNames={playerNames}
        />
      )}
      </div>

      {/* Stats + compo adverse */}
      <div className="space-y-4 min-w-0">
      <section className="rounded-md bg-surface border border-border overflow-hidden">
        <header className="px-5 py-3 border-b border-border">
          <div className="eyebrow">Statistiques</div>
        </header>
        <div className="px-5 py-3 space-y-2">
          {statRows.map((s) => (
            <StatRow
              key={s.key}
              label={s.label}
              home={data.teamStats.home[s.key] ?? 0}
              away={data.teamStats.away[s.key] ?? 0}
              fmt={s.fmt}
            />
          ))}
          {statRows.length === 0 && <p className="text-xs text-fg-dim py-4 text-center">Pas encore de statistiques.</p>}
        </div>
      </section>
      {oppLineup && <LineupCard lineup={oppLineup} teamName={oppSide.name} accent="blue" />}
      </div>
      </div>
    </div>
  );
}
