import { Outlet, useRouterState } from '@tanstack/react-router';
import { cn } from '@/lib/utils';
import { Sidebar } from './sidebar';
import { BottomNav } from './bottom-nav';
import { PageBackdrop } from '@/components/page-backdrop';
import { DemoBanner } from '@/components/demo-banner';
import { useEventStream } from '@/hooks/use-event-stream';
import { useMatchNotifications } from '@/hooks/use-match-notifications';
import { LiveConnectionBadge } from '@/components/live-connection-badge';

/** Routes « tableau de bord » qui remplissent l'écran au lieu d'être centrées à 1440 px. */
const WIDE_ROUTE_PREFIXES = ['/match/'];

export function AppShell() {
  const eventStreamStatus = useEventStream();
  useMatchNotifications();
  const { location } = useRouterState();
  const wide = WIDE_ROUTE_PREFIXES.some((p) => location.pathname.startsWith(p));
  return (
    <div className="min-h-full relative">
      <PageBackdrop />
      <DemoBanner />
      <Sidebar eventStreamStatus={eventStreamStatus} />
      <LiveConnectionBadge status={eventStreamStatus} className="fixed right-4 top-4 z-50 lg:hidden" />
      <main className="relative z-10 lg:pl-[240px] pb-20 lg:pb-0">
        <div className={cn('mx-auto w-full px-5 lg:px-8', wide ? 'max-w-none py-5 lg:py-6' : 'max-w-[1440px] py-6 lg:py-10')}>
          <Outlet />
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
