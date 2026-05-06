import { Suspense, lazy } from 'react';
import { Loader2 } from 'lucide-react';
import { KnowledgeHeader } from '@/components/knowledge-header';

// Lazy-load Leaflet — keeps it out of the main bundle. Saves ~150 kB minified
// for users who never visit /map.
const Ligue1Map = lazy(() =>
  import('@/components/ligue1-map').then((m) => ({ default: m.Ligue1Map })),
);

export function MapPage() {
  return (
    <div className="space-y-8">
      <KnowledgeHeader />

      <section className="rounded-md bg-surface border border-border overflow-hidden">
        <header className="px-5 py-4 border-b border-border">
          <div className="eyebrow mb-1">Saison 2025-26</div>
          <h2 className="font-display text-xl font-bold text-fg-bright leading-none">
            Carte Ligue 1
          </h2>
          <p className="text-xs text-fg-muted mt-2 max-w-prose">
            Les 18 clubs de Ligue 1 sur la carte. Cliquez sur un marqueur pour voir
            la position au classement et le bilan de l'OL face à l'adversaire cette saison.
          </p>
        </header>

        <div className="p-2 sm:p-5">
          <Suspense
            fallback={
              <div className="flex items-center justify-center py-20 text-fg-dim">
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                <span>Chargement de la carte…</span>
              </div>
            }
          >
            <Ligue1Map />
          </Suspense>

          <p className="mt-3 px-1 text-[11px] text-fg-dim">
            Tuiles cartographiques :{' '}
            <a
              href="https://www.openstreetmap.org/copyright"
              target="_blank"
              rel="noopener"
              className="underline hover:text-fg"
            >
              © OpenStreetMap contributors
            </a>{' '}
            · Logos clubs : 365scores.
          </p>
        </div>
      </section>
    </div>
  );
}
