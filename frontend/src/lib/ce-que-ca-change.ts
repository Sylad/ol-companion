import type { MatchImpact } from '@/types/api';

/**
 * L265 — la phrase « Ce que ça change » : la place de Lyon avant et après le match, et l'écart avec
 * les places clés (mêmes zones que la légende du classement, `standings-table.tsx`). Les nombres
 * viennent tous de `/api/match-impact` (football-data.org seul).
 */

/** Zone que ferme une place clé (au-dessus de Lyon) ou qu'ouvre la place suivante (en dessous). */
const PLACE_ZONE: Record<number, string> = {
  3: 'Ligue des champions',
  5: 'Ligue Europa',
  6: 'Ligue Conférence',
  15: 'maintien direct',
  16: 'barrage de relégation',
};

/** « 1er », « 4e » : la place de Lyon (masculin). */
export const placeClub = (n: number): string => (n === 1 ? '1er' : `${n}e`);

/** « la 1re place », « la 3e place (Ligue des champions) ». */
export function placeCle(n: number): string {
  const zone = PLACE_ZONE[n];
  return `la ${n === 1 ? '1re' : `${n}e`} place${zone ? ` (${zone})` : ''}`;
}

export const journee = (n: number): string => `${n === 1 ? '1re' : `${n}e`} journée`;

const points = (n: number): string => `${n} point${n > 1 ? 's' : ''}`;

function ecartDessus(above: NonNullable<MatchImpact['above']>): string {
  return above.gap === 0
    ? `à égalité de points avec ${placeCle(above.place)}`
    : `à ${points(above.gap)} de ${placeCle(above.place)}`;
}

function ecartDessous(below: NonNullable<MatchImpact['below']>): string {
  const suivante = placeCle(below.place + 1);
  return below.margin === 0
    ? `à égalité de points avec ${suivante}`
    : `${points(below.margin)} d’avance sur ${suivante}`;
}

export interface CeQueCaChange {
  phrase: string;
  /** `null` quand la journée et celles d'avant sont complètes. */
  provisoire: string | null;
}

/** La phrase, ou `null` tant que football-data n'a pas le match terminé. */
export function ceQueCaChange(impact: MatchImpact): CeQueCaChange | null {
  if (!impact.finished || !impact.after) return null;
  const { before, after } = impact;
  const debut =
    before === null
      ? `Lyon est ${placeClub(after.position)} à l’issue de la ${journee(impact.matchday)}`
      : before.position === after.position
        ? `Lyon reste ${placeClub(after.position)}`
        : `Lyon passe de ${placeClub(before.position)} à ${placeClub(after.position)}`;
  const { above, below } = impact;
  // Deux égalités : une seule fois « à égalité de points avec ».
  const ecarts =
    above?.gap === 0 && below?.margin === 0
      ? [`à égalité de points avec ${placeCle(above.place)} et ${placeCle(below.place + 1)}`]
      : [above ? ecartDessus(above) : null, below ? ecartDessous(below) : null].filter((e): e is string => e !== null);
  const phrase = `${debut}${ecarts.length ? `, ${ecarts.join(' et ')}` : ''}.`;

  let provisoire: string | null = null;
  if (impact.remaining > 0) {
    const n = impact.remaining;
    const restent = n > 1 ? 'restent' : 'reste';
    provisoire =
      n === impact.remainingInMatchday
        ? `Classement provisoire : ${n} match${n > 1 ? 's' : ''} de la ${journee(impact.matchday)} ${restent} à jouer.`
        : `Classement provisoire : ${n} match${n > 1 ? 's' : ''} des journées 1 à ${impact.matchday} ${restent} à jouer.`;
  }
  return { phrase, provisoire };
}
