import { useWikiImage } from '@/hooks/use-wiki-image';
import { useStandings } from '@/hooks/use-standings';
import { useCurrentLiveMatch } from '@/hooks/use-live-match';
import { useSeasonMatches } from '@/hooks/use-season-matches';
import { standingsWithoutLive } from '@/lib/standings-without-live';
import { OL_TEAM_ID } from '@/types/api';
import { cn } from '@/lib/utils';

function ordinal(pos: number): string {
  // Français : seul 1 prend « er » — l'indexation pos % 10 produisait « 11er ».
  return pos === 1 ? '1er' : `${pos}e`;
}

/**
 * Bandeau de marque : « Olympique Lyonnais » y est un paragraphe, pas un titre (L206) — le h1 de chaque page est son nom.
 * `compact` : sous 1024 px, une ligne de 40 px (écusson 24 px, titre et rang côte à côte) pour que le contenu
 * de la page remonte dans le premier écran (L50 R9) ; au bureau le bandeau reste le même.
 * Pendant un match de Ligue 1 en cours (L86), les points sont ceux des matchs terminés, comme les tuiles de
 * l'accueil (`standingsWithoutLive`) ; le rang, lui, vient du classement qui compte ce match : il est dit « en direct ».
 */
export function KnowledgeHeader({ compact = false }: { compact?: boolean }) {
  const { data: logo } = useWikiImage('Olympique lyonnais');
  const { data: standings } = useStandings();
  const { data: live } = useCurrentLiveMatch();
  const { data: seasonMatches } = useSeasonMatches();

  const olClassement = standings?.table.find((row) => row.teamId === OL_TEAM_ID);
  const olRow = standingsWithoutLive(olClassement, live, seasonMatches);
  const rangEnDirect = olRow !== olClassement;
  const subtitle = olRow
    ? `${ordinal(olRow.position)} de Ligue 1${rangEnDirect ? ' (en direct)' : ''} · ${olRow.points} pts`
    : 'Ligue 1 · saison en cours';

  return (
    <header
      data-compact={compact || undefined}
      className={cn(
        'flex items-center border-border lg:gap-5 lg:pb-6 lg:border-b',
        compact ? 'min-h-10 gap-2' : 'gap-5 pb-6 border-b',
      )}
    >
      <div className={cn(
          'shrink-0 lg:w-20 lg:h-20 rounded-full bg-white/5 border border-border flex items-center justify-center overflow-hidden',
          compact ? 'w-6 h-6' : 'w-16 h-16',
        )}
      >
        {logo?.imageUrl ? (
          <img src={logo.imageUrl} alt="OL" className="w-full h-full object-contain p-1.5" />
        ) : (
          <span className="font-display font-bold text-fg-muted">OL</span>
        )}
      </div>
      <div className={cn('min-w-0 flex-1', compact && 'flex flex-wrap items-baseline gap-x-2 lg:block')}>
        <p
          className={cn(
            'font-display font-bold text-fg-bright tracking-tight',
            compact ? 'text-base' : 'text-2xl leading-tight',
            // Après les tailles : tailwind-merge retire un `leading-*` placé avant `text-base` / `text-2xl` / `lg:text-[34px]`
            // (une taille de police impose sa hauteur de ligne) : le titre non compact a donc son `leading-tight` dans la même
            // chaîne que `text-2xl` (24 px sur 30 px, pas 32 px). Au bureau : 34 px, leading-tight, comme avant L50.
            'lg:text-[34px] lg:leading-tight',
          )}
        >
          Olympique Lyonnais
        </p>
        <p className={cn('text-sm text-fg-muted lg:mt-1', compact ? 'text-xs lg:text-sm' : 'mt-1')}>{subtitle}</p>
      </div>
    </header>
  );
}
