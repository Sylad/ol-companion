import { Youtube, ExternalLink } from 'lucide-react';
import type { YoutubeChannel } from '@/types/api';
import { cn } from '@/lib/utils';

const TYPE_LABEL: Record<YoutubeChannel['type'], string> = {
  official: 'Officiel',
  media: 'Média',
  creator: 'Créateur',
};

const TYPE_TONE: Record<YoutubeChannel['type'], string> = {
  official: 'text-ol-red-bright bg-ol-red/10 border-ol-red/40',
  media: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30',
  creator: 'text-fg-muted bg-surface-2 border-border-strong',
};

export function YoutubeChannelCard({ channel }: { channel: YoutubeChannel }) {
  return (
    <a
      href={channel.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-start gap-4 rounded-md border border-border bg-surface p-4 hover:border-border-strong transition-all"
    >
      <div className="shrink-0 w-12 h-12 rounded-full bg-ol-red/10 border border-ol-red/30 flex items-center justify-center text-ol-red-bright group-hover:scale-105 transition-transform">
        <Youtube className="h-5 w-5" strokeWidth={2} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="font-semibold text-fg-bright group-hover:text-ol-red-bright transition-colors truncate">
            {channel.name}
          </h3>
          <span
            className={cn(
              'shrink-0 text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded-sm border',
              TYPE_TONE[channel.type],
            )}
          >
            {TYPE_LABEL[channel.type]}
          </span>
        </div>
        <div className="text-xs text-fg-dim font-medium mb-1.5">{channel.handle}</div>
        <p className="text-sm text-fg-muted leading-relaxed line-clamp-2">{channel.description}</p>
      </div>

      <ExternalLink
        className="shrink-0 h-4 w-4 text-fg-dim opacity-0 group-hover:opacity-100 transition-opacity mt-1"
        strokeWidth={2}
      />
    </a>
  );
}
