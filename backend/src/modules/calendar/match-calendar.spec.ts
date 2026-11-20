import type { Match } from '../fixtures/fixtures.service';
import {
  ATTRIBUTION,
  buildCalendar,
  eventBody,
  eventUid,
  reviseEvents,
  type Revisions,
} from './match-calendar';
import { contentLines, readEvents, unescapeText } from '../../../test/ics-reader';

/**
 * L264 — le flux .ics des matchs : format RFC 5545, UID stable, match sans
 * heure en événement sans heure, changement d'heure en mise à jour.
 */

function match(over: Partial<Match> = {}): Match {
  return {
    id: 559624,
    date: '2026-11-21T19:45:00Z',
    homeTeam: 'Olympique Lyonnais',
    homeTeamId: 523,
    awayTeam: 'OGC Nice',
    awayTeamId: 522,
    homeScore: null,
    awayScore: null,
    competition: 'Ligue 1',
    status: 'TIMED',
    matchday: 11,
    timeConfirmed: true,
    ...over,
  };
}

const T0 = new Date('2026-11-20T10:00:00Z');
const T1 = new Date('2026-11-25T08:30:00Z');

function publish(matches: Match[], previous: Revisions = {}, now = T0) {
  const bodies = matches.map(eventBody);
  const { revisions, changed } = reviseEvents(previous, bodies, now);
  return { text: buildCalendar(bodies, revisions), revisions, changed };
}

describe('format du calendrier (RFC 5545)', () => {
  const { text } = publish([
    match(),
    match({ id: 559603, date: '2026-12-05T00:00:00Z', status: 'SCHEDULED', timeConfirmed: false, matchday: 13, homeTeam: 'ESTAC Troyes', awayTeam: 'Olympique Lyonnais' }),
    match({ id: 559718, date: '2026-08-22T18:45:00Z', status: 'FINISHED', homeScore: 2, awayScore: 1, matchday: 1 }),
  ]);

  it('chaque ligne finit par CRLF, aucune LF ni CR isolée', () => {
    expect(text.endsWith('\r\n')).toBe(true);
    expect(text.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/);
  });

  it('aucune ligne de plus de 75 octets (pliage § 3.1)', () => {
    const physical = text.split('\r\n');
    for (const l of physical) expect(Buffer.byteLength(l, 'utf8')).toBeLessThanOrEqual(75);
    // La description est plus longue que 75 octets : le pliage a bien servi.
    expect(physical.some((l) => l.startsWith(' '))).toBe(true);
  });

  it('VCALENDAR complet : VERSION, PRODID, un VEVENT par match, propriétés requises', () => {
    const lines = contentLines(text);
    expect(lines[0]).toBe('BEGIN:VCALENDAR');
    expect(lines[lines.length - 1]).toBe('END:VCALENDAR');
    expect(lines).toContain('VERSION:2.0');
    expect(lines.some((l) => l.startsWith('PRODID:'))).toBe(true);
    const events = readEvents(text);
    expect(events).toHaveLength(3);
    for (const e of events) {
      expect(e.UID).toBeDefined();
      expect(e.DTSTAMP).toMatch(/^\d{8}T\d{6}Z$/);
      expect(e['LAST-MODIFIED']).toBe(e.DTSTAMP);
      expect(e.SEQUENCE).toBe('0');
      expect(Object.keys(e).some((k) => k.startsWith('DTSTART'))).toBe(true);
    }
  });

  it('attribution football-data dans le calendrier et dans chaque événement', () => {
    const lines = contentLines(text);
    const caldesc = lines.find((l) => l.startsWith('X-WR-CALDESC:'))!;
    expect(unescapeText(caldesc.slice('X-WR-CALDESC:'.length))).toContain('Données football-data.org');
    for (const e of readEvents(text)) {
      expect(unescapeText(e.DESCRIPTION)).toContain(ATTRIBUTION);
    }
  });

  it('valeurs TEXT échappées : virgules et sauts de ligne de la description', () => {
    const e = readEvents(text)[0];
    expect(e.DESCRIPTION).toContain('Ligue 1\\, 11e journée.\\n');
    expect(e.DESCRIPTION).not.toMatch(/[^\\],/);
  });

  it('match à l’heure fixée : DTSTART/DTEND en UTC, 2 h', () => {
    const e = readEvents(text)[0];
    expect(e.DTSTART).toBe('20261121T194500Z');
    expect(e.DTEND).toBe('20261121T214500Z');
    expect(e.STATUS).toBe('CONFIRMED');
    expect(unescapeText(e.SUMMARY)).toBe('Olympique Lyonnais – OGC Nice');
  });

  it('match joué : le score dans le titre', () => {
    const e = readEvents(text).find((x) => x.UID === eventUid(559718))!;
    expect(unescapeText(e.SUMMARY)).toBe('Olympique Lyonnais 2–1 OGC Nice');
  });
});

