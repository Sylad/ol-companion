import { useState } from 'react';
import { useStandings } from '@/hooks/use-standings';
import { useNextOpponents } from '@/hooks/use-next-opponents';
import { KnowledgeHeader } from '@/components/knowledge-header';
import { StandingsTable, type VueTelephone } from '@/components/standings-table';
import { PositionTracker } from '@/components/position-tracker';
import { RetryMessage } from '@/components/retry-message';
import { OL_TEAM_ID } from '@/types/api';
import { AlertTriangle, ArrowDown, Loader2, RefreshCw } from 'lucide-react';

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h} h`;
  return `il y a ${Math.floor(h / 24)} j`;
}

/** L259 : amène la ligne de l'OL sous l'en-tête collant du tableau et y pose le focus (clavier, lecteur d'écran). */
function allerALigneOL() {
  const ligne = document.getElementById('ligne-ol');
  if (!ligne) return;
  ligne.focus({ preventScroll: true });
  ligne.scrollIntoView({ block: 'center' });
}

const STALE_MS = 60 * 60 * 1000;

const PARIS = { timeZone: 'Europe/Paris' } as const;

// « 14 oct. à 16:25 » (heure de Paris, quel que soit le fuseau du navigateur)
function formatCacheDate(iso: string): string {
  const d = new Date(iso);
  const jour = new Intl.DateTimeFormat('fr-FR', { ...PARIS, day: 'numeric', month: 'short' })
    .format(d);
  const heure = new Intl.DateTimeFormat('fr-FR', { ...PARIS, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d);
  return `${jour} à ${heure}`;
}

export function StandingsPage() {
  const { data, isLoading, isError, refetch, isFetching } = useStandings();
  const dated = !!data && !Number.isNaN(new Date(data.updatedAt).getTime());
  const age = dated ? Date.now() - new Date(data.updatedAt).getTime() : 0;
  const refreshFailed = isError && !!data;
  const bandeau = data && dated
    ? refreshFailed
      ? `Rafraîchissement impossible — classement du ${formatCacheDate(data.updatedAt)}`
      : age > STALE_MS
        ? `Classement ${formatRelative(data.updatedAt).replace('il y a', "d'il y a")}`
        : null
    : null;

  const olRow = data?.table.find((row) => row.teamId === OL_TEAM_ID);
  const nextOpponents = useNextOpponents();
  const [vueTelephone, setVueTelephone] = useState<VueTelephone>('bilan');

  return (
    <div className="space-y-4 lg:space-y-8">
      {/* L259 : bandeau compact sous 1024 px et tableau AVANT le tracker, à toute largeur : au téléphone la première
          ligne et celle de l'OL sont au premier écran, et le H1 « Classement » précède le H2 du tracker (WCAG 1.3.1).
          L262 : à 320 × 568, Lyon 5e passait sous la barre du bas ; sous 1024 px, écarts resserrés (ici, en-tête de la
          section, en-tête du tableau) et surtitre réduit à « Ligue 1 » sous 640 px (il passait sur deux lignes). */}
      <KnowledgeHeader compact />

      <section className="rounded-md bg-surface border border-border overflow-clip">
        <header className="px-5 py-3 lg:py-4 flex items-center justify-between gap-4 border-b border-border">
          <div>
            <div className="eyebrow mb-1">
              Ligue 1<span className="hidden sm:inline"> Uber Eats</span>
            </div>
            <h1 className="font-display text-xl font-bold text-fg-bright leading-none">
              Classement
            </h1>
          </div>
          <div className="flex items-center gap-3 text-xs text-fg-dim">
            {data && (
              <>
                <span className="hidden sm:inline">
                  Journée <span className="num text-fg">{data.currentMatchday}</span>
                </span>
                <span className="hidden sm:inline">·</span>
                {dated && <span>{bandeau ? formatCacheDate(data.updatedAt) : formatRelative(data.updatedAt)}</span>}
              </>
            )}
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="flex items-center gap-1.5 rounded-sm border border-border-strong px-2.5 py-1.5 text-fg-muted hover:text-fg hover:border-fg-dim transition-colors disabled:opacity-50"
              aria-label="Actualiser le classement"
            >
              <RefreshCw
                className={isFetching ? 'h-3 w-3 animate-spin' : 'h-3 w-3'}
                strokeWidth={2}
              />
              <span className="hidden sm:inline">Actualiser</span>
            </button>
          </div>
        </header>

        {bandeau && (
          <div
            role="status"
            className="flex min-h-9 items-center gap-2 border-b border-border bg-surface-2 px-5 py-2 text-xs text-fg-muted"
          >
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
            <span>{bandeau}</span>
          </div>
        )}

        <div className="p-2 sm:p-5">
          {isLoading && (
            <div role="status" className="flex items-center justify-center py-20 text-fg-dim">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              <span>Chargement du classement…</span>
            </div>
          )}
          {isError && !data && (
            <RetryMessage
              className="flex flex-col items-center gap-3 py-20 text-center"
              message="Impossible de charger le classement."
              onRetry={() => void refetch()}
              messageTestId="standings-error"
              buttonTestId="standings-retry"
            />
          )}
          {/* L262 : lien affiché tant que la barre du bas l'est (sous 1024 px, téléphone couché compris).
              L273 : sous 768 px, même rangée (aucune hauteur de plus), le choix des colonnes : G, N, P ou le prochain adversaire. */}
          {data && data.table.length > 0 && (
            <div className="flex items-center gap-2 px-2 lg:hidden">
              <VueTelephoneChoix vue={vueTelephone} onChange={setVueTelephone} />
              {olRow && (
                <a
                  href="#ligne-ol"
                  onClick={(e) => {
                    e.preventDefault();
                    allerALigneOL();
                  }}
                  className="ml-auto inline-flex min-h-6 items-center gap-1 whitespace-nowrap rounded-sm px-1 text-xs text-fg-muted underline underline-offset-2 hover:text-fg"
                >
                  Voir l'OL
                  <span className="num">({olRow.position === 1 ? '1er' : `${olRow.position}e`})</span>
                  <ArrowDown className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
                </a>
              )}
            </div>
          )}
          {data && data.table.length > 0 && (
            <StandingsTable rows={data.table} nextOpponents={nextOpponents} vueTelephone={vueTelephone} />
          )}
          {data && data.table.length === 0 && (
            <p className="py-20 text-center text-fg-muted">Aucune donnée disponible.</p>
          )}
        </div>
      </section>

      <PositionTracker />
    </div>
  );
}

const VUES: { vue: VueTelephone; label: string }[] = [
  { vue: 'bilan', label: 'Bilan' },
  { vue: 'prochain', label: 'Prochain' },
];

/** L273 — au téléphone (sous 768 px), colonnes G, N, P (« Bilan ») ou colonne du prochain adversaire (« Prochain »), sur une ligne à 320 px. */
function VueTelephoneChoix({ vue, onChange }: { vue: VueTelephone; onChange: (v: VueTelephone) => void }) {
  return (
    <div role="group" aria-label="Colonnes du tableau" className="inline-flex shrink-0 whitespace-nowrap rounded-sm border border-border-strong md:hidden">
      {VUES.map((v) => (
        <button
          key={v.vue}
          type="button"
          aria-pressed={vue === v.vue}
          onClick={() => onChange(v.vue)}
          className={
            vue === v.vue
              ? 'min-h-6 px-2 text-xs bg-surface-2 text-fg-bright font-semibold'
              : 'min-h-6 px-2 text-xs text-fg-muted hover:text-fg'
          }
        >
          {v.label}
        </button>
      ))}
    </div>
  );
}
