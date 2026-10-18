import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useParams, useSearch, Link } from '@tanstack/react-router';
import { Loader2, Radio, ArrowLeft, Pause, Trophy, Clock } from 'lucide-react';
import { useLiveMatchStats } from '@/hooks/use-live-match';
import { useMatchEventBurst } from '@/hooks/use-match-event-burst';
import { ShotMap } from '@/components/shot-map';
import { MomentumChart } from '@/components/momentum-chart';
import { LineupCard } from '@/components/lineup-card';
import { MiniStandings } from '@/components/mini-standings';
import { MatchEventBurst } from '@/components/match-event-burst';
import { clubSymbol } from '@/lib/club-symbol';
import { deriveClock } from '@/lib/match-clock';
import { DATE_AND_KICKOFF_TBD, KICKOFF_TBD, formatKickoffDayShort, kickoffTime, shortDate, unconfirmedDay } from '@/lib/kickoff';
import { MatchScore } from '@/components/match-score';
import { cn } from '@/lib/utils';
import { FRANCE_365SCORES_ID, isFranceMatchup, teamColors, type MatchPalette } from '@/lib/match-palette';
import { OL_365SCORES_ID as OL_ID, type LiveMatchTimelineEvent, type LiveMatchTopPerformer } from '@/types/api';
import { estIntrouvable } from '@/lib/api';

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
  goal_cancelled: '🚫 But annulé (VAR)',
  woodwork: '🥅 Poteau',
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
  palette,
}: {
  label: string;
  home: number;
  away: number;
  fmt?: (n: number) => string;
  homeIsOl: boolean;
  palette: MatchPalette;
}) {
  const total = home + away;
  const pctHome = total > 0 ? (home / total) * 100 : 50;
  const f = fmt ?? ((n: number) => `${Math.round(n)}`);

  return (
    <div className="[display:grid] [grid-template-columns:60px_1fr_60px] items-center gap-3">
      <span className="text-right num tabular-nums font-bold text-fg-bright">{f(home)}</span>
      <div>
        <div className="text-[10px] uppercase tracking-wider text-fg-muted text-center mb-1">{label}</div>
        {/* La couleur suit l'équipe suivie (OL rouge, adversaire bleu ; France bleue, adversaire blanc), pas le côté ; 2 px de --surface entre les segments. */}
        <div className="flex gap-0.5 h-2 rounded-full bg-surface overflow-hidden">
          {home > 0 && <div className={cn('transition-all', teamColors(palette, homeIsOl).bg)} style={{ flexGrow: pctHome, flexBasis: 0 }} />}
          {away > 0 && <div className={cn('transition-all', teamColors(palette, !homeIsOl).bg)} style={{ flexGrow: 100 - pctHome, flexBasis: 0 }} />}
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
  // Remplacement : playerId = entrant, extraPlayer = sortant (365scores type 1000).
  const isSub = event.type === 'substitution';
  const out = event.extraPlayerShortName ?? event.extraPlayerName;
  const label = isSub && who && out ? `${base} · ${who} ↔ ${out}` : who ? `${base} · ${who}` : base;
  // Tooltip : nom complet, et entrant ↔ sortant ou passeur selon l'événement.
  let tooltip: string | undefined;
  if (event.playerName) {
    if (isSub && event.extraPlayerName) tooltip = `${event.playerName} (entrant) ↔ ${event.extraPlayerName} (sortant)`;
    else if (event.extraPlayerName) tooltip = `${event.playerName} — passe : ${event.extraPlayerName}`;
    else tooltip = event.playerName;
  }
  const dim = 'text-fg-dim';
  return (
    <div className="ev">
      <div className={cn('evl', !isHome && dim)}>
        {isHome && <span className="fw" title={tooltip}>{label}</span>}
      </div>
      <div className="evm">
        <span className="num tabular-nums text-xs font-bold text-fg-bright">{event.gameTimeDisplay}</span>
        <small>{isHome ? homeSymbol : awaySymbol}</small>
      </div>
      <div className={cn('evr', isHome && dim)}>
        {!isHome && <span className="fw" title={tooltip}>{label}</span>}
      </div>
    </div>
  );
}

/** Nombre de faits entièrement au-dessus du bord haut de la liste (R3). */
function hiddenAbove(list: HTMLElement): number {
  const top = list.getBoundingClientRect().top;
  let n = 0;
  list.querySelectorAll('.ev').forEach((ev) => {
    if (ev.getBoundingClientRect().bottom <= top + 0.5) n += 1;
  });
  return n;
}

/**
 * Faits du match (L161) : la liste est bornée à cinq lignes (CSS `.faits-liste`) et s'ouvre sur les plus
 * récents (column-reverse, le DOM reste chronologique). Le repère au-dessus dit combien de faits sont hors
 * de la vue en haut et remonte la liste d'une hauteur de liste au clic.
 */
function FaitsMatch({ events, homeId, homeSymbol, awaySymbol }: {
  events: LiveMatchTimelineEvent[]; homeId: number; homeSymbol: string; awaySymbol: string;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState(false);
  const [above, setAbove] = useState(0);

  const measure = useCallback(() => {
    const list = listRef.current;
    if (!list) return;
    setOverflow(list.scrollHeight > list.clientHeight + 1);
    setAbove(hiddenAbove(list));
  }, []);

  useLayoutEffect(() => {
    measure();
    const list = listRef.current;
    if (!list || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(list);
    return () => ro.disconnect();
  }, [measure, events.length]);

  const remonter = () => {
    const list = listRef.current;
    if (!list || above === 0) return;
    list.scrollBy({ top: -list.clientHeight, behavior: 'smooth' });
  };

  return (
    <section data-testid="faits-match" className="faits-bloc rounded-md bg-surface">
      <header className="px-5 py-3 border-b border-border flex items-center justify-between gap-3">
        <h2 className="eyebrow min-w-0">Faits du match</h2>
        <span data-testid="compte-faits" className="num text-xs text-fg-dim">
          {events.length} {events.length > 1 ? 'faits' : 'fait'}
        </span>
      </header>
      {overflow && (
        <button
          type="button"
          data-testid="repere-faits-anciens"
          aria-disabled={above === 0}
          onClick={remonter}
          className="faits-repere"
        >
          {above === 0 ? (
            <span>Début du match</span>
          ) : (
            <>
              <span aria-hidden="true">↑</span>
              <span>{above} {above > 1 ? 'faits plus anciens' : 'fait plus ancien'}</span>
            </>
          )}
        </button>
      )}
      <div
        ref={listRef}
        data-testid="liste-faits"
        className="faits-liste"
        onScroll={measure}
        {...(overflow ? { tabIndex: 0, role: 'region', 'aria-label': 'Faits du match, du plus ancien au plus récent' } : {})}
      >
        <div className="faits-liste-in">
          {events.map((e, i) => (
            <TimelineRow key={`${e.gameTime}-${i}`} event={e} homeId={homeId} homeSymbol={homeSymbol} awaySymbol={awaySymbol} />
          ))}
        </div>
      </div>
    </section>
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

function Scorers({ items, align, reflow = false }: { items: { name: string; marks: string }[]; align: 'right' | 'left'; reflow?: boolean }) {
  if (!items.length) return <div />;
  return (
    <ul className={cn('space-y-0.5 text-xs text-fg-muted', align === 'right' ? 'text-right' : 'text-left')}>
      {items.map((s) => (
        <li key={s.name}>
          <span className="text-fg">{s.name}</span>{' '}
          {/* Sous 390 px, les minutes passent à la ligne sous le nom : « Lukébakio 35' » n'est jamais coupé (L167 R13). */}
          <span className={cn('num tabular-nums text-fg-dim', reflow && 'whitespace-nowrap max-[389px]:block')}>{s.marks}</span>
        </li>
      ))}
    </ul>
  );
}

// `leading-none` vient APRÈS la classe de taille : tailwind-merge (`cn`) supprime l'interligne posé avant un `text-*` (L167 R12).
// Mode Bleus : `min-[390px]:text-lg` et `min-[600px]:text-2xl` portent leur propre interligne (28 et 32 px) et battent le
// `leading-none` de base dans leur media query — d'où un `leading-none` par palier.
const NOM_EQUIPE = 'font-display font-bold';
const NOM_EQUIPE_OL = 'text-2xl leading-none';
/**
 * En-tête d'un match des Bleus (L167 R13) : noms jamais coupés ni cachés. Grille minmax(0,1fr) auto minmax(0,1fr), noms qui
 * passent à la ligne (`overflow-wrap:anywhere`) à 24 px au-dessus de 600 px, 18 px dessous, 16 px sous 390 px. Comme la
 * maquette (`.sc`) : jusqu'à 599 px marge latérale 12 px, écart 8 px, score à 36 px ; sous 360 px marge 6 px, écart 4 px,
 * score à 32 px — à 390 px « Bosnie-Herzégovine » tient sur deux lignes, sans coupure dans le mot.
 */
const ENTETE_BLEUS = 'grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] max-[599px]:px-3 max-[599px]:gap-x-2 max-[359px]:px-[6px] max-[359px]:gap-x-1';
/** Comme `.big` de la maquette : 44 px, 36 px jusqu'à 599 px, 32 px sous 360 px, gras, blanc, PAS de police mono ni de chiffres tabulaires (la mono prenait 82 px à 36 px, Inter tabulaire 74 px, Inter 68 px). */
const SCORE_BLEUS = 'font-sans font-bold text-[44px] text-white max-[599px]:text-[36px] max-[359px]:text-[32px]';
/** Séparateur du score des Bleus : 4 px par côté sous 600 px (les colonnes de nom gagnent 8 px : « Bosnie-Herzégovine » sur deux lignes même à 0·0), 8 px au-dessus (L167 R13). */
const SEP_SCORE_BLEUS = 'mx-1 min-[600px]:mx-2';
const SCORE_OL = 'text-5xl font-bold tabular-nums num text-fg-bright';
const NOM_EQUIPE_BLEUS = '[overflow-wrap:anywhere] text-base min-[390px]:text-lg min-[600px]:text-2xl leading-none min-[390px]:leading-none min-[600px]:leading-none';

/**
 * « Jeu. 12/11 · 21h00 » : le format de /equipe-de-france (L113, `shortDate` + `kickoffTime`) ;
 * « Jeu. 12/11 · Horaire à confirmer » pour les Bleus quand la réponse dit l'heure non fixée (L168).
 * Match de l'OL sans horaire fixé : le jour de remplissage n'est jamais affiché, la règle L47 du
 * calendrier s'applique (« Week-end du 10/10 · Horaire à confirmer », sinon « Date et horaire à confirmer »).
 */
function kickoffLabel(match: { startTime: string; timeConfirmed?: boolean }, bleus: boolean): string {
  const k = { date: match.startTime, timeConfirmed: match.timeConfirmed };
  const unconfirmed = bleus ? null : unconfirmedDay(k);
  if (unconfirmed?.kind === 'unknown') return DATE_AND_KICKOFF_TBD;
  if (unconfirmed) return `${formatKickoffDayShort(k)} · ${KICKOFF_TBD}`;
  return `${shortDate(match.startTime)} · ${kickoffTime(k) ?? KICKOFF_TBD}`;
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
        <h2 className="eyebrow min-w-0">Statistiques · {teamName}</h2>
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
  const { data, isLoading, error, refetch } = useLiveMatchStats(
    Number.isFinite(numericGameId) ? numericGameId : null,
    matchupId ?? null,
  );
  const burst = useMatchEventBurst(data);
  // Décidé sur l'URL et non sur la réponse : le thème est là dès le chargement, sans bascule rouge puis bleue (L167 R3).
  const bleus = isFranceMatchup(matchupId);
  useEffect(() => {
    if (!bleus) return;
    document.body.classList.add('theme-bleus');
    return () => document.body.classList.remove('theme-bleus');
  }, [bleus]);

  if (!matchupId) {
    // Le backend exige matchupId (format homeId-awayId-gameId) : sans lui la
    // query est désactivée et la page affichait « Match introuvable » pour un
    // match valide (lien partagé sans query param). Review 2026-08-14.
    return (
      <div className="py-20 text-center text-fg-dim text-sm">
        <h1>Lien incomplet — ouvre ce match depuis le tableau de bord ou le calendrier.</h1>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div data-testid="message-chargement" className="flex items-center justify-center py-20 text-fg-dim">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        <h1>Chargement du match…</h1>
      </div>
    );
  }
  if (!data) {
    // Un échec de rafraîchissement avec le match déjà affiché n'efface rien : seule l'absence de données mène ici (L181).
    // 404 = match inconnu ; toute autre erreur (réseau, 5xx) est une panne, qu'un nouvel essai peut lever (L181).
    // Sans objet d'erreur (cas non réseau), on garde « introuvable ».
    const panne = error != null && !estIntrouvable(error);
    return (
      <div className="space-y-3 max-w-md mx-auto text-center py-20">
        <h1 data-testid="message-erreur" className="text-loss-fg font-semibold">
          {panne ? 'Impossible de charger le match' : 'Match introuvable'}
        </h1>
        {panne && (
          <button type="button" onClick={() => void refetch()} className="rounded border border-border px-3 py-1.5 text-sm text-fg">
            Réessayer
          </button>
        )}
        {bleus ? (
          <Link to="/equipe-de-france" data-testid="lien-retour-erreur" className="text-fg-muted underline text-sm">Retour à l'équipe de France</Link>
        ) : (
          <Link to="/" data-testid="lien-retour-erreur" className="text-fg-muted underline text-sm">Retour à l'accueil</Link>
        )}
      </div>
    );
  }

  const palette: MatchPalette = bleus ? 'bleus' : 'ol';
  // L'équipe suivie (OL, ou France sur un match des Bleus) porte la couleur « principale » ; « OL » reste le sigle du seul club OL.
  const trackedIsHome = data.home.id === (bleus ? FRANCE_365SCORES_ID : OL_ID);
  const symbolIsOl = !bleus;
  const isLive = data.status === 'live';
  const isUpcoming = data.status === 'upcoming';
  const clock = isUpcoming ? { phase: 'upcoming' as const, label: 'À VENIR', isActive: false } : deriveClock(data);
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
      {bleus ? (
        <Link to="/equipe-de-france" data-testid="lien-retour-equipe" className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Équipe de France
        </Link>
      ) : (
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg">
          <ArrowLeft className="h-4 w-4" /> Accueil
        </Link>
      )}

      {/* Header */}
      <section data-testid="entete-score" className="rounded-md bg-surface border border-border overflow-hidden">
        <header className="px-5 py-3 flex items-center justify-between flex-wrap gap-x-3 gap-y-1 border-b border-border">
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
          {isUpcoming && bleus ? (
            <span data-testid="coup-envoi" className="text-xs num tabular-nums font-semibold text-fg-muted whitespace-nowrap">
              {kickoffLabel(data, bleus)}
            </span>
          ) : isUpcoming ? (
            <span className="flex items-center gap-2 text-xs num tabular-nums font-semibold text-fg-muted">
              <span data-testid="coup-envoi" className="min-w-0">{kickoffLabel(data, bleus)}</span>
              <span className="shrink-0 whitespace-nowrap">{clock.label}</span>
            </span>
          ) : (
            <span className={cn(
              'text-xs num tabular-nums font-semibold',
              clock.isActive ? 'text-fg-bright' : 'text-fg-muted',
            )}>{clock.label}</span>
          )}
        </header>
        <div className={cn('px-5 py-3 grid items-center gap-x-4 gap-y-1', bleus ? ENTETE_BLEUS : 'grid-cols-[1fr_auto_1fr]')}>
          <div className="text-right">
            <div className={cn(NOM_EQUIPE, bleus ? NOM_EQUIPE_BLEUS : NOM_EQUIPE_OL, trackedIsHome && teamColors(palette, true).text)}>
              {data.home.name}
            </div>
          </div>
          <div className={bleus ? SCORE_BLEUS : SCORE_OL}>
            <MatchScore home={data.home} away={data.away} status={data.status} sepClass={bleus ? SEP_SCORE_BLEUS : 'mx-2'} />
          </div>
          <div>
            <div className={cn(NOM_EQUIPE, bleus ? NOM_EQUIPE_BLEUS : NOM_EQUIPE_OL, !trackedIsHome && teamColors(palette, true).text)}>
              {data.away.name}
            </div>
          </div>
          {(homeScorers.length > 0 || awayScorers.length > 0) && (
            <>
              <Scorers items={homeScorers} align="right" reflow={bleus} />
              <div className="text-center text-fg-dim">⚽</div>
              <Scorers items={awayScorers} align="left" reflow={bleus} />
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
            <FaitsMatch
              events={data.events}
              homeId={data.home.id}
              homeSymbol={clubSymbol(data.home.symbolicName, data.home.name, symbolIsOl && trackedIsHome)}
              awaySymbol={clubSymbol(data.away.symbolicName, data.away.name, symbolIsOl && !trackedIsHome)}
            />
          )}
          {!!data.momentum && data.momentum.length > 0 && (
            <MomentumChart
              points={data.momentum}
              homeName={data.home.name}
              awayName={data.away.name}
              goalMinutes={goalMinutes}
              homeIsOl={trackedIsHome}
              palette={palette}
            />
          )}
          {data.shots.length > 0 && (
            <ShotMap
              shots={data.shots}
              homeId={data.home.id}
              homeIsOl={trackedIsHome}
              palette={palette}
              homeName={data.home.name}
              awayName={data.away.name}
              homeSymbol={data.home.symbolicName}
              awaySymbol={data.away.symbolicName}
              playerNames={playerNames}
            />
          )}
          <section data-testid="bloc-statistiques" className="rounded-md bg-surface border border-border overflow-hidden">
            <header className="px-5 py-3 border-b border-border">
              <h2 className="eyebrow min-w-0">Statistiques</h2>
            </header>
            <div className="px-5 py-3 space-y-2">
              {comparedRows.map((s) => (
                <StatRow
                  key={s.key}
                  label={s.label}
                  home={data.teamStats.home[s.key] ?? 0}
                  away={data.teamStats.away[s.key] ?? 0}
                  fmt={s.fmt}
                  homeIsOl={trackedIsHome}
                  palette={palette}
                />
              ))}
              {comparedRows.length === 0 && (
                <p data-testid="message-stats-vide" className="text-xs text-fg-dim py-4 text-center">
                  {bleus && isUpcoming ? 'Les statistiques apparaîtront au coup d’envoi.' : 'Pas encore de statistiques.'}
                </p>
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
                <LineupCard lineup={homeLineup} teamName={data.home.name} accent={bleus ? (trackedIsHome ? 'france' : 'adverse') : trackedIsHome ? 'red' : 'blue'} reserveBand={reserveBand} />
              </SideCell>
            )}
            {teamRows.length > 0 && (
              <SideCell col={1} row={2}>
                <TeamStats testId="stats-equipe-domicile" teamName={data.home.name} values={data.teamStats.home} rows={teamRows} />
              </SideCell>
            )}
            {awayLineup && (
              <SideCell col={3} row={1}>
                <LineupCard lineup={awayLineup} teamName={data.away.name} accent={bleus ? (trackedIsHome ? 'adverse' : 'france') : trackedIsHome ? 'blue' : 'red'} reserveBand={reserveBand} />
              </SideCell>
            )}
            {teamRows.length > 0 && (
              <SideCell col={3} row={2}>
                <TeamStats testId="stats-equipe-visiteur" teamName={data.away.name} values={data.teamStats.away} rows={teamRows} />
              </SideCell>
            )}
          </div>
        )}

        {(data.topPerformers.length > 0 || isUpcoming || !!data.standings) && (
          <div
            data-testid="colonne-centre-bas"
            className={cn('contents', 'min-[1440px]:flex min-[1440px]:flex-col min-[1440px]:gap-4 min-[1440px]:min-w-0 min-[1440px]:mt-4 min-[1440px]:col-start-2 min-[1440px]:row-start-2')}
          >
            {(data.topPerformers.length > 0 || isUpcoming) && (
              <section data-testid="joueurs-en-vue" className="rounded-md bg-surface border border-border overflow-hidden">
                <header className="px-5 py-3 border-b border-border">
                  <h2 className="eyebrow min-w-0">Joueurs en vue</h2>
                </header>
                <div className="px-5 py-2 divide-y divide-border">
                  {data.topPerformers.length === 0 && (
                    <p data-testid="message-joueurs-en-vue-vide" className="text-xs text-fg-dim py-4 text-center">
                      Les joueurs en vue apparaîtront avec les statistiques du match.
                    </p>
                  )}
                  {data.topPerformers.map((tp, i) => (
                    <div key={i} className="py-1.5">
                      <div className="text-[10px] uppercase tracking-wider text-fg-dim text-center mb-0.5 whitespace-nowrap">
                        {tp.role}
                      </div>
                      <div className="[display:grid] [grid-template-columns:repeat(2,minmax(0,1fr))] gap-3">
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
