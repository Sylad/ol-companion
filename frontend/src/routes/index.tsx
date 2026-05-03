import { KnowledgeHeader } from '@/components/knowledge-header';
import { DashboardHero } from '@/components/dashboard-hero';
import { DashboardStats } from '@/components/dashboard-stats';
import { LastResult } from '@/components/last-result';
import { LiveMatchCard } from '@/components/live-match-card';
import { PositionTracker } from '@/components/position-tracker';

export function DashboardPage() {
  return (
    <div className="space-y-6 lg:space-y-8">
      <KnowledgeHeader />
      <DashboardHero />
      <LiveMatchCard />
      <DashboardStats />
      <LastResult />
      <PositionTracker />
    </div>
  );
}
