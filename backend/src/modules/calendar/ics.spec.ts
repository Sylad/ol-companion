import {
  CRLF,
  escapeText,
  foldLine,
  formatDate,
  formatUtcDateTime,
  serializeLines,
} from './ics';
import { unfold } from '../../../test/ics-reader';

/** L264 — primitives RFC 5545 : échappement (§ 3.3.11), pliage (§ 3.1), dates (§ 3.3.4, 3.3.5). */


describe('escapeText', () => {
  it('échappe barre oblique inverse, point-virgule, virgule et saut de ligne', () => {
    expect(escapeText('a\\b;c,d\ne')).toBe('a\\\\b\\;c\\,d\\ne');
  });

  it('échappe la barre oblique AVANT le reste (pas de double échappement)', () => {
    expect(escapeText(';')).toBe('\\;');
    expect(escapeText('\\;')).toBe('\\\\\\;');
  });

  it('CRLF et CR deviennent aussi \\n ; deux-points et guillemets restent', () => {
    expect(escapeText('a\r\nb\rc')).toBe('a\\nb\\nc');
    expect(escapeText('Lyon: "OL"')).toBe('Lyon: "OL"');
  });
});

describe('foldLine', () => {
  it('ne touche pas une ligne de 75 octets', () => {
    const line = 'X'.repeat(75);
    expect(foldLine(line)).toBe(line);
  });

  it('plie une ligne longue : 75 octets au plus par ligne, suites commençant par une espace', () => {
    const line = `DESCRIPTION:${'abcdefghij'.repeat(30)}`;
    const folded = foldLine(line);
    const parts = folded.split(CRLF);
    expect(parts.length).toBeGreaterThan(1);
    for (const p of parts) expect(Buffer.byteLength(p, 'utf8')).toBeLessThanOrEqual(75);
    expect(parts[0]).toHaveLength(75);
    for (const p of parts.slice(1)) expect(p.startsWith(' ')).toBe(true);
    expect(unfold(folded)).toBe(line);
  });

  it('compte en octets et ne coupe jamais un caractère UTF-8 (accents, tiret long)', () => {
    const line = `SUMMARY:${'é–à'.repeat(40)}`;
    const folded = foldLine(line);
    for (const p of folded.split(CRLF)) {
      expect(Buffer.byteLength(p, 'utf8')).toBeLessThanOrEqual(75);
      // Une coupe au milieu d'une séquence produirait U+FFFD au décodage.
      expect(Buffer.from(p, 'utf8').toString('utf8')).toBe(p);
      expect(p).not.toContain('�');
    }
    expect(unfold(folded)).toBe(line);
  });
});

describe('serializeLines', () => {
  it('termine chaque ligne par CRLF, jamais par LF seul', () => {
    const text = serializeLines(['BEGIN:VCALENDAR', 'END:VCALENDAR']);
    expect(text).toBe('BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n');
    expect(text.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/);
  });
});

describe('dates', () => {
  it('date-heure UTC (§ 3.3.5 forme 2) et date seule (§ 3.3.4)', () => {
    const d = new Date('2026-11-21T19:45:00Z');
    expect(formatUtcDateTime(d)).toBe('20261121T194500Z');
    expect(formatDate(new Date('2026-12-05T00:00:00Z'))).toBe('20261205');
  });
});
