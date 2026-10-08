import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  DATE_AND_KICKOFF_TBD,
  KICKOFF_TBD,
  formatKickoffLong,
  hasKickoffTime,
  kickoffTime,
  unconfirmedDay,
} from './kickoff';

// L39 — une heure de coup d'envoi non fixée ne s'affiche plus comme une heure.
// Mesuré en prod le 03-10 : J13 (2026-12-05T00:00:00Z) affiché « 01:00 ».

describe('heure du coup d’envoi', () => {
  const previousTz = process.env.TZ;
  beforeAll(() => {
    process.env.TZ = 'Europe/Paris';
  });
  afterAll(() => {
    process.env.TZ = previousTz;
  });

  it('heure fixée : rendue en heure locale', () => {
    const lens = { date: '2026-10-09T18:45:00.000Z', timeConfirmed: true };
    expect(hasKickoffTime(lens)).toBe(true);
    expect(kickoffTime(lens)).toBe('20:45');
    expect(kickoffTime(lens, 'h')).toBe('20h45');
  });

  it('heure non fixée : aucune heure, ni celle de minuit UTC ni l’heure de remplissage', () => {
    // /api/fixtures (football-data) : minuit UTC, lu « 01:00 » à Paris.
    const j13FootballData = { date: '2026-12-05T00:00:00Z', timeConfirmed: false };
    // /api/season-matches (365scores) : 17:00 UTC de remplissage, lu « 18:00 ».
    const j13Scores365 = { date: '2026-12-05T17:00:00.000Z', timeConfirmed: false };

    for (const match of [j13FootballData, j13Scores365]) {
      expect(hasKickoffTime(match)).toBe(false);
      expect(kickoffTime(match)).toBeNull();
    }
  });

  it('champ absent (backend antérieur) : l’heure est rendue comme avant', () => {
    expect(kickoffTime({ date: '2026-10-09T18:45:00Z' })).toBe('20:45');
  });

  it('libellé long du tableau de bord : la date seule quand l’heure n’est pas fixée', () => {
    expect(formatKickoffLong({ date: '2026-10-09T18:45:00Z', timeConfirmed: true })).toBe(
      'vendredi 9 octobre · 20h45',
    );
    expect(formatKickoffLong({ date: '2026-12-05T00:00:00Z', timeConfirmed: false })).toBe(
      `week-end du 5 décembre · ${KICKOFF_TBD.toLowerCase()}`,
    );
    // Un jour de semaine non fixé : on ne nomme aucun jour.
    expect(formatKickoffLong({ date: '2026-12-02T00:00:00Z', timeConfirmed: false })).toBe(
      DATE_AND_KICKOFF_TBD,
    );
  });

  // L47 — un horaire non fixé veut dire un jour non fixé : le samedi de
  // remplissage (18 des 21 lignes « à confirmer ») ne s'affiche plus comme ferme.
  it('jour non fixé : le week-end (vendredi, samedi ou dimanche) est nommé par son samedi', () => {
    expect(unconfirmedDay({ date: '2026-12-05T17:00:00Z', timeConfirmed: false })).toEqual({
      kind: 'weekend',
      saturday: new Date(2026, 11, 5),
    });
    // vendredi et dimanche : le même week-end
    expect(unconfirmedDay({ date: '2026-12-04T12:00:00Z', timeConfirmed: false })).toMatchObject({
      kind: 'weekend',
      saturday: new Date(2026, 11, 5),
    });
    expect(unconfirmedDay({ date: '2026-12-06T12:00:00Z', timeConfirmed: false })).toMatchObject({
      kind: 'weekend',
      saturday: new Date(2026, 11, 5),
    });
  });

  it('jour non fixé en semaine : « inconnu » ; jour fixé ou champ absent : null', () => {
    expect(unconfirmedDay({ date: '2026-12-02T12:00:00Z', timeConfirmed: false })).toEqual({
      kind: 'unknown',
    });
    expect(unconfirmedDay({ date: '2026-12-05T17:00:00Z', timeConfirmed: true })).toBeNull();
    expect(unconfirmedDay({ date: '2026-12-05T17:00:00Z' })).toBeNull();
  });

  it('le libellé complet dit « Date et horaire à confirmer »', () => {
    expect(DATE_AND_KICKOFF_TBD).toBe('Date et horaire à confirmer');
  });

  it('le libellé dit « Horaire à confirmer »', () => {
    expect(KICKOFF_TBD).toBe('Horaire à confirmer');
  });
});