describe('match dont l’heure n’est pas fixée', () => {
  it('samedi à minuit UTC chez football-data : événement en dates seules, tout le week-end, sans heure', () => {
    const { text } = publish([
      match({ id: 559603, date: '2026-12-05T00:00:00Z', status: 'SCHEDULED', timeConfirmed: false, matchday: 13 }),
    ]);
    const [e] = readEvents(text);
    expect(e['DTSTART;VALUE=DATE']).toBe('20261204'); // vendredi
    expect(e['DTEND;VALUE=DATE']).toBe('20261207'); // lundi exclu : vendredi → dimanche
    expect(e.DTSTART).toBeUndefined();
    expect(text).not.toMatch(/T000000Z/); // jamais le minuit UTC de remplissage
    expect(e.STATUS).toBe('TENTATIVE');
    expect(e.TRANSP).toBe('TRANSPARENT');
    expect(unescapeText(e.SUMMARY)).toContain('horaire à confirmer');
  });

  it('jour de semaine : la date seule, « date et horaire à confirmer »', () => {
    const { text } = publish([
      match({ date: '2027-01-13T00:00:00Z', status: 'SCHEDULED', timeConfirmed: false }),
    ]);
    const [e] = readEvents(text);
    expect(e['DTSTART;VALUE=DATE']).toBe('20270113');
    expect(e['DTEND;VALUE=DATE']).toBe('20270114');
    expect(unescapeText(e.SUMMARY)).toContain('date et horaire à confirmer');
  });
});

describe('mise à jour sans doublon', () => {
  const tbd = match({ id: 559603, date: '2026-12-05T00:00:00Z', status: 'SCHEDULED', timeConfirmed: false, matchday: 13 });
  const fixed = match({ id: 559603, date: '2026-12-06T16:00:00Z', status: 'TIMED', timeConfirmed: true, matchday: 13 });

  it('UID stable : ne dépend que de l’identifiant du match', () => {
    expect(eventBody(tbd).uid).toBe('fd-559603@ol.sladoire.dev');
    expect(eventBody(fixed).uid).toBe(eventBody(tbd).uid);
  });

  it('heure fixée ensuite : même UID, SEQUENCE + 1, DTSTAMP et LAST-MODIFIED à la date du changement', () => {
    const first = publish([tbd], {}, T0);
    const second = publish([fixed], first.revisions, T1);
    expect(second.changed).toBe(true);
    const [before] = readEvents(first.text);
    const [after] = readEvents(second.text);
    expect(readEvents(second.text)).toHaveLength(1);
    expect(after.UID).toBe(before.UID);
    expect(before.SEQUENCE).toBe('0');
    expect(after.SEQUENCE).toBe('1');
    expect(before.DTSTAMP).toBe('20261120T100000Z');
    expect(after.DTSTAMP).toBe('20261125T083000Z');
    expect(after['LAST-MODIFIED']).toBe('20261125T083000Z');
    expect(after.DTSTART).toBe('20261206T160000Z');
    expect(after['DTSTART;VALUE=DATE']).toBeUndefined();
  });

  it('heure avancée une seconde fois : SEQUENCE 2', () => {
    const a = publish([tbd], {}, T0);
    const b = publish([fixed], a.revisions, T1);
    const c = publish([{ ...fixed, date: '2026-12-06T20:05:00Z' }], b.revisions, new Date('2026-11-27T09:00:00Z'));
    expect(readEvents(c.text)[0].SEQUENCE).toBe('2');
  });

  it('rien de changé : flux identique octet pour octet, DTSTAMP compris, rien à écrire', () => {
    const a = publish([fixed], {}, T0);
    const b = publish([fixed], a.revisions, T1);
    expect(b.changed).toBe(false);
    expect(b.text).toBe(a.text);
  });

  it('score arrivé : même SEQUENCE (le moment n’a pas changé), date de modification nouvelle', () => {
    const a = publish([fixed], {}, T0);
    const b = publish([{ ...fixed, status: 'FINISHED', homeScore: 1, homeTeam: 'Olympique Lyonnais', awayScore: 0 }], a.revisions, T1);
    const [e] = readEvents(b.text);
    expect(e.SEQUENCE).toBe('0');
    expect(e['LAST-MODIFIED']).toBe('20261125T083000Z');
  });

  it('les révisions d’un match absent du flux sont gardées', () => {
    const a = publish([fixed], {}, T0);
    const b = publish([match()], a.revisions, T1);
    expect(b.revisions[eventUid(559603)]).toEqual(a.revisions[eventUid(559603)]);
  });
});
