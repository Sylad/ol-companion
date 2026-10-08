import type { CompetitionCode } from '@/types/api';
import { competitionLong, competitionShort } from '@/lib/competitions';

/** Nom court (C1, C3, CdF) avec le nom long en infobulle et en texte masqué pour les lecteurs d'écran (l'infobulle seule n'est ni au clavier ni au toucher). */
export function CompetitionAbbr({ code }: { code: CompetitionCode }) {
  return (
    <abbr title={competitionLong(code)}>
      <span aria-hidden="true">{competitionShort(code)}</span>
      <span className="sr-only">{competitionLong(code)}</span>
    </abbr>
  );
}
