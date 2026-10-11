import { useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { useFrance } from '@/hooks/use-france';
import { TeamLogo } from '@/components/team-logo';
import { clubLogoUrl } from '@/lib/ligue1-clubs-coords';
import { KICKOFF_TBD, kickoffTime } from '@/lib/kickoff';
import { cn } from '@/lib/utils';
import type { FranceNextMatch, FrancePlayer, FranceResult, FranceTeam } from '@/types/api';

const WEEKDAY_SHORT = ['Dim.', 'Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.'];
const pad = (n: number): string => n.toString().padStart(2, '0');
const dayMonth = (d: Date): string => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
/** « Sam. 10/10 » */
const shortDate = (iso: string): string => {
  const d = new Date(iso);
  return `${WEEKDAY_SHORT[d.getDay()]} ${dayMonth(d)}`;
};

const POSITION_GROUPS = [
  { api: 'Goalkeeper', label: 'Gardiens' },
  { api: 'Defender', label: 'Défenseurs' },
  { api: 'Midfielder', label: 'Milieux' },
  { api: 'Attacker', label: 'Attaquants' },
] as const;

export function EquipeDeFrancePage() {
  const { data, isPending, isError, isFetching, refetch } = useFrance();
  // TanStack v5 : `isPending` reste faux quand des données existent déjà, « Réessayer » se lit donc sur `isFetching`.
  // Hors ligne la requête est en pause (`isPending` vrai, `isFetching` faux) : le chargement reste affiché.
  const loading = isPending || (isError && isFetching);
  const failed = isError && !isFetching;
  // Focus (WCAG 2.4.3) : le bouton disparaît pendant le nouvel appel, le focus passe donc sur la zone de statut
  // (stable), puis revient sur « Réessayer » si l'erreur revient.
  const zoneRef = useRef<HTMLElement>(null);
  const boutonRef = useRef<HTMLButtonElement>(null);
  const reessaye = useRef(false);
  useEffect(() => {
    if (failed && reessaye.current) {
      reessaye.current = false;
      boutonRef.current?.focus();
    }
  }, [failed]);
  const empty = !!data && !isError && !data.nextMatch && data.results.length === 0 && data.squad.length === 0;

  return (
    <div className="space-y-8">
      <header className="flex items-center gap-5 border-b border-border pb-6">
        <div
          aria-hidden="true"
          className="h-16 w-16 shrink-0 rounded-full border border-border lg:h-20 lg:w-20"
          style={{ background: 'linear-gradient(90deg, hsl(var(--ol-blue)) 0 33%, #fff 33% 66%, hsl(var(--ol-red)) 66%)' }}
        />
        <div className="min-w-0">
          <h1 data-testid="titre-page" className="font-display text-2xl font-bold leading-tight tracking-tight text-fg-bright lg:text-[34px]">
            Équipe de France
          </h1>
          <p data-testid="sous-titre-page" className="mt-1 text-sm text-fg-muted">
            Les Bleus · sélection masculine A
          </p>
        </div>
      </header>

      {(loading || failed) && (
        <section ref={zoneRef} data-testid="zone-statut" tabIndex={-1} aria-busy={loading} className="outline-none">
          {loading ? (
            <div role="status" className="flex flex-col items-center gap-4 py-20 text-center text-fg-muted">
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
              <p data-testid="message-chargement" className="text-sm">
                Chargement de l’équipe de France…
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 py-20 text-center">
              <p data-testid="message-erreur" role="alert" className="text-sm text-ol-red-bright">
                Impossible de charger l’équipe de France.
              </p>
              <button
                ref={boutonRef}
                type="button"
                data-testid="bouton-reessayer"
                onClick={() => {
                  reessaye.current = true;
                  zoneRef.current?.focus();
                  void refetch();
                }}
                className="min-h-[44px] rounded-md border border-ol-blue-bright bg-ol-blue px-5 text-sm font-semibold text-fg-bright"
              >
                Réessayer
              </button>
            </div>
          )}
        </section>
      )}

      {empty && (
        <p data-testid="message-vide" className="py-20 text-center text-sm text-fg-muted">
          Aucune donnée sur l’équipe de France pour le moment.
        </p>
      )}

      {data && !isError && !empty && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start">
          <div className="grid gap-6">
            <NextMatchPanel match={data.nextMatch} />
            <ResultsPanel results={data.results} />
          </div>
          <SquadPanel squad={data.squad} />
        </div>
      )}
    </div>
  );
}

function Panel({ testId, eyebrow, title, children }: { testId?: string; eyebrow: [string, string]; title: [string, string]; children: React.ReactNode }) {
  return (
    <section data-testid={testId} className="overflow-hidden rounded-md border border-border bg-surface">
      <header className="border-b border-border p-4">
        <div data-testid={eyebrow[0]} className="eyebrow">
          {eyebrow[1]}
        </div>
        <h2 data-testid={title[0]} className="mt-1.5 font-display text-xl font-bold leading-none text-fg-bright">
          {title[1]}
        </h2>
      </header>
      {children}
    </section>
  );
}

