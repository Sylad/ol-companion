import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { ListTodo, Loader2, RotateCw } from 'lucide-react';
import { NEWS_QUERY_KEY, fetchNews } from '@/lib/nouveautes';
import {
  PLAN_QUERY_KEY,
  RECENT_DAYS,
  fetchPlan,
  formatDay,
  groupPlan,
  isEmpty,
  liveTasks,
  newsSlugByLot,
  progress,
  summary,
  type PlanLot,
  type PlanStatus,
} from '@/lib/plan';
import { cn } from '@/lib/utils';

// L23 — page « Plan de travail » (portage de finance-tracker). Données publiques
// générées par `npm run plan` (frontend/scripts/plan-data.mjs) depuis
// docs/plan/raf.yaml : lots visibles, TITRES PUBLICS et états seulement, jamais
// les notes. Même grammaire de carte que les Nouveautés.

// État dit en toutes lettres ; la couleur ne fait que le souligner (bleu OL = en
// cours, neutre = prévu, contour clair = livré — pas de vert décoratif).
const STATUS_BADGE: Record<PlanStatus, { label: string; className: string }> = {
  doing: { label: 'En cours', className: 'bg-ol-blue text-fg-bright border-ol-blue-bright' },
  todo: { label: 'Prévu', className: 'bg-surface-2 text-fg border-border-strong' },
  done: { label: 'Livré', className: 'text-fg-bright border-fg-muted' },
};

const ACTION =
  'inline-flex items-center min-h-11 rounded-sm text-sm font-medium text-ol-red-bright hover:underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ol-red-bright focus-visible:ring-offset-2 focus-visible:ring-offset-surface';

const CARD = 'rounded-md border border-border bg-surface';

const plural = (n: number, one: string, many: string) => (n > 1 ? many : one);

function dateLine(lot: PlanLot): { day: string; text: string } | null {
  if (lot.status === 'done' && lot.finished) return { day: lot.finished, text: `Livré le ${formatDay(lot.finished)}` };
  if (lot.status === 'doing' && lot.started) return { day: lot.started, text: `Démarré le ${formatDay(lot.started)}` };
  return null;
}

function LotCard({ lot, newsSlug, target }: { lot: PlanLot; newsSlug?: string; target: boolean }) {
  const [open, setOpen] = useState(false);
  const p = progress(lot);
  const badge = STATUS_BADGE[lot.status];
  const date = dateLine(lot);
  const steps = liveTasks(lot).filter((t) => t.title);
  // Étapes sans titre public : comptées dans n/m (l'avancement réel), annoncées dans la liste.
  const untitled = liveTasks(lot).length - steps.length;
  const stepsId = `${lot.id}-etapes`;
  return (
    // tabIndex -1 : la carte visée par /plan#<id> reçoit le focus à l'arrivée ; bord rouge
    // OL quand elle est visée, comme une entrée des Nouveautés.
    <li
      id={lot.id}
      tabIndex={-1}
      data-target={target ? 'true' : undefined}
      className={cn(
        CARD,
        'p-5 lg:p-6 scroll-mt-20 lg:scroll-mt-6 focus:outline-none',
        target && 'border-ol-red-bright ring-1 ring-ol-red-bright',
      )}
    >
      {/* L'identifiant du lot n'est pas montré aux visiteurs : il reste l'ancre /plan#<id>. */}
      <div className="mb-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] uppercase tracking-[0.14em] text-fg-muted font-semibold">
        <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-[0.08em]', badge.className)}>
          {badge.label}
        </span>
        {/* Écart porté par le gap flex, sans « · » : rien d'orphelin quand la date passe
            à la ligne (390 / 320 px). */}
        {date && <time dateTime={date.day}>{date.text}</time>}
      </div>
      <h3 className="font-display text-lg font-bold text-fg-bright leading-snug [overflow-wrap:anywhere]">
        {lot.title}
      </h3>
      {p && (
        <div className="mt-3 flex items-center gap-3">
          <div
            className="h-1.5 flex-1 rounded-full bg-surface-2 overflow-hidden"
            role="progressbar"
            aria-label={`Avancement : ${lot.title}`}
            aria-valuemin={0}
            aria-valuemax={p.total}
            aria-valuenow={p.done}
            aria-valuetext={`${p.done} ${plural(p.done, 'étape faite', 'étapes faites')} sur ${p.total}`}
          >
            <div className="h-full bg-ol-blue-bright" style={{ width: `${(100 * p.done) / p.total}%` }} />
          </div>
          <span className="text-xs text-fg-muted tabular-nums" aria-hidden="true">
            {p.done}/{p.total} étapes
          </span>
        </div>
      )}
      {(steps.length > 0 || newsSlug) && (
        <div className="mt-2 flex flex-col items-start min-[400px]:flex-row min-[400px]:flex-wrap min-[400px]:gap-x-5">
          {steps.length > 0 && (
            <button
              type="button"
              className={ACTION}
              aria-expanded={open}
              aria-controls={stepsId}
              onClick={() => setOpen((o) => !o)}
            >
              {open ? 'Masquer les étapes' : 'Voir les étapes'}
              <span className="sr-only"> : {lot.title}</span>
            </button>
          )}
          {newsSlug && (
            <Link to="/nouveautes" hash={newsSlug} className={ACTION}>
              Voir la nouveauté<span className="sr-only"> : {lot.title}</span>
            </Link>
          )}
        </div>
      )}
      {open && (
        <ul id={stepsId} className="mt-1 space-y-1 text-sm text-fg">
          {steps.map((t, i) => (
            <li key={i} className="flex gap-2">
              <span aria-hidden="true" className={t.status === 'done' ? 'text-fg-bright' : 'text-fg-muted'}>
                {t.status === 'done' ? '✓' : '○'}
              </span>
              <span className="[overflow-wrap:anywhere]">
                {t.title}
                <span className="sr-only">{t.status === 'done' ? ' (faite)' : ' (à faire)'}</span>
              </span>
            </li>
          ))}
          {untitled > 0 && (
            <li className="text-fg-muted">
              + {untitled} {plural(untitled, 'étape non détaillée', 'étapes non détaillées')}
            </li>
          )}
        </ul>
      )}
    </li>
  );
}

