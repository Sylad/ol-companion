import { Fragment, useEffect, useRef, useState, type CSSProperties, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { Link2, Loader2, Megaphone, X, ZoomIn } from 'lucide-react';
import { NEWS_BASE as BASE, NEWS_QUERY_KEY, fetchNews } from '@/lib/nouveautes';
import {
  NEWS_SEEN_EVENT,
  browserStorage,
  isUnseen,
  markAllSeen,
  readSeen,
  seenSeparatorIndex,
  sinceLabel,
} from '@/lib/news-badge';
import { entryForFragment, permalink } from '@/lib/news-anchor';
import { cn } from '@/lib/utils';

// Journal généré par `cadence news build` (cd frontend && npm run news), servi en
// statique depuis public/nouveautes-data/ (voir lib/nouveautes.ts).

const formatDate = (day: string) =>
  new Date(`${day}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

interface Capture {
  src: string;
  alt: string;
  size?: [number, number];
}

export function NouveautesPage() {
  const query = useQuery({ queryKey: NEWS_QUERY_KEY, queryFn: fetchNews, staleTime: 5 * 60_000 });
  const [viewing, setViewing] = useState<{ capture: Capture; trigger: HTMLElement } | null>(null);
  const entries = query.data?.news?.entries ?? [];
  const sizes = query.data?.sizes ?? {};

  // L22 — dernière visite : lue UNE fois à l'arrivée (avant que la visite ne soit
  // mémorisée), pour marquer « Nouveau » et poser le séparateur « Déjà vu ». Dès que le
  // journal est là, tout est marqué vu et la pastille de la navigation s'éteint.
  const [previousVisit] = useState(() => readSeen(browserStorage()));
  useEffect(() => {
    if (entries.length === 0) return;
    markAllSeen(browserStorage(), entries);
    window.dispatchEvent(new Event(NEWS_SEEN_EVENT));
  }, [entries]);
  const fresh = entries.map((e) => isUnseen(e, previousVisit));
  const freshCount = fresh.filter(Boolean).length;
  // Séparateur seulement entre des entrées nouvelles (toutes au-dessus) et des déjà vues.
  // Ligne de base d'un nouveau venu (pas d'instant de visite) : pas de séparateur
  // « Déjà vu lors de votre visite » pour une visite qui n'a pas eu lieu.
  const firstSeenIndex = previousVisit?.at ? seenSeparatorIndex(fresh) : -1;

  // L22 — lien permanent /nouveautes#<slug> : le journal arrive après le chargement de la
  // page, le défilement natif vers l'ancre ne trouve rien ; la page vise l'entrée ensuite.
  const [target, setTarget] = useState<string | null>(null);
  // Ancre déjà amenée à l'écran : un rechargement du journal en arrière-plan (staleTime,
  // retour sur l'onglet, nouvelle entrée) ne refait ni défilement ni focus — seulement
  // l'arrivée (premier chargement où l'entrée existe) et un vrai changement d'ancre.
  const revealedHash = useRef<string | null>(null);
  useEffect(() => {
    if (entries.length === 0) return;
    const hash = window.location.hash;
    const slug = entryForFragment(hash, entries);
    setTarget(slug);
    const el = slug ? document.getElementById(slug) : null;
    if (el && revealedHash.current !== hash) {
      revealedHash.current = hash;
      el.scrollIntoView?.({ block: 'start' });
      el.focus({ preventScroll: true });
    }
    // Changement d'ancre (clic sur un titre, retour arrière) : le navigateur défile
    // lui-même ; on signale l'entrée sans prendre le focus au lien cliqué.
    const onHash = () => {
      revealedHash.current = window.location.hash;
      setTarget(entryForFragment(window.location.hash, entries));
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, [entries]);

  // Retour après une copie du lien (titre ou bouton « Copier le lien »), effacé après
  // 4 s : dans le libellé du bouton (largeur réservée) et pour lecteur d'écran — jamais
  // une ligne insérée dans la carte (elle poussait le texte de 20 px).
  const [linkStatus, setLinkStatus] = useState<{ slug: string; ok: boolean } | null>(null);
  useEffect(() => {
    if (!linkStatus) return;
    const t = setTimeout(() => setLinkStatus(null), 4000);
    return () => clearTimeout(t);
  }, [linkStatus]);
  const copyLink = async (slug: string) => {
    try {
      await navigator.clipboard.writeText(permalink(window.location.origin, slug));
      setLinkStatus({ slug, ok: true });
    } catch {
      setLinkStatus({ slug, ok: false });
    }
  };
  // Titre : le lien met lui-même l'ancre dans l'URL (comportement natif) ; l'entrée est signalée.
  const onTitleClick = (slug: string) => () => {
    setTarget(slug);
    void copyLink(slug);
  };
  // Bouton : copie seulement — l'URL n'est pas touchée (le routeur ferait défiler la page
  // vers l'ancre : mesuré, 81 à 133 px de saut).
  const onCopyButton = (slug: string) => () => void copyLink(slug);

  const open = (capture: Capture) => (e: MouseEvent<HTMLAnchorElement>) => {
    // Clic ou Entrée (qui déclenche un clic sur le lien) : la visionneuse, pas le PNG brut.
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    setViewing({ capture, trigger: e.currentTarget });
  };

  return (
    <div className="space-y-6">
      <header data-testid="nouveautes-entete" className="flex flex-col gap-1.5 mb-2">
        <p className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-fg-muted font-semibold">
          <Megaphone className="h-3.5 w-3.5 shrink-0 text-ol-red-bright" strokeWidth={2} aria-hidden />
          <span>
            Nouveautés<span className="hidden sm:inline"> · OL Companion</span>
          </span>
        </p>
        <h1 className="font-display text-3xl lg:text-4xl font-bold text-fg-bright">Ce qui a changé</h1>
        <p className="text-fg max-w-2xl">
          Le journal des évolutions visibles de l'application, la plus récente en haut.
        </p>
        <p
          data-testid="nouveautes-depuis"
          role="status"
          className="text-sm font-semibold text-fg-bright empty:hidden"
        >
          {sinceLabel(freshCount)}
        </p>
      </header>

      {query.isLoading ? (
        <div className="flex items-center text-fg-muted" role="status">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden />
          Chargement…
        </div>
      ) : entries.length === 0 ? (
        <p className="rounded-md border border-border bg-surface p-6 text-fg-muted">
          Aucune nouveauté publiée pour l'instant.
        </p>
      ) : (
        <div className="space-y-5">
          {entries.map((e, index) => (
            <Fragment key={e.slug}>
            {index === firstSeenIndex && (
              // Repère visuel ; l'annonce « N nouveautés depuis… » le dit aux lecteurs d'écran.
              <div
                data-testid="nouveautes-deja-vu"
                aria-hidden="true"
                className="flex items-center gap-3 text-xs text-fg-muted before:h-px before:flex-1 before:bg-border-strong after:h-px after:flex-1 after:bg-border-strong"
              >
                {`Déjà vu lors de votre visite du ${new Date(previousVisit!.at!).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' })}`}
              </div>
            )}
            <article
              id={e.slug}
              tabIndex={-1}
              data-target={target === e.slug ? 'true' : undefined}
              aria-labelledby={`${e.slug}-titre`}
              className={cn(
                'scroll-mt-20 lg:scroll-mt-6 rounded-md border bg-surface p-5 lg:p-6 focus:outline-none',
                target === e.slug ? 'border-ol-red-bright ring-1 ring-ol-red-bright' : 'border-border',
              )}
            >
              <div className="flex items-start justify-between gap-3 mb-1.5">
                <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1 pt-0.5 text-[11px] uppercase tracking-[0.14em] text-fg-muted font-semibold">
                  <time dateTime={e.date}>{formatDate(e.date)}</time>
                  {fresh[index] && (
                    <span className="rounded-full bg-ol-red px-2 py-0.5 text-[10px] font-bold tracking-[0.08em] text-fg-bright">
                      Nouveau
                    </span>
                  )}
                </p>
                {/* Lien permanent visible sans survol (toucher) : cible 44 px au téléphone,
                    24 px au bureau. Les trois libellés partagent la même case de grille, la
                    largeur du plus long est donc réservée : le retour ne décale rien. */}
                <button
                  type="button"
                  onClick={onCopyButton(e.slug)}
                  className="-my-3 lg:-my-0.5 inline-flex min-h-11 lg:min-h-6 shrink-0 items-center gap-1.5 rounded-sm px-1 text-xs font-medium text-ol-red-bright hover:underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ol-red-bright"
                >
                  <Link2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span aria-hidden="true" className="grid text-left">
                    {(['idle', 'ok', 'ko'] as const).map((k) => {
                      const shown =
                        linkStatus?.slug === e.slug ? (linkStatus.ok ? 'ok' : 'ko') : 'idle';
                      return (
                        <span
                          key={k}
                          data-label
                          className={cn('col-start-1 row-start-1 whitespace-nowrap', shown !== k && 'invisible')}
                        >
                          {k === 'idle' ? 'Copier le lien' : k === 'ok' ? 'Lien copié' : 'Copie impossible'}
                        </span>
                      );
                    })}
                  </span>
                  <span className="sr-only">Copier le lien : {e.title}</span>
                </button>
              </div>
              <h2
                id={`${e.slug}-titre`}
                className="font-display text-lg lg:text-xl font-bold text-fg-bright mb-3 [overflow-wrap:anywhere]"
              >
                <a
                  href={`#${e.slug}`}
                  onClick={onTitleClick(e.slug)}
                  title="Lien vers cette nouveauté (copié au clic)"
                  // « # » en pseudo-élément au survol et au focus : repère visuel du lien
                  // permanent, hors du texte du titre (et de son nom accessible).
                  className="rounded-sm hover:underline hover:decoration-ol-red-bright hover:underline-offset-4 after:ml-1.5 after:text-ol-red-bright after:opacity-0 after:content-['#'] hover:after:opacity-100 focus-visible:after:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ol-red-bright focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                >
                  {e.title}
                </a>
              </h2>
              <p role="status" className="sr-only">
                {linkStatus?.slug === e.slug
                  ? linkStatus.ok
                    ? 'Lien copié dans le presse-papiers'
                    : "Lien affiché dans la barre d'adresse"
                  : ''}
              </p>
              {/* HTML produit par cadence depuis le Markdown du dépôt (texte échappé à la génération). */}
              <div
                className="max-w-3xl text-fg leading-relaxed space-y-3 [overflow-wrap:anywhere] [&_strong]:text-fg-bright [&_a]:text-ol-red-bright [&_a]:underline [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5 [&_code]:text-sm [&_code]:bg-surface-2 [&_code]:px-1 [&_code]:rounded"
                dangerouslySetInnerHTML={{ __html: e.html }}
              />
              {e.captures.length > 0 && (
                <div className="mt-5 flex flex-wrap items-start gap-4">
                  {e.captures.map((c, i) => {
                    const capture: Capture = {
                      size: sizes[c],
                      src: `${BASE}/${c}`,
                      alt:
                        e.captures.length > 1
                          ? `Capture d'écran ${i + 1} sur ${e.captures.length} : ${e.title}`
                          : `Capture d'écran : ${e.title}`,
                    };
                    const size = sizes[c];
                    // Place réservée AVANT chargement : le lien prend min(largeur dispo, largeur
                    // naturelle, largeur qui donne 32rem de haut), l'image le remplit à ses
                    // proportions. Une capture de téléphone ne s'étire pas, une de bureau ne déborde pas.
                    const linkStyle: CSSProperties | undefined = size
                      ? { width: `min(100%, ${size[0]}px, calc(32rem * ${size[0]} / ${size[1]}))` }
                      : undefined;
                    const imgStyle: CSSProperties | undefined = size
                      ? { aspectRatio: `${size[0]} / ${size[1]}` }
                      : undefined;
                    return (
                      <a
                        key={c}
                        href={capture.src}
                        onClick={open(capture)}
                        aria-label={`Agrandir la capture — ${capture.alt}`}
                        className="group relative block max-w-full rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ol-red-bright focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                        style={linkStyle}
                      >
                        <img
                          src={capture.src}
                          alt={capture.alt}
                          width={size?.[0]}
                          height={size?.[1]}
                          style={imgStyle}
                          loading="lazy"
                          decoding="async"
                          className={
                            size
                              ? 'block w-full h-auto rounded-md border border-border-strong cursor-zoom-in'
                              : 'block max-w-full max-h-[32rem] h-auto rounded-md border border-border-strong cursor-zoom-in'
                          }
                        />
                        <span
                          aria-hidden
                          className="absolute right-2 bottom-2 flex h-8 w-8 items-center justify-center rounded-full bg-bg/85 text-fg-bright border border-border-strong opacity-90 group-hover:opacity-100"
                        >
                          <ZoomIn className="h-4 w-4" strokeWidth={2} />
                        </span>
                      </a>
                    );
                  })}
                </div>
              )}
            </article>
            </Fragment>
          ))}
        </div>
      )}

      {viewing && (
        <CaptureViewer
          capture={viewing.capture}
          onClose={() => {
            const trigger = viewing.trigger;
            setViewing(null);
            trigger.focus();
          }}
        />
      )}
    </div>
  );
}

