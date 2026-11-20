import type { Match } from '../fixtures/fixtures.service';
import {
  escapeText,
  formatDate,
  formatUtcDateTime,
  serializeLines,
} from './ics';

/**
 * L264 — le calendrier des matchs de l'OL à s'abonner (`GET /api/calendar.ics`).
 *
 * SOURCE : football-data.org seul. Les conditions de 365scores n'autorisent
 * pas le service à des tiers (docs/etudes/365scores-conditions.md) : aucune
 * donnée de 365scores n'entre dans ce flux, qui est fait pour être recopié par
 * les agendas. football-data, dans son offre gratuite, ne donne de l'OL que la
 * Ligue 1 : les coupes ne sont pas dans le calendrier, et la page /fixtures le
 * dit.
 *
 * Mise à jour sans doublon : l'`UID` ne dépend que de l'identifiant
 * football-data du match ; `SEQUENCE` augmente quand le moment change
 * (heure fixée, avancée, reportée), `LAST-MODIFIED` et `DTSTAMP` datent la
 * dernière modification de l'événement (cf. `reviseEvents`).
 */

export const SITE_URL = 'https://ol.sladoire.dev';

/** Nom de la Ligue 1 dans `competition.name` de football-data. */
export const LIGUE1 = 'Ligue 1';

/** Mention demandée pour les données de football-data (L264) et mention exigée par ses conditions (§ 7.1, L267). */
export const ATTRIBUTION =
  'Données football-data.org (Football data provided by the Football-Data.org API)';

export const CALENDAR_NAME = 'OL – matchs de Ligue 1';

export const CALENDAR_DESCRIPTION =
  "Matchs de Ligue 1 de l'Olympique Lyonnais, mis à jour quand l'horaire est fixé. " +
  'Les coupes (Coupe de France, Ligue Europa, Ligue des champions) ne sont pas incluses : ' +
  'football-data.org ne les fournit pas. ' +
  ATTRIBUTION +
  '.';

/** Durée donnée à un match à l'heure fixée : 90 min de jeu, la mi-temps et les arrêts de jeu. */
export const MATCH_DURATION_MS = 2 * 3600_000;

/** Délai conseillé aux agendas entre deux relectures (RFC 7986 § 5.7). */
export const REFRESH_INTERVAL = 'PT6H';

const DAY_MS = 24 * 3600_000;

/** `fd-559603@ol.sladoire.dev` : ne dépend que du match chez football-data. */
export function eventUid(matchId: number): string {
  return `fd-${matchId}@ol.sladoire.dev`;
}

/** Un événement sans ses lignes de révision (`DTSTAMP`, `LAST-MODIFIED`, `SEQUENCE`). */
export interface EventBody {
  uid: string;
  /** Lignes de contenu, non pliées, entre `BEGIN:VEVENT` et `END:VEVENT`. */
  lines: string[];
  /**
   * Ce qui fait monter `SEQUENCE` (RFC 5545 § 3.8.7.4 : DTSTART, DTEND,
   * STATUS…) : le moment et l'état du match.
   */
  schedule: string;
}

function ordinalMatchday(n: number): string {
  return n === 1 ? '1re journée' : `${n}e journée`;
}

/**
 * Le moment d'un match dont l'horaire n'est pas fixé. football-data met alors
 * le match à minuit UTC d'un jour de la journée (le samedi pour un week-end) :
 * vendredi, samedi ou dimanche → tout le week-end, du vendredi au dimanche
 * (même règle que l'écran, L47) ; un autre jour → ce jour, date à confirmer.
 */
function unconfirmedSpan(date: Date): { start: Date; endExclusive: Date; weekend: boolean } {
  const dow = date.getUTCDay();
  if (dow === 5 || dow === 6 || dow === 0) {
    const toFriday = dow === 5 ? 0 : dow === 6 ? -1 : -2;
    const start = new Date(date.getTime() + toFriday * DAY_MS);
    return { start, endExclusive: new Date(start.getTime() + 3 * DAY_MS), weekend: true };
  }
  return { start: date, endExclusive: new Date(date.getTime() + DAY_MS), weekend: false };
}

