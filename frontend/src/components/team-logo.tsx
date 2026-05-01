import { useWikiImage } from '@/hooks/use-wiki-image';
import { teamWikiQuery } from '@/lib/team-queries';
import { cn } from '@/lib/utils';

interface TeamLogoProps {
  teamId: number;
  name: string;
  size?: number;
  className?: string;
}

export function TeamLogo({ teamId, name, size = 24, className }: TeamLogoProps) {
  const query = teamWikiQuery(teamId, name);
  const { data, isLoading } = useWikiImage(query);

  const dim = `${size}px`;

  if (isLoading || !data?.imageUrl) {
    return (
      <div
        className={cn(
          'shrink-0 rounded-full bg-surface-2 border border-border flex items-center justify-center',
          className,
        )}
        style={{ width: dim, height: dim }}
      >
        <span className="text-[9px] font-semibold text-fg-dim uppercase">
          {name.slice(0, 2)}
        </span>
      </div>
    );
  }

  return (
    <img
      src={data.imageUrl}
      alt={name}
      loading="lazy"
      className={cn('shrink-0 rounded-full object-contain bg-white/5', className)}
      style={{ width: dim, height: dim }}
    />
  );
}
