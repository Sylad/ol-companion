import { cn } from '@/lib/utils';

/**
 * L22 — pastille « nouveau » : nombre d'entrées non vues (chiffre lisible, pas seulement
 * une couleur) et le même nombre en toutes lettres pour lecteur d'écran, qui complète
 * le nom accessible du lien ou du bouton : « Nouveautés (2 nouveautés non vues) ».
 * Rouge OL plein, texte blanc (4,9:1) : accent « important » de la palette.
 */
export function NewsBadge({
  badge,
  label,
  className,
}: {
  badge: string;
  /** Texte pour lecteur d'écran ; vide si l'appelant le place lui-même (après le libellé). */
  label: string;
  className?: string;
}) {
  if (!badge) return null;
  return (
    <>
      <span
        data-news-badge
        aria-hidden="true"
        className={cn(
          'grid h-[1.125rem] min-w-[1.125rem] place-items-center rounded-full bg-ol-red px-1 text-[10px] font-bold leading-none text-fg-bright',
          className,
        )}
      >
        {badge}
      </span>
      {label && <span className="sr-only"> ({label})</span>}
    </>
  );
}
