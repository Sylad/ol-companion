import { useEffect, useRef, useState, type CSSProperties, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Megaphone, X, ZoomIn } from 'lucide-react';

// Journal généré par `cadence news build` (cd frontend && npm run news) : les
// entrées vivent dans docs/nouveautes/, le résultat est versionné dans
// public/nouveautes-data/ (la CI n'a pas cadence) et servi en statique par nginx.
// L'ordre (la plus récente en haut, départage sur `created`) est celui du JSON.
const BASE = '/nouveautes-data';

interface NewsEntry {
  slug: string;
  title: string;
  date: string;
  lots: string[];
  captures: string[];
  html: string;
}

interface NewsData {
  project: string;
  generated: string;
  entries: NewsEntry[];
}

type Sizes = Record<string, [number, number]>;

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { cache: 'no-cache' });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

async function fetchNews(): Promise<{ news: NewsData | null; sizes: Sizes }> {
  const [news, sizes] = await Promise.all([
    getJson<NewsData>(`${BASE}/nouveautes.json`),
    getJson<Sizes>(`${BASE}/tailles.json`),
  ]);
  return { news, sizes: sizes ?? {} };
}

const formatDate = (day: string) =>
  new Date(`${day}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

interface Capture {
  src: string;
  alt: string;
  size?: [number, number];
}

export function NouveautesPage() {
  const query = useQuery({ queryKey: ['nouveautes'], queryFn: fetchNews, staleTime: 5 * 60_000 });
  const [viewing, setViewing] = useState<{ capture: Capture; trigger: HTMLElement } | null>(null);
  const entries = query.data?.news?.entries ?? [];
  const sizes = query.data?.sizes ?? {};

  const open = (capture: Capture) => (e: MouseEvent<HTMLAnchorElement>) => {
    // Clic ou Entrée (qui déclenche un clic sur le lien) : la visionneuse, pas le PNG brut.
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    setViewing({ capture, trigger: e.currentTarget });
  };

  return (
    <div className="space-y-6">
      <header data-testid="nouveautes-entete" className="flex flex-col gap-1.5 mb-2">
        {/* pr-40 au téléphone : la pastille LIVE (fixe, en haut à droite) ne recouvre pas le sur-titre. */}
        <p className="flex items-center gap-2 pr-40 lg:pr-0 text-[11px] uppercase tracking-[0.22em] text-fg-muted font-semibold">
          <Megaphone className="h-3.5 w-3.5 shrink-0 text-ol-red-bright" strokeWidth={2} aria-hidden />
          <span>
            Nouveautés<span className="hidden sm:inline"> · OL Companion</span>
          </span>
        </p>
        <h1 className="font-display text-3xl lg:text-4xl font-bold text-fg-bright">Ce qui a changé</h1>
        <p className="text-fg max-w-2xl">
          Le journal des évolutions visibles de l'application, la plus récente en haut.
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
          {entries.map((e) => (
            <article
              key={e.slug}
              id={e.slug}
              aria-labelledby={`${e.slug}-titre`}
              className="rounded-md border border-border bg-surface p-5 lg:p-6"
            >
              <p className="text-[11px] uppercase tracking-[0.14em] text-fg-muted font-semibold mb-1.5">
                <time dateTime={e.date}>{formatDate(e.date)}</time>
              </p>
              <h2
                id={`${e.slug}-titre`}
                className="font-display text-lg lg:text-xl font-bold text-fg-bright mb-3 [overflow-wrap:anywhere]"
              >
                {e.title}
              </h2>
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
  // posé à l'intérieur ne passerait jamais au-dessus de la barre du bas ni de la pastille LIVE.
  return createPortal(
    // z-[60] : au-dessus de la barre du bas (z-40) et de la pastille de connexion (z-50).
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