function Group({
  id,
  title,
  hint,
  lots,
  empty,
  slugs,
  target,
  footer,
}: {
  id: string;
  title: string;
  hint: string;
  lots: PlanLot[];
  empty: string;
  slugs: Map<string, string>;
  target: string | null;
  footer?: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="space-y-3">
      <div>
        <h2 id={id} className="font-display text-xl lg:text-2xl font-bold text-fg-bright">
          {title} <span className="text-fg-muted font-medium">({lots.length})</span>
        </h2>
        <p className="text-sm text-fg-muted mt-1">{hint}</p>
      </div>
      {lots.length === 0 ? (
        <p className={cn(CARD, 'p-5 text-sm text-fg-muted')}>{empty}</p>
      ) : (
        <ul className="space-y-3">
          {lots.map((l) => (
            <LotCard key={l.id} lot={l} newsSlug={slugs.get(l.id)} target={target === l.id} />
          ))}
        </ul>
      )}
      {footer}
    </section>
  );
}

const NewsLink = ({ children }: { children: ReactNode }) => (
  <Link to="/nouveautes" className="text-ol-red-bright underline underline-offset-4 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ol-red-bright">
    {children}
  </Link>
);

export function PlanPage() {
  const plan = useQuery({ queryKey: PLAN_QUERY_KEY, queryFn: fetchPlan, staleTime: 5 * 60_000 });
  const news = useQuery({ queryKey: NEWS_QUERY_KEY, queryFn: fetchNews, staleTime: 5 * 60_000 });
  const slugs = newsSlugByLot(news.data?.news?.entries ?? []);

  // Lien permanent /plan#<id> : la carte n'existe qu'une fois le plan chargé. Défilement
  // et focus une seule fois par arrivée (premier chargement, vrai changement d'ancre) :
  // un rechargement du plan en arrière-plan ne ramène pas la page ni ne vole le focus.
  const [target, setTarget] = useState<string | null>(null);
  const revealedHash = useRef<string | null>(null);
  useEffect(() => {
    const lots = plan.data?.lots;
    if (!lots) return;
    const reveal = (force: boolean) => {
      const hash = window.location.hash;
      let id = '';
      try {
        id = decodeURIComponent(hash.slice(1));
      } catch {
        /* ancre mal encodée : aucune carte visée */
      }
      const el = lots.some((l) => l.id === id) ? document.getElementById(id) : null;
      setTarget(el ? id : null);
      if (el && (force || revealedHash.current !== hash)) {
        revealedHash.current = hash;
        el.scrollIntoView?.({ block: 'start' });
        el.focus({ preventScroll: true });
      }
    };
    reveal(false);
    const onHash = () => reveal(true);
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, [plan.data]);

  let body: ReactNode;
  if (plan.isLoading) {
    body = (
      <div className="flex items-center text-fg-muted" role="status">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden />
        Chargement…
      </div>
    );
  } else if (plan.isError) {
    body = (
      <div role="alert" className={cn(CARD, 'p-6 space-y-2')}>
        <p className="font-semibold text-fg-bright">Le plan n'a pas pu être chargé</p>
        <p className="text-sm text-fg-muted">Vérifiez la connexion, puis réessayez.</p>
        <button
          type="button"
          onClick={() => plan.refetch()}
          disabled={plan.isFetching}
          className="inline-flex min-h-11 items-center gap-2 rounded-md border border-border-strong bg-surface-2 px-4 text-sm font-medium text-fg-bright hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ol-red-bright disabled:opacity-60"
        >
          <RotateCw className={cn('h-4 w-4', plan.isFetching && 'animate-spin')} aria-hidden />
          Réessayer
        </button>
      </div>
    );
  } else if (!plan.data) {
    body = <p className={cn(CARD, 'p-6 text-fg-muted')}>Aucun plan publié pour l'instant.</p>;
  } else {
    const g = groupPlan(plan.data.lots, new Date());
    const older = g.olderDone;
    body = isEmpty(g) ? (
      <div className={cn(CARD, 'p-8 text-center')}>
        <p className="text-fg-muted text-sm font-medium">Rien en préparation pour l'instant.</p>
        <p className="text-sm mt-1.5">
          <NewsLink>Voir les Nouveautés</NewsLink>
        </p>
      </div>
    ) : (
      <div className="space-y-10">
        <p className={cn(CARD, 'px-5 py-4 text-fg')}>
          <span className="block mb-1 text-[11px] uppercase tracking-[0.14em] text-fg-muted font-semibold">
            En ce moment
          </span>
          {summary(g)}
        </p>
        <Group
          id="plan-doing"
          target={target}
          title="En cours"
          hint="Le travail commencé, pas encore livré."
          lots={g.doing}
          empty="Rien en cours pour l'instant."
          slugs={slugs}
        />
        <Group
          id="plan-todo"
          target={target}
          title="Prévu"
          hint="La suite, dans l'ordre du plan."
          lots={g.todo}
          empty="Rien de prévu pour l'instant."
          slugs={slugs}
        />
        <Group
          id="plan-done"
          target={target}
          title="Récemment livré"
          hint={`Livré ces ${RECENT_DAYS} derniers jours, le plus récent en premier.`}
          lots={g.done}
          empty={`Rien de livré ces ${RECENT_DAYS} derniers jours.`}
          slugs={slugs}
          footer={
            older > 0 && (
              <p className="text-sm text-fg-muted">
                {older} {plural(older, 'évolution livrée plus ancienne', 'évolutions livrées plus anciennes')} :{' '}
                <NewsLink>voir les Nouveautés</NewsLink>.
              </p>
            )
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header data-testid="plan-entete" className="flex flex-col gap-1.5 mb-2">
        {/* Même en-tête que les Nouveautés : pr-44 laisse la place de la pastille LIVE au téléphone. */}
        <p className="flex items-center gap-2 pr-44 lg:pr-0 text-[11px] uppercase tracking-[0.22em] text-fg-muted font-semibold">
          <ListTodo className="hidden sm:block h-3.5 w-3.5 shrink-0 text-ol-red-bright" strokeWidth={2} aria-hidden />
          <span>
            Plan de travail<span className="hidden sm:inline"> · OL Companion</span>
          </span>
        </p>
        <h1 className="font-display text-3xl lg:text-4xl font-bold text-fg-bright">Ce qui se prépare</h1>
        <p className="text-fg max-w-2xl">
          Les évolutions visibles de l'application : ce qui est en cours, ce qui est prévu et ce qui vient
          d'être livré.
        </p>
      </header>
      {body}
    </div>
  );
}
