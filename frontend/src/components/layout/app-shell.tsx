import { useEffect } from 'react';
import { Outlet, useRouterState } from '@tanstack/react-router';
import { cn } from '@/lib/utils';
import { Sidebar } from './sidebar';
import { BottomNav } from './bottom-nav';
import { PageBackdrop } from '@/components/page-backdrop';
import { DemoBanner } from '@/components/demo-banner';
import { pageTitle } from '@/lib/page-title';
import { useEventStream } from '@/hooks/use-event-stream';
import { useMatchNotifications } from '@/hooks/use-match-notifications';
import { LiveConnectionBadge } from '@/components/live-connection-badge';

/** Routes « tableau de bord » qui remplissent l'écran au lieu d'être centrées à 1440 px. */
const WIDE_ROUTE_PREFIXES = ['/match/'];

export function AppShell() {
  const eventStreamStatus = useEventStream();
  useMatchNotifications();
  const { location } = useRouterState();
  useEffect(() => {
    document.title = pageTitle(location.pathname);
  }, [location.pathname]);
  const wide = WIDE_ROUTE_PREFIXES.some((p) => location.pathname.startsWith(p));
  return (
    <div className="min-h-full relative">
      {/* L207 : premier élément focalisable, visible au focus seulement (WCAG 2.4.1) ; le clic focalise le <main> sans passer par le hash du routeur. */}
      <a
        href="#contenu"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById('contenu')?.focus();
        }}
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-md focus:bg-surface focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-fg-bright focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[hsl(var(--ol-red-bright))]"
      >
        Aller au contenu
      </a>
      <PageBackdrop />
      <DemoBanner />
      <Sidebar eventStreamStatus={eventStreamStatus} />
      <main id="contenu" tabIndex={-1} className="outline-none relative z-10 lg:pl-[240px] pb-20 lg:pb-0">
        <div className={cn('mx-auto w-full px-5 lg:px-8', wide ? 'max-w-none py-5 lg:py-6' : 'max-w-[1440px] py-6 lg:py-10')}>
          {/* L30 : sur téléphone la pastille a sa propre ligne, dans le flux — flottante, elle recouvrait le titre.
              L64 : cette ligne est collante (sticky, jamais fixed : elle garde sa hauteur dans le flux, rien ne passe dessous
              au repos) et reste sous le haut de l'écran au défilement ; transparente aux clics hors de la pastille.
              Sa hauteur (h-9) est --ligne-direct-h dans index.css. */}
          <div
            data-testid="ligne-direct"
            className="pointer-events-none sticky top-[var(--bandeau-demo-h,0px)] z-30 flex h-9 items-start justify-end lg:hidden"
          >
            <LiveConnectionBadge status={eventStreamStatus} className="pointer-events-auto" avecScore />
          </div>
          <Outlet />
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
