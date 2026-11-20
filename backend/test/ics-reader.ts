/**
 * L264 — lecture d'un texte iCalendar pour les tests : défait le pliage
 * (RFC 5545 § 3.1) et rend les composants VEVENT sous forme de propriétés.
 */

/** Défait le pliage : CRLF suivi d'une espace ou d'une tabulation. */
export function unfold(text: string): string {
  return text.replace(/\r\n[ \t]/g, '');
}

/** Lignes de contenu dépliées (sans la ligne vide finale). */
export function contentLines(text: string): string[] {
  return unfold(text).split('\r\n').filter((l) => l !== '');
}

export type Props = Record<string, string>;

/** Chaque VEVENT : « NOM[;PARAMS] » → valeur. */
export function readEvents(text: string): Props[] {
  const events: Props[] = [];
  let current: Props | null = null;
  for (const line of contentLines(text)) {
    if (line === 'BEGIN:VEVENT') current = {};
    else if (line === 'END:VEVENT') {
      if (current) events.push(current);
      current = null;
    } else if (current) {
      const i = line.indexOf(':');
      current[line.slice(0, i)] = line.slice(i + 1);
    }
  }
  return events;
}

/** Valeur TEXT désechappée (§ 3.3.11). */
export function unescapeText(value: string): string {
  return value.replace(/\\([\;,nN])/g, (_, c: string) => (c === 'n' || c === 'N' ? '\n' : c));
}
