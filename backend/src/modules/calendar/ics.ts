/**
 * L264 — écriture d'un calendrier iCalendar (RFC 5545), sans dépendance.
 *
 * Seulement ce dont le flux des matchs a besoin : échappement des valeurs
 * TEXT (§ 3.3.11), pliage des lignes à 75 octets (§ 3.1), fins de ligne CRLF,
 * dates UTC (§ 3.3.5, forme 2) et dates seules (§ 3.3.4).
 */

/** Fin de ligne imposée par la RFC 5545 § 3.1. */
export const CRLF = '\r\n';

/** Longueur maximale d'une ligne, en octets, fin de ligne non comprise (§ 3.1). */
export const MAX_LINE_OCTETS = 75;

/**
 * Valeur TEXT (§ 3.3.11) : barre oblique inverse, point-virgule et virgule
 * échappés, saut de ligne écrit `\n`.
 */
export function escapeText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}

/**
 * Plie une ligne de contenu (§ 3.1) : aucune ligne de plus de 75 octets ; la
 * suite commence par une espace (qui compte dans les 75). On coupe entre deux
 * caractères, jamais au milieu d'une séquence UTF-8.
 */
export function foldLine(line: string): string {
  if (Buffer.byteLength(line, 'utf8') <= MAX_LINE_OCTETS) return line;
  const parts: string[] = [];
  let current = '';
  let currentBytes = 0;
  let limit = MAX_LINE_OCTETS;
  for (const char of line) {
    const bytes = Buffer.byteLength(char, 'utf8');
    if (currentBytes + bytes > limit) {
      parts.push(current);
      current = '';
      currentBytes = 0;
      // Les lignes de suite commencent par une espace : 74 octets de contenu.
      limit = MAX_LINE_OCTETS - 1;
    }
    current += char;
    currentBytes += bytes;
  }
  parts.push(current);
  return parts.join(`${CRLF} `);
}

/** Lignes de contenu → texte iCalendar : chaque ligne pliée et terminée par CRLF. */
export function serializeLines(lines: string[]): string {
  return lines.map((l) => foldLine(l) + CRLF).join('');
}

const pad = (n: number): string => n.toString().padStart(2, '0');

/** `20261121T194500Z` : date et heure UTC (§ 3.3.5, forme 2). */
export function formatUtcDateTime(date: Date): string {
  return (
    `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`
  );
}

/** `20261205` : date seule (§ 3.3.4), prise en UTC. */
export function formatDate(date: Date): string {
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}`;
}