/** L'événement d'un match de football-data, sans ses lignes de révision. */
export function eventBody(match: Match): EventBody {
  const uid = eventUid(match.id);
  const date = new Date(match.date);
  const finished = match.status === 'FINISHED' && match.homeScore !== null && match.awayScore !== null;
  const postponed = match.status === 'POSTPONED';

  const teams = finished
    ? `${match.homeTeam} ${match.homeScore}–${match.awayScore} ${match.awayTeam}`
    : `${match.homeTeam} – ${match.awayTeam}`;

  const description: string[] = [];
  description.push(
    match.matchday !== null ? `${LIGUE1}, ${ordinalMatchday(match.matchday)}.` : `${LIGUE1}.`,
  );

  let when: string[];
  let summary = teams;
  let status: 'CONFIRMED' | 'TENTATIVE';
  if (postponed) {
    // Pas de nouvelle date : l'ancienne reste, marquée provisoire.
    summary = `${teams} · reporté`;
    status = 'TENTATIVE';
    description.push('Match reporté : nouvelle date à venir.');
    when = timedLines(date, match.timeConfirmed);
  } else if (match.timeConfirmed) {
    status = 'CONFIRMED';
    when = timedLines(date, true);
  } else {
    const span = unconfirmedSpan(date);
    status = 'TENTATIVE';
    if (span.weekend) {
      summary = `${teams} · horaire à confirmer`;
      description.push(
        "Jour et horaire pas encore fixés : le match a lieu ce week-end. L'événement sera mis à jour dès qu'ils le seront.",
      );
    } else {
      summary = `${teams} · date et horaire à confirmer`;
      description.push(
        "Date et horaire pas encore fixés. L'événement sera mis à jour dès qu'ils le seront.",
      );
    }
    when = [
      `DTSTART;VALUE=DATE:${formatDate(span.start)}`,
      `DTEND;VALUE=DATE:${formatDate(span.endExclusive)}`,
      // Un événement sur la journée entière ne doit pas bloquer l'agenda.
      'TRANSP:TRANSPARENT',
    ];
  }

  description.push(`${ATTRIBUTION}.`);
  description.push(`Calendrier complet : ${SITE_URL}/fixtures`);

  const statusLine = `STATUS:${status}`;
  const lines = [
    `UID:${uid}`,
    ...when,
    `SUMMARY:${escapeText(summary)}`,
    `DESCRIPTION:${escapeText(description.join('\n'))}`,
    `CATEGORIES:${escapeText(LIGUE1)}`,
    statusLine,
  ];
  const schedule = [...when.filter((l) => l.startsWith('DT')), statusLine].join('|');
  return { uid, lines, schedule };
}

function timedLines(date: Date, confirmed: boolean): string[] {
  if (!confirmed) {
    // Reporté sans heure fixée : le jour seul.
    return [
      `DTSTART;VALUE=DATE:${formatDate(date)}`,
      `DTEND;VALUE=DATE:${formatDate(new Date(date.getTime() + DAY_MS))}`,
      'TRANSP:TRANSPARENT',
    ];
  }
  return [
    `DTSTART:${formatUtcDateTime(date)}`,
    `DTEND:${formatUtcDateTime(new Date(date.getTime() + MATCH_DURATION_MS))}`,
  ];
}

/** Ce que l'app retient d'un événement déjà publié. */
export interface Revision {
  /** `EventBody.schedule` publié. */
  schedule: string;
  /** Empreinte de toutes les lignes publiées (score, libellés…). */
  content: string;
  sequence: number;
  /** Instant ISO de la dernière modification. */
  modified: string;
}

export type Revisions = Record<string, Revision>;

function isRevision(value: unknown): value is Revision {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const r = value as Record<string, unknown>;
  return (
    typeof r.schedule === 'string' &&
    typeof r.content === 'string' &&
    Number.isInteger(r.sequence) &&
    (r.sequence as number) >= 0 &&
    typeof r.modified === 'string' &&
    !Number.isNaN(new Date(r.modified).getTime())
  );
}