function NextMatchPanel({ match }: { match: FranceNextMatch | null }) {
  return (
    <Panel
      testId="prochain-match"
      eyebrow={['surtitre-prochain-match', 'Prochain rendez-vous']}
      title={['titre-prochain-match', 'Prochain match']}
    >
      {match ? (
        <div className="grid gap-4 px-4 py-5">
          <div className="flex items-center justify-between gap-3">
            <Side testId="prochain-match-domicile" team={match.home} />
            <span className="text-xs font-semibold text-fg-dim">VS</span>
            <Side testId="prochain-match-exterieur" team={match.away} />
          </div>
          <div className="text-center text-sm text-fg">
            <NextMatchDate match={match} />
            <small data-testid="prochain-match-competition" className="mt-1 block text-xs text-fg-muted">
              {match.competition}
            </small>
          </div>
        </div>
      ) : (
        <p data-testid="message-aucun-match" className="px-4 py-6 text-center text-sm text-fg-muted">
          Aucun match programmé.
        </p>
      )}
    </Panel>
  );
}

function Side({ testId, team }: { testId: string; team: FranceTeam }) {
  return (
    <div data-testid={testId} className="flex min-w-0 flex-1 flex-col items-center gap-2 text-center font-display font-bold text-fg-bright">
      <span aria-hidden="true">
        <TeamLogo teamId={team.id} name={team.name} size={48} src={clubLogoUrl(team.id)} />
      </span>
      <span className="[overflow-wrap:anywhere]">{team.name}</span>
    </div>
  );
}

/**
 * La date de la sélection est connue (365scores donne le jour du match) : seule l'heure
 * peut être « à confirmer » (L117). La règle L47 (jour de remplissage d'une journée de
 * Ligue 1) ne s'applique pas ici.
 */
function NextMatchDate({ match }: { match: FranceNextMatch }) {
  const time = kickoffTime(match);
  return (
    <span data-testid="prochain-match-date">
      {shortDate(match.date)} ·{' '}
      {time ?? <span data-testid="message-heure-a-confirmer">{KICKOFF_TBD}</span>}
    </span>
  );
}

function ResultsPanel({ results }: { results: FranceResult[] }) {
  return (
    <Panel eyebrow={['surtitre-derniers-resultats', 'Forme']} title={['titre-derniers-resultats', 'Derniers résultats']}>
      <ul data-testid="derniers-resultats">
        {results.map((r) => (
          <ResultRow key={r.id} result={r} />
        ))}
      </ul>
    </Panel>
  );
}

function ResultRow({ result }: { result: FranceResult }) {
  const [france, other] = result.franceIsHome ? [result.homeScore, result.awayScore] : [result.awayScore, result.homeScore];
  const outcome =
    france > other
      ? { word: 'Victoire', letter: 'V', cls: 'bg-win text-bg' }
      : france < other
        ? { word: 'Défaite', letter: 'D', cls: 'bg-loss text-fg-bright' }
        : { word: 'Match nul', letter: 'N', cls: 'bg-draw text-bg' };
  return (
    <li data-testid="resultat-ligne" className="flex items-center gap-3 border-t border-border px-4 py-3 first:border-t-0">
      <span
        data-testid="resultat-badge"
        className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded text-[11px] font-bold', outcome.cls)}
      >
        <span className="sr-only">{outcome.word}</span>
        <span aria-hidden="true">{outcome.letter}</span>
      </span>
      <div className="min-w-0 flex-1">
        <div data-testid="resultat-rencontre" className="text-sm text-fg-bright [overflow-wrap:anywhere]">
          {result.home.name} – {result.away.name}
        </div>
        <div className="mt-0.5 text-xs text-fg-dim">
          <span data-testid="resultat-competition">{result.competition}</span> ·{' '}
          <span data-testid="resultat-date">{shortDate(result.date)}</span>
        </div>
      </div>
      <span data-testid="resultat-score" className="num text-base font-semibold text-fg-bright">
        {result.homeScore}-{result.awayScore}
      </span>
    </li>
  );
}

function SquadPanel({ squad }: { squad: FrancePlayer[] }) {
  const groups = POSITION_GROUPS.map((g) => ({ label: g.label, players: squad.filter((p) => p.position === g.api) })).filter((g) => g.players.length > 0);
  return (
    <Panel eyebrow={['surtitre-effectif', 'Sélection']} title={['titre-effectif', 'Effectif']}>
      <div data-testid="effectif" className="grid gap-5 p-4 lg:grid-cols-2">
        {groups.map((g) => (
          <div key={g.label}>
            <h3 data-testid="groupe-poste-titre" className="eyebrow mb-1.5">
              {g.label} <span className="num">({g.players.length})</span>
            </h3>
            <ul>
              {g.players.map((p) => (
                <li key={p.id} data-testid="joueur-ligne" className="flex justify-between gap-3 border-t border-border py-2 text-sm">
                  <span className="text-fg-bright [overflow-wrap:anywhere]">{p.name}</span>
                  {p.age != null && <span className="num shrink-0 text-xs text-fg-dim">{p.age} ans</span>}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Panel>
  );
}
