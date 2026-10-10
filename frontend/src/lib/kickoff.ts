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

/** Libellé quand ni le jour ni l'heure ne sont fixés (L47). */
export const DATE_AND_KICKOFF_TBD = 'Date et horaire à confirmer';

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

/** « 20h45 » (séparateur français, partout dans l'app, L101) en heure locale ; `null` quand l'heure n'est pas fixée. */
export function kickoffTime(match: WithKickoff): string | null {
  if (!hasKickoffTime(match)) return null;
  const d = new Date(match.date);
  return `${pad(d.getHours())}h${pad(d.getMinutes())}`;
}

/**
 * Le jour d'un match dont l'horaire n'est pas fixé (L47) : la date portée par
 * l'API est alors une date de remplissage (un samedi pour 18 lignes sur 21),
 * jamais à afficher comme ferme. Vendredi, samedi ou dimanche → le week-end,
 * nommé par son samedi ; un autre jour → `unknown`. `null` quand l'horaire est fixé.
 */
export type UnconfirmedDay = { kind: 'weekend'; saturday: Date } | { kind: 'unknown' };

export function unconfirmedDay(match: WithKickoff): UnconfirmedDay | null {
  if (hasKickoffTime(match)) return null;
  const d = new Date(match.date);
  const dow = d.getDay();
  if (dow !== 5 && dow !== 6 && dow !== 0) return { kind: 'unknown' };
  const offset = dow === 5 ? 1 : dow === 0 ? -1 : 0;
  return { kind: 'weekend', saturday: new Date(d.getFullYear(), d.getMonth(), d.getDate() + offset) };
}

/**
 * « vendredi 9 octobre · 20h45 » ; sans horaire fixé : « week-end du 5 décembre ·
 * horaire à confirmer », ou « Date et horaire à confirmer » hors week-end.
 */
export function formatKickoffLong(match: WithKickoff): string {
  const unconfirmed = unconfirmedDay(match);
  if (unconfirmed?.kind === 'unknown') return DATE_AND_KICKOFF_TBD;
  if (unconfirmed) {
    const s = unconfirmed.saturday;
    return `week-end du ${s.getDate()} ${MONTH_LONG[s.getMonth()]} · ${KICKOFF_TBD.toLowerCase()}`;
  }
  const d = new Date(match.date);
  return `${WEEKDAY_LONG[d.getDay()]} ${d.getDate()} ${MONTH_LONG[d.getMonth()]} · ${kickoffTime(match)}`;
}

/**
 * Le jour d'un match en une courte ligne (bulle de la carte, L70) :
 * « 05 déc. 2026 » quand l'horaire est fixé ; sinon jamais la date de
 * remplissage — « Week-end du 05/12 » (vendredi à dimanche) ou « Date à confirmer ».
 */
export function formatKickoffDayShort(match: WithKickoff): string {
  const unconfirmed = unconfirmedDay(match);
  if (unconfirmed?.kind === 'unknown') return 'Date à confirmer';
  if (unconfirmed) {
    const s = unconfirmed.saturday;
    return `Week-end du ${pad(s.getDate())}/${pad(s.getMonth() + 1)}`;
  }
  return new Date(match.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}
