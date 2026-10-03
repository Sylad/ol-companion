import { useState } from 'react';
import { useWikiImage } from '@/hooks/use-wiki-image';
import { teamWikiQuery } from '@/lib/team-queries';
import { cn } from '@/lib/utils';

interface TeamLogoProps {
  teamId: number;
  name: string;
  size?: number;
  className?: string;
  /**
   * Adresse de l'écusson quand elle est déjà connue (CDN 365scores, cf.
   * `clubLogoUrl`). L'image est alors affichée telle quelle, sans appel à
   * /api/wiki-image ; si elle ne charge pas, les initiales la remplacent.
   */
  src?: string;
}

export function TeamLogo({ teamId, name, size = 24, className, src }: TeamLogoProps) {
  // Sans adresse fournie : recherche Wikipédia (requête désactivée sinon).
  const { data, isLoading } = useWikiImage(src ? null : teamWikiQuery(teamId, name));
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  const dim = `${size}px`;
  const imageUrl = src ? (failedSrc === src ? null : src) : data?.imageUrl;

  if ((!src && isLoading) || !imageUrl) {
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
      src={imageUrl}
      alt={name}
      loading="lazy"
      onError={src ? () => setFailedSrc(src) : undefined}
      className={cn('shrink-0 rounded-full object-contain bg-white/5', className)}
      style={{ width: dim, height: dim }}
    />
  );
}
