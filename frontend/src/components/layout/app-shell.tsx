import { Outlet } from '@tanstack/react-router';
import { Sidebar } from './sidebar';
import { BottomNav } from './bottom-nav';
import { PageBackdrop } from '@/components/page-backdrop';
import { DemoBanner } from '@/components/demo-banner';
import { useEventStream } from '@/hooks/use-event-stream';
import { useMatchNotifications } from '@/hooks/use-match-notifications';
import { LiveConnectionBadge } from '@/components/live-connection-badge';

export function AppShell() {
  const eventStreamStatus = useEventStream();
  useMatchNotifications();
  return (
    <div className="min-h-full relative">
      <PageBackdrop />
      <DemoBanner />
      <Sidebar eventStreamStatus={eventStreamStatus} />
      <LiveConnectionBadge status={eventStreamStatus} className="fixed right-4 top-4 z-50 lg:hidden" />
      <main className="relative z-10 lg:pl-[240px] pb-20 lg:pb-0">
        <div className="mx-auto w-full max-w-[1440px] px-5 lg:px-8 py-6 lg:py-10">
          <Outlet />
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
