import { useMemo, useState } from 'react';
import { useFixtures } from '@/hooks/use-fixtures';
import { KnowledgeHeader } from '@/components/knowledge-header';
import { MatchCard } from '@/components/match-card';
import { Loader2 } from 'lucide-react';
import type { Fixture } from '@/types/api';
import { cn } from '@/lib/utils';

type FilterTab = 'all' | 'upcoming' | 'past';

const TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'Tout' },
  { key: 'upcoming', label: 'À venir' },
  { key: 'past', label: 'Joués' },
];

function isPast(f: Fixture): boolean {
  return f.status === 'FINISHED' || f.status === 'POSTPONED';
}

function isUpcoming(f: Fixture): boolean {
  return f.status === 'SCHEDULED' || f.status === 'TIMED' || f.status === 'IN_PLAY';
}

function groupByMatchday(fixtures: Fixture[]): Map<string, Fixture[]> {
  const groups = new Map<string, Fixture[]>();
  for (const f of fixtures) {
    const md = f.matchday ?? 0;
    const comp = f.competition ?? 'Autres';
    const key = `${comp} · J${md}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(f);
  }
  return groups;
}

export function FixturesPage() {
  const { data, isLoading, isError } = useFixtures();
  const [tab, setTab] = useState<FilterTab>('all');

  const filtered = useMemo(() => {
    if (!data) return [];
    if (tab === 'upcoming') return data.filter(isUpcoming);
    if (tab === 'past') return data.filter(isPast);
    return data;
  }, [data, tab]);

  const grouped = useMemo(() => groupByMatchday(filtered), [filtered]);

  return (
    <div className="space-y-8">
      <KnowledgeHeader />

      <section className="rounded-md bg-surface border border-border overflow-hidden">
        <header className="px-5 py-4 flex items-center justify-between border-b border-border">
          <div>
            <div className="eyebrow mb-1">Saison 2025-26</div>
            <h2 className="font-display text-xl font-bold text-fg-bright leading-none">
              Calendrier
            </h2>
          </div>
          <div className="flex items-center gap-1 rounded-full border border-border p-1">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  'px-3 py-1 text-xs font-semibold rounded-full transition-colors',
                  tab === t.key
                    ? 'bg-surface-2 text-fg-bright'
                    : 'text-fg-muted hover:text-fg',
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </header>

        <div className="p-5">
          {isLoading && (
            <div className="flex items-center justify-center py-20 text-fg-dim">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              <span>Chargement des matchs…</span>
            </div>
          )}
          {isError && (
            <p className="py-20 text-center text-loss">Erreur de chargement.</p>
          )}
          {data && filtered.length === 0 && (
            <p className="py-20 text-center text-fg-muted">Aucun match dans cette catégorie.</p>
          )}
          {filtered.length > 0 && (
            <div className="space-y-8">
              {Array.from(grouped.entries()).map(([groupKey, fixtures]) => (
                <div key={groupKey}>
                  <h3 className="eyebrow mb-3">{groupKey}</h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {fixtures.map((f) => (
                      <MatchCard key={f.id} fixture={f} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
