/**
 * Heure du coup d'envoi — une seule règle pour tous les écrans (L39).
 *
 * L'API dit quand l'heure d'un match n'est pas fixée (`timeConfirmed: false`,
 * sur /api/season-matches comme sur /api/fixtures). Dans ce cas la date porte
 * une heure qui ne veut rien dire (minuit UTC chez football-data, une heure de
 * remplissage chez 365scores) : on ne l'affiche jamais.
 */

/** Libellé affiché à la place de l'heure quand elle n'est pas fixée. */
export const KICKOFF_TBD = 'Horaire à confirmer';

interface WithKickoff {
  date: string;
  /** Absent d'un backend antérieur au champ : l'heure est alors affichée. */
  timeConfirmed?: boolean;
}

const WEEKDAY_LONG = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MONTH_LONG = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

const pad = (n: number): string => n.toString().padStart(2, '0');

export function hasKickoffTime(match: WithKickoff): boolean {
  return match.timeConfirmed !== false;
}

/** « 20:45 » (ou « 20h45 ») en heure locale ; `null` quand l'heure n'est pas fixée. */
export function kickoffTime(match: WithKickoff, separator: ':' | 'h' = ':'): string | null {
  if (!hasKickoffTime(match)) return null;
  const d = new Date(match.date);
  return `${pad(d.getHours())}${separator}${pad(d.getMinutes())}`;
}

/** « vendredi 9 octobre · 20h45 », ou « samedi 5 décembre · horaire à confirmer ». */
export function formatKickoffLong(match: WithKickoff): string {
  const d = new Date(match.date);
  const day = `${WEEKDAY_LONG[d.getDay()]} ${d.getDate()} ${MONTH_LONG[d.getMonth()]}`;
  return `${day} · ${kickoffTime(match, 'h') ?? KICKOFF_TBD.toLowerCase()}`;
}
