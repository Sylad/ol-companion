import { ExternalLink } from 'lucide-react';
import type { NewsItem } from '@/types/api';
import { cn } from '@/lib/utils';
import { displayNews } from '@/lib/news-display';

interface NewsCardProps {
  item: NewsItem;
  featured?: boolean;
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 0) return new Date(iso).toLocaleDateString('fr-FR');
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `il y a ${d} j`;
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

const SOURCE_TONE: Record<string, string> = {
  'Olympique et Lyonnais': 'text-ol-red-bright border-ol-red/40 bg-ol-red/10',
  "L'Équipe": 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10',
  'Google News': 'text-fg-muted border-border-strong bg-surface-2',
};

export function NewsCard({ item, featured = false }: NewsCardProps) {
  const tone = SOURCE_TONE[item.source] ?? SOURCE_TONE['Google News'];
  const { title, source, description } = displayNews(item);

  return (
    <article
      className={cn(
        // Lien étiré (le titre porte le lien, son ::after couvre la carte) : le nom du lien est le titre seul.
        'group relative flex flex-col rounded-md border border-border bg-surface overflow-hidden hover:border-border-strong transition-all',
        'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ol-red-bright',
        featured && 'sm:flex-row',
      )}
    >
      {item.image && (
        <div
          className={cn(
            'relative overflow-hidden bg-surface-2 shrink-0',
            featured ? 'aspect-[16/10] sm:aspect-auto sm:w-[44%]' : 'aspect-[16/10]',
          )}
        >
          <img
            src={item.image}
            alt=""
            loading="lazy"
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = 'none';
            }}
          />
        </div>
      )}

      <div className="flex flex-col flex-1 p-4 lg:p-5 gap-2">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider">
          <span className={cn('px-2 py-0.5 rounded-sm border font-semibold', tone)}>
            {source}
          </span>
          {item.category && (
            <span className="text-fg-dim font-medium">· {item.category}</span>
          )}
          <span className="text-fg-dim ml-auto whitespace-nowrap normal-case font-medium">
            {formatRelative(item.pubDate)}
          </span>
        </div>

        <h3
          className={cn(
            'font-display font-semibold text-fg-bright leading-snug group-hover:text-ol-red-bright transition-colors',
            featured ? 'text-lg lg:text-xl' : 'text-base',
          )}
        >
          <a
            href={item.link}
            target="_blank"
            rel="noopener noreferrer"
            className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none"
          >
            {title}
            <span className="sr-only"> (nouvel onglet)</span>
          </a>
        </h3>

        {description && (
          <p
            className={cn(
              'text-fg-muted leading-relaxed flex-1',
              featured ? 'text-sm line-clamp-3' : 'text-sm line-clamp-2',
            )}
          >
            {description}
          </p>
        )}

        <div
          aria-hidden="true"
          className="flex items-center gap-1 text-fg-dim text-xs pt-1 lg:opacity-0 lg:group-hover:opacity-100 lg:group-has-[:focus-visible]:opacity-100 transition-opacity"
        >
          <span>Lire l'article</span>
          <ExternalLink className="h-3 w-3" strokeWidth={2} />
        </div>
      </div>
    </article>
  );
}
