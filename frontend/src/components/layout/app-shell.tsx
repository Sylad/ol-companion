import { Outlet } from '@tanstack/react-router';
import { Sidebar } from './sidebar';
import { BottomNav } from './bottom-nav';
import { PageBackdrop } from '@/components/page-backdrop';
import { useEventStream } from '@/hooks/use-event-stream';

export function AppShell() {
  useEventStream();
  return (
    <div className="min-h-full relative">
      <PageBackdrop />
      <Sidebar />
      <main className="relative z-10 lg:pl-[240px] pb-20 lg:pb-0">
        <div className="mx-auto w-full max-w-[1440px] px-5 lg:px-8 py-6 lg:py-10">
          <Outlet />
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
