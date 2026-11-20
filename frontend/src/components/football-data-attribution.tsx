import { cn } from '@/lib/utils';

/**
 * L267 — mention exigée par les conditions de football-data.org (§ 7.1 :
 * « You agree to include the following attribution to Football-Data in your
 * app or website »), mot pour mot, en anglais. À poser partout où une donnée
 * de football-data s'affiche (heure du coup d'envoi d'un match de Ligue 1 :
 * calendrier, accueil, carte, page de match) et sur la page À propos.
 * Étude : docs/etudes/365scores-conditions.md § 5.
 */
export const FOOTBALL_DATA_ATTRIBUTION = 'Football data provided by the Football-Data.org API';
export const FOOTBALL_DATA_URL = 'https://www.football-data.org/';

/** La mention, en lien vers football-data.org, dans le flux du texte qui l'entoure. */
export function FootballDataAttribution({ className }: { className?: string }) {
  return (
    <a
      data-testid="attribution-football-data"
      lang="en"
      href={FOOTBALL_DATA_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={cn('underline underline-offset-2 hover:text-fg-muted', className)}
    >
      {FOOTBALL_DATA_ATTRIBUTION}
    </a>
  );
}

/** Ligne de source autonome : « <ce que fournit football-data> : <mention>. » */
export function FootballDataSourceNote({ what, className }: { what: string; className?: string }) {
  return (
    <p data-testid="source-football-data" className={cn('text-petite leading-snug text-fg-dim', className)}>
      {what} : <FootballDataAttribution />.
    </p>
  );
}
