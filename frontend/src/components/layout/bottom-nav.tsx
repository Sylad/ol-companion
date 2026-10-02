import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Link, useRouterState } from '@tanstack/react-router';
import { Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DIVIDER, NAV_ITEMS } from './sidebar';
import { GROUP_TITLE, SECONDARY_ITEMS } from './sidebar-links';
import { NewsBadge } from '@/components/news-badge';
import { useNewsBadge } from '@/hooks/use-news-badge';

// L24 (décision de Sylvain, option A, 02-10) : 4 pages + « Plus », soit 5 cases de 64 px
// à 320 px. Avec 8 cases de 40 px, « Dashboard », « Calendrier » et « Classement »
// débordaient (49 à 52 px). Joueurs, Coupes et Carte L1 passent dans le panneau « Plus »,
// avec FC Noobz et les pages « Application », comme le « Plus » de finance-tracker.
// La barre latérale (bureau) garde ses 7 pages.
const BAR_PATHS: readonly string[] = ['/', '/fixtures', '/standings', '/news'];
const BAR_ITEMS = NAV_ITEMS.filter((i) => BAR_PATHS.includes(i.to));
const MOVED_ITEMS = NAV_ITEMS.filter((i) => !BAR_PATHS.includes(i.to));
// Pages derrière « Plus », avec leur libellé : le nom accessible du bouton dit laquelle
// est la page actuelle (revue UX L24, WCAG 1.3.1 : la couleur seule ne suffit pas).
const MORE_PAGES: readonly { to: string; label: string }[] = [
  ...MOVED_ITEMS,
  { to: '/fcnoobz', label: 'FC Noobz' },
  ...SECONDARY_ITEMS,
];

const SHEET_BOTTOM = 'calc(4.5rem + env(safe-area-inset-bottom))';