function CaptureViewer({ capture, onClose }: { capture: Capture; onClose: () => void }) {
  const closeButton = useRef<HTMLButtonElement>(null);
  const zone = useRef<HTMLDivElement>(null);

  useEffect(() => {
    closeButton.current?.focus();
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  // Sous 640 px : largeur naturelle de la capture, au plus 2 largeurs d'écran, dans une
  // zone qui défile (une capture de bureau 1136×354 n'était agrandie que ×1,19 à 390 px).
  // Au-delà : capture entière à l'écran, comme avant.
  const imgStyle = capture.size ? ({ '--cap-w': `${capture.size[0]}px` } as CSSProperties) : undefined;

  // Portail sous <body> : <main> est un contexte d'empilement (relative z-10), un z-index
  // posé à l'intérieur ne passerait jamais au-dessus de la barre du bas ni du bandeau démo.
  return createPortal(
    // z-[60] : au-dessus de la barre du bas (z-40) et du bandeau démo (z-50).
    <div
      role="dialog"
      aria-modal="true"
      aria-label={capture.alt}
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center p-3 sm:p-6"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          onClose();
        } else if (e.key === 'Tab') {
          // Deux éléments focalisables : « Fermer » et la zone de défilement ; le focus boucle.
          e.preventDefault();
          (document.activeElement === closeButton.current ? zone.current : closeButton.current)?.focus();
        }
      }}
    >
      <div
        data-testid="capture-viewer-backdrop"
        aria-hidden
        className="absolute inset-0 bg-bg/90 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* « Fermer » hors de la zone qui défile : toujours visible et atteignable. */}
      <button
        ref={closeButton}
        type="button"
        onClick={onClose}
        className="relative mb-2 flex h-11 shrink-0 items-center gap-1.5 self-end rounded-md border border-border-strong bg-surface px-3 text-sm font-medium text-fg-bright hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ol-red-bright sm:self-center"
      >
        <X className="h-4 w-4" aria-hidden />
        Fermer
      </button>
      <div
        ref={zone}
        role="region"
        tabIndex={0}
        aria-label="Capture agrandie, faire défiler pour voir la suite"
        className="relative min-h-0 max-w-full overflow-auto overscroll-contain rounded-md border border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ol-red-bright"
      >
        <img
          src={capture.src}
          alt={capture.alt}
          style={imgStyle}
          className={
            capture.size
              ? 'block h-auto max-w-none w-[min(var(--cap-w),200vw)] sm:w-auto sm:max-w-full sm:max-h-[calc(100dvh-6rem)]'
              : 'block h-auto max-w-none w-auto sm:max-w-full sm:max-h-[calc(100dvh-6rem)]'
          }
        />
      </div>
    </div>,
    document.body,
  );
}
