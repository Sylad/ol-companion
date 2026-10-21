import { useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useNews, useYoutubeChannels } from '@/hooks/use-news';
import { KnowledgeHeader } from '@/components/knowledge-header';
import { NewsCard } from '@/components/news-card';
import { YoutubeChannelCard } from '@/components/youtube-channel-card';
import { RetryMessage } from '@/components/retry-message';
import { cn } from '@/lib/utils';

const ALL = 'Tous';

export function NewsPage() {
  const { data: news, isLoading: newsLoading, isError: newsError, refetch: refetchNews } = useNews();
  const { data: channels, isLoading: chLoading, isError: chError, refetch: refetchChannels } = useYoutubeChannels();
  const [activeSource, setActiveSource] = useState<string>(ALL);

  const sources = useMemo(() => {
    if (!news?.length) return [ALL];
    const set = new Set<string>();
    for (const n of news) set.add(n.source);
    return [ALL, ...Array.from(set)];
  }, [news]);

  const filtered = useMemo(() => {
    if (!news) return [];
    if (activeSource === ALL) return news;
    return news.filter((n) => n.source === activeSource);
  }, [news, activeSource]);

  const featuredArticle = filtered[0];
  const restArticles = filtered.slice(1);

  const priorityChannels = (channels ?? []).filter((c) => c.priority);
  const otherChannels = (channels ?? []).filter((c) => !c.priority);

  return (
    <div className="space-y-8">
      <KnowledgeHeader compact />
      <h1 className="sr-only">Actu</h1>

      {/* ARTICLES */}
      <section className="rounded-md bg-surface border border-border overflow-hidden">
        <header className="px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border">
          <div>
            <div className="eyebrow mb-1">Dernières news</div>
            <h2 className="font-display text-xl font-bold text-fg-bright leading-none">
              À la une
            </h2>
          </div>
          {sources.length > 1 && (
            <div
              role="group"
              aria-label="Filtrer par source"
              className="flex flex-wrap items-center gap-1 rounded-2xl sm:rounded-full border border-border p-1"
            >
              {sources.map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={activeSource === s}
                  onClick={() => setActiveSource(s)}
                  className={cn(
                    // Sous lg : cible de 40 px (comme les pastilles du calendrier) ; au bureau 24 px.
                    'px-3 py-1 text-xs font-semibold rounded-full whitespace-nowrap transition-colors min-h-10 lg:min-h-0',
                    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ol-red-bright',
                    // Le fond seul fait 1,07:1 sur le groupe : l'anneau fg-muted porte l'état (≥ 3:1, WCAG 1.4.11).
                    activeSource === s
                      ? 'bg-surface-2 text-fg-bright ring-1 ring-fg-muted'
                      : 'text-fg-muted hover:text-fg',
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </header>

        <div className="p-5">
          {newsLoading && (
            <div role="status" className="flex items-center justify-center py-20 text-fg-dim">
              <Loader2 className="h-5 w-5 animate-spin mr-2" aria-hidden="true" />
              <span>Chargement des articles…</span>
            </div>
          )}
          {newsError && !news && (
            <RetryMessage
              message="Impossible de charger les articles."
              onRetry={() => void refetchNews()}
              messageTestId="news-erreur"
              buttonTestId="news-reessayer"
              className="flex flex-col items-center gap-3 py-20 text-center"
            />
          )}
          {news && filtered.length === 0 && (
            <p data-testid="news-vide" className="py-20 text-center text-fg-muted">
              {news.length > 0 && activeSource !== ALL
                ? `Aucun article pour la source « ${activeSource} ». Choisissez « ${ALL} » pour voir les autres sources.`
                : 'Aucun article pour le moment. Revenez dans quelques minutes.'}
            </p>
          )}
          {filtered.length > 0 && (
            <div className="space-y-5">
              {featuredArticle && <NewsCard item={featuredArticle} featured />}
              {restArticles.length > 0 && (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {restArticles.map((n) => (
                    <NewsCard key={n.link} item={n} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* CHAÎNES YOUTUBE */}
      <section className="rounded-md bg-surface border border-border overflow-hidden">
        <header className="px-5 py-4 border-b border-border">
          <div className="eyebrow mb-1">À suivre</div>
          <h2 className="font-display text-xl font-bold text-fg-bright leading-none">
            Chaînes YouTube recommandées
          </h2>
          <p className="text-sm text-fg-muted mt-1.5">
            La sélection officielle, médias et créateurs autour de l'OL.
          </p>
        </header>

        <div className="p-5">
          {chLoading && (
            <div role="status" className="flex items-center justify-center py-10 text-fg-dim">
              <Loader2 className="h-5 w-5 animate-spin mr-2" aria-hidden="true" />
              <span>Chargement…</span>
            </div>
          )}
          {chError && !channels && (
            <RetryMessage
              message="Impossible de charger les chaînes YouTube."
              onRetry={() => void refetchChannels()}
              messageTestId="chaines-erreur"
              buttonTestId="chaines-reessayer"
              className="flex flex-col items-center gap-3 py-6 text-center"
            />
          )}
          {channels?.length === 0 && (
            <p data-testid="chaines-vide" className="py-6 text-center text-sm text-fg-muted">
              Aucune chaîne à afficher pour le moment. Revenez plus tard.
            </p>
          )}
          {channels && channels.length > 0 && (
            <div className="space-y-5">
              {priorityChannels.length > 0 && (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {priorityChannels.map((c) => (
                    <YoutubeChannelCard key={c.id} channel={c} />
                  ))}
                </div>
              )}
              {otherChannels.length > 0 && (
                <details className="group">
                  <summary className="cursor-pointer text-sm text-fg-muted hover:text-fg flex items-center gap-2 select-none">
                    <span className="group-open:rotate-90 transition-transform inline-block">▸</span>
                    Voir {otherChannels.length} autres chaînes
                  </summary>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3 mt-4">
                    {otherChannels.map((c) => (
                      <YoutubeChannelCard key={c.id} channel={c} />
                    ))}
                  </div>
                </details>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
