import { describe, expect, it } from 'vitest';
import { formatKickoffDayShort } from './kickoff';

// L70 — la bulle « À venir » de la carte : jamais de date ferme quand l'horaire n'est pas fixé.

describe('formatKickoffDayShort', () => {
  it('horaire fixé : la date exacte, jour/mois abrégé', () => {
    expect(formatKickoffDayShort({ date: '2026-12-05T19:00:00', timeConfirmed: true })).toBe('05 déc. 2026');
  });

  it('champ absent (ancien backend) : traité comme fixé', () => {
    expect(formatKickoffDayShort({ date: '2026-12-05T19:00:00' })).toBe('05 déc. 2026');
  });

  it('horaire non fixé un samedi : week-end du samedi', () => {
    expect(formatKickoffDayShort({ date: '2026-12-05T17:00:00', timeConfirmed: false })).toBe('Week-end du 05/12');
  });

  it('horaire non fixé un dimanche : week-end du samedi précédent', () => {
    expect(formatKickoffDayShort({ date: '2026-12-06T12:00:00', timeConfirmed: false })).toBe('Week-end du 05/12');
  });

  it('horaire non fixé un vendredi : week-end du lendemain', () => {
    expect(formatKickoffDayShort({ date: '2026-12-04T12:00:00', timeConfirmed: false })).toBe('Week-end du 05/12');
  });

  it('horaire non fixé en semaine : date à confirmer', () => {
    expect(formatKickoffDayShort({ date: '2026-12-02T12:00:00', timeConfirmed: false })).toBe('Date à confirmer');
  });
});
