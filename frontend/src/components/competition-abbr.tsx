import type { CompetitionCode } from '@/types/api';
import { competitionLong, competitionShort } from '@/lib/competitions';

/** Nom court (C1, C3, CdF) avec le nom long en infobulle et pour les lecteurs d'écran. */
export function CompetitionAbbr({ code }: { code: CompetitionCode }) {
  return (
    <abbr title={competitionLong(code)} className="no-underline">
      {competitionShort(code)}
    </abbr>
  );
}