export function BottomNav() {
  const { location } = useRouterState();
  const path = location.pathname;
  const fcActive = path.startsWith('/fcnoobz');
  const [open, setOpen] = useState(false);
  const news = useNewsBadge();
  const firstLink = useRef<HTMLAnchorElement>(null);
  const plusButton = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);

  // Fermeture à la navigation ; focus sur la 1re page à l'ouverture ; à toute
  // fermeture (Échap, Fermer, voile, choix d'une page) le focus revient à « Plus ».
  useEffect(() => {
    setOpen(false);
  }, [path]);
  useEffect(() => {
    if (open) {
      wasOpen.current = true;
      firstLink.current?.focus();
    } else if (wasOpen.current) {
      wasOpen.current = false;
      plusButton.current?.focus();
    }
  }, [open]);

  // Panneau aria-modal : la page derrière ne défile pas tant qu'il est ouvert (comme la
  // visionneuse des Nouveautés) ; valeur d'origine restaurée à toute fermeture.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  // Piège à focus (aria-modal) : Tab / Maj+Tab bouclent dans le panneau.
  const onSheetKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      setOpen(false);
      return;
    }
    if (e.key !== 'Tab') return;
    const items = [...e.currentTarget.querySelectorAll<HTMLElement>('a[href], button:not([disabled])')];
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const currentMore = MORE_PAGES.find((p) => path.startsWith(p.to));
  const plusActive = open || currentMore !== undefined;
  // Nom accessible complet : les cases de la barre sont des éléments flex, un lecteur
  // d'écran insérerait une espace entre « Plus » et un texte masqué accolé (« Plus , … »).
  const plusName =
    'Plus' +
    (currentMore ? `, page actuelle : ${currentMore.label}` : '') +
    (!open && news.badge ? ` (${news.label})` : '');
  const sheetLink = (active: boolean) =>
    cn(
      'flex items-center gap-3 rounded-md px-3 min-h-11 text-sm transition-colors',
      active ? 'bg-surface-2 text-fg-bright' : 'text-fg-muted hover:bg-surface-2/60 hover:text-fg',
    );

  return (
    <>
      {open && (
        // z-[35] : au-dessus du contenu (z-10), sous la barre du bas (z-40) qui reste cliquable.
        <div className="lg:hidden fixed inset-0 z-[35]">
          <div
            className="absolute inset-0 bg-bg/70 backdrop-blur-sm"
            aria-hidden="true"
            onClick={() => setOpen(false)}
          />
          <div
            id="more-pages-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="more-pages-title"
            onKeyDown={onSheetKeyDown}
            className="absolute inset-x-0 bottom-0 max-h-[80vh] overflow-y-auto rounded-t-lg border-t border-border bg-surface px-4 pt-4"
            // Le panneau descend sous la barre du bas : la marge de défilement égale à la place
            // réservée à la barre garde la page focalisée au-dessus d'elle (L24, WCAG 2.4.11).
            style={{ paddingBottom: SHEET_BOTTOM, scrollPaddingBottom: SHEET_BOTTOM }}
          >
            {/* En-tête collant : « Fermer » reste visible quand le panneau défile (petits écrans). */}
            <div className="sticky -top-4 z-10 -mx-4 -mt-4 mb-2 flex items-center justify-between bg-surface px-4 pt-4">
              <h2
                id="more-pages-title"
                className="text-[11px] uppercase tracking-[0.14em] text-fg-muted font-semibold"
              >
                Plus de pages
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-11 w-11 items-center justify-center rounded-md text-fg-muted hover:bg-surface-2 hover:text-fg"
                aria-label="Fermer"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
            <ul className="space-y-1">
              {MOVED_ITEMS.map(({ to, label, icon: Icon }, i) => {
                const active = path.startsWith(to);
                return (
                  <li key={to}>
                    <Link
                      ref={i === 0 ? firstLink : undefined}
                      to={to}
                      onClick={() => setOpen(false)}
                      aria-current={active ? 'page' : undefined}
                      className={sheetLink(active)}
                    >
                      <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} aria-hidden />
                      <span className="font-medium">{label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
            <div data-divider aria-hidden="true" className={DIVIDER} />
            <ul className="space-y-1">
              <li>
                <Link
                  to="/fcnoobz"
                  onClick={() => setOpen(false)}
                  aria-current={fcActive ? 'page' : undefined}
                  className={sheetLink(fcActive)}
                >
                  <img src="/fcnoobz.png" alt="" aria-hidden className="h-[18px] w-[18px] shrink-0 object-contain" />
                  <span className="font-bold tracking-wide">FC Noobz</span>
                </Link>
              </li>
            </ul>
            <div data-divider aria-hidden="true" className={DIVIDER} />
            {/* Même groupe nommé que la barre latérale (L13) : titre « Application » lu par le lecteur d'écran. */}
            <div role="group" aria-labelledby="more-group-application">
              <div id="more-group-application" className={GROUP_TITLE}>
                Application
              </div>
              <ul className="space-y-1">
                {SECONDARY_ITEMS.map(({ to, label, icon: Icon }) => {
                  const active = path.startsWith(to);
                  return (
                    <li key={to}>
                      <Link
                        to={to}
                        onClick={() => setOpen(false)}
                        aria-current={active ? 'page' : undefined}
                        className={sheetLink(active)}
                      >
                        <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} aria-hidden />
                        <span className="font-medium">{label}</span>
                        {to === '/nouveautes' && <NewsBadge badge={news.badge} label={news.label} className="ml-auto" />}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </div>
      )}
      <nav
        aria-label="Navigation principale"
        className="lg:hidden fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 backdrop-blur-md"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="grid grid-cols-5">
          {BAR_ITEMS.map((item) => {
            const active = !open && (item.exact ? path === item.to : path.startsWith(item.to));
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  'flex flex-col items-center justify-center gap-1 py-2.5 transition-colors',
                  active ? 'text-ol-red-bright' : 'text-fg-muted',
                )}
              >
                <Icon className="h-[18px] w-[18px]" strokeWidth={active ? 2.25 : 1.75} />
                <span className="text-[10px] font-medium tracking-wide">{item.label}</span>
              </Link>
            );
          })}
          <button
            ref={plusButton}
            type="button"
            aria-label={plusName}
            aria-expanded={open}
            aria-controls="more-pages-sheet"
            data-active={plusActive}
            onClick={() => setOpen((o) => !o)}
            // Revue UX L24 : panneau ouvert et focus sur « Plus » (après un clic souris), Échap
            // ferme aussi ; l'effet de fermeture laisse le focus sur « Plus ».
            onKeyDown={(e) => {
              if (e.key === 'Escape' && open) {
                e.preventDefault();
                setOpen(false);
              }
            }}
            className={cn(
              'flex flex-col items-center justify-center gap-1 py-2.5 transition-colors border-l border-border',
              plusActive ? (fcActive && !open ? 'text-[#3aa0ff]' : 'text-ol-red-bright') : 'text-fg-muted',
            )}
          >
            {/* Pastille de 16 px (comme la barre latérale) posée sur le coin de l'icône, rentrée
                vers elle : la case garde sa largeur et la pastille ne touche plus le bord (L24). */}
            <span className="relative">
              <Menu className="h-[18px] w-[18px]" strokeWidth={plusActive ? 2.25 : 1.75} aria-hidden />
              {!open && (
                <NewsBadge badge={news.badge} label="" className="absolute -right-2 -top-1.5 h-4 min-w-4 ring-2 ring-surface" />
              )}
            </span>
            <span className="text-[10px] font-medium tracking-wide">Plus</span>
          </button>
        </div>
      </nav>
    </>
  );
}
