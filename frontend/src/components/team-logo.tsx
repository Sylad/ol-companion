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
  /**
   * L260 : l'écusson est décoratif par défaut (`alt=""`, WCAG 1.1.1) — partout il est posé à côté du nom du club,
   * qu'un lecteur d'écran lirait deux fois. Donner `label` (le nom) seulement pour un écusson sans nom à côté.
   */
  label?: string;
}

export function TeamLogo({ teamId, name, size = 24, className, src, label }: TeamLogoProps) {
  // Sans adresse fournie : recherche Wikipédia (requête désactivée sinon).
  const { data, isLoading } = useWikiImage(src ? null : teamWikiQuery(teamId, name));
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  const dim = `${size}px`;
  const imageUrl = src ? (failedSrc === src ? null : src) : data?.imageUrl;

  if ((!src && isLoading) || !imageUrl) {
    return (
      <div
        role={label ? 'img' : undefined}
        aria-label={label}
        aria-hidden={label ? undefined : true}
        className={cn(
          'shrink-0 rounded-full bg-surface-2 border border-border flex items-center justify-center',
          className,
        )}
        style={{ width: dim, height: dim }}
      >
        <span className="text-petite font-semibold text-fg-dim uppercase">
          {name.slice(0, 2)}
        </span>
      </div>
    );
  }

  return (
    <img
      src={imageUrl}
      alt={label ?? ''}
      loading="lazy"
      onError={src ? () => setFailedSrc(src) : undefined}
      className={cn('shrink-0 rounded-full object-contain bg-white/5', className)}
      style={{ width: dim, height: dim }}
    />
  );
}