/**
 * L268 — les révisions lues sur disque, sans ce qui n'en est pas une. Un JSON
 * valide d'une autre forme (`null`, tableau, nombre) ou une entrée `null` ou
 * incomplète faisait une TypeError à chaque requête (`previous[uid]`,
 * `rev.modified`). Le fichier entier d'une autre forme est ignoré ; une entrée
 * invalide l'est seule (le match repart en `SEQUENCE` 0 et l'entrée est
 * réécrite par `reviseEvents`), les autres sont gardées. `rejected` décrit ce
 * qui a été écarté, `null` si rien.
 */
export function validRevisions(parsed: unknown): { revisions: Revisions; rejected: string | null } {
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    const kind = parsed === null ? 'null' : Array.isArray(parsed) ? 'tableau' : typeof parsed;
    return { revisions: {}, rejected: `contenu de type ${kind}, objet attendu` };
  }
  const revisions: Revisions = {};
  const bad: string[] = [];
  for (const [uid, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (isRevision(value)) revisions[uid] = value;
    else bad.push(uid);
  }
  return {
    revisions,
    rejected: bad.length === 0 ? null : `${bad.length} entrée(s) invalide(s) : ${bad.join(', ')}`,
  };
}

/**
 * Révisions des événements (RFC 5545 § 3.8.7.2 à 3.8.7.4) :
 *
 * - événement nouveau → `SEQUENCE` 0, modifié maintenant ;
 * - moment ou état changé (heure fixée, avancée, reportée) → `SEQUENCE` + 1 ;
 * - autre changement (score, libellé) → même `SEQUENCE`, nouvelle date de
 *   modification ;
 * - rien de changé → tout reste : le flux est identique d'une lecture à
 *   l'autre, `DTSTAMP` compris.
 *
 * Les révisions d'un match sorti du flux sont gardées : s'il revient, sa
 * `SEQUENCE` ne redescend pas.
 */
export function reviseEvents(
  previous: Revisions,
  bodies: EventBody[],
  now: Date,
): { revisions: Revisions; changed: boolean } {
  const revisions: Revisions = { ...previous };
  let changed = false;
  const modified = now.toISOString();
  for (const body of bodies) {
    const content = body.lines.join('\n');
    const prev = previous[body.uid];
    if (!prev) {
      revisions[body.uid] = { schedule: body.schedule, content, sequence: 0, modified };
      changed = true;
    } else if (prev.schedule !== body.schedule) {
      revisions[body.uid] = { schedule: body.schedule, content, sequence: prev.sequence + 1, modified };
      changed = true;
    } else if (prev.content !== content) {
      revisions[body.uid] = { ...prev, content, modified };
      changed = true;
    }
  }
  return { revisions, changed };
}

/** Le calendrier complet, prêt à servir (`text/calendar`). */
export function buildCalendar(bodies: EventBody[], revisions: Revisions): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ol.sladoire.dev//OL Companion//FR',
    'CALSCALE:GREGORIAN',
    `NAME:${escapeText(CALENDAR_NAME)}`,
    `X-WR-CALNAME:${escapeText(CALENDAR_NAME)}`,
    `DESCRIPTION:${escapeText(CALENDAR_DESCRIPTION)}`,
    `X-WR-CALDESC:${escapeText(CALENDAR_DESCRIPTION)}`,
    'X-WR-TIMEZONE:Europe/Paris',
    `REFRESH-INTERVAL;VALUE=DURATION:${REFRESH_INTERVAL}`,
    `X-PUBLISHED-TTL:${REFRESH_INTERVAL}`,
    `URL:${SITE_URL}/fixtures`,
  ];
  for (const body of bodies) {
    const rev = revisions[body.uid];
    // Sans METHOD, DTSTAMP date la dernière révision de l'événement (§ 3.8.7.2).
    const stamp = formatUtcDateTime(new Date(rev.modified));
    lines.push(
      'BEGIN:VEVENT',
      body.lines[0],
      `DTSTAMP:${stamp}`,
      `LAST-MODIFIED:${stamp}`,
      `SEQUENCE:${rev.sequence}`,
      ...body.lines.slice(1),
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return serializeLines(lines);
}
