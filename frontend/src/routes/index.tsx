import { lazy, Suspense } from 'react';
import { KnowledgeHeader } from '@/components/knowledge-header';
import { DashboardHero } from '@/components/dashboard-hero';
import { DashboardStats } from '@/components/dashboard-stats';
import { LastResult } from '@/components/last-result';
import { LiveMatchCard } from '@/components/live-match-card';

const SeasonSummary = lazy(() =>
  import('@/components/season-summary').then((mod) => ({ default: mod.SeasonSummary })),
);
const PositionTracker = lazy(() =>
  import('@/components/position-tracker').then((mod) => ({ default: mod.PositionTracker })),
);

function DashboardPanelFallback({ label }: { label: string }) {
  return (
    <section className="rounded-md bg-surface border border-border p-5 text-sm text-fg-dim">
      {label}
    </section>
  );
}

export function DashboardPage() {
  return (
    <div className="space-y-6 lg:space-y-8">
      <KnowledgeHeader />
      <DashboardHero />
      <LiveMatchCard />
      <DashboardStats />
      <LastResult />
      <Suspense fallback={<DashboardPanelFallback label="Chargement des stats saison..." />}>
        <SeasonSummary />
      </Suspense>
      <Suspense fallback={<DashboardPanelFallback label="Chargement du tracker..." />}>
        <PositionTracker />
      </Suspense>
    </div>
  );
}
