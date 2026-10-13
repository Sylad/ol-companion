import { describe, expect, it } from 'vitest';
import { cupResult } from './cup-result';
import type { CupMatch } from '@/types/api';

const m = (o: Partial<CupMatch>): CupMatch => ({
  id: 1, date: '2026-02-01T19:00:00Z', homeTeam: 'Lyon', homeTeamId: 523, awayTeam: 'Lille', awayTeamId: 79,
  homeScore: 1, awayScore: 1, status: 'FINISHED', stage: '1/8', stageFr: '1/8 de finale', ...o,
});

describe('cupResult (L140)', () => {
  it('score net : victoire, défaite', () => {
    expect(cupResult(m({ homeScore: 2, awayScore: 0 }))).toEqual({ result: 'W', shootout: false });
    expect(cupResult(m({ homeScore: 0, awayScore: 2 }))).toEqual({ result: 'L', shootout: false });
    expect(cupResult(m({ homeTeam: 'Lille', awayTeam: 'Lyon', homeScore: 0, awayScore: 3 }))).toEqual({ result: 'W', shootout: false });
  });
  it('nul sans qualifié désigné : nul', () => {
    expect(cupResult(m({}))).toEqual({ result: 'D', shootout: false });
  });
  it('nul avec OL qualifié : victoire aux tirs au but ; adversaire qualifié : défaite', () => {
    expect(cupResult(m({ olQualified: true }))).toEqual({ result: 'W', shootout: true });
    expect(cupResult(m({ olQualified: false }))).toEqual({ result: 'L', shootout: true });
  });
  it('manche retour nulle mais qualification au cumul : un nul, pas des tirs au but', () => {
    const first = m({ id: 2, date: '2026-01-25T19:00:00Z', homeTeam: 'Lille', homeTeamId: 79, awayTeam: 'Lyon', awayTeamId: 523, homeScore: 0, awayScore: 2 });
    const second = m({ homeScore: 0, awayScore: 0, olQualified: true });
    expect(cupResult(second, [first, second])).toEqual({ result: 'D', shootout: false });
  });
  it('manche retour nulle, cumul nul : tirs au but', () => {
    const first = m({ id: 2, date: '2026-01-25T19:00:00Z', homeTeam: 'Lille', homeTeamId: 79, awayTeam: 'Lyon', awayTeamId: 523, homeScore: 1, awayScore: 1 });
    const second = m({ homeScore: 2, awayScore: 2, olQualified: false });
    expect(cupResult(second, [first, second])).toEqual({ result: 'L', shootout: true });
  });
  it('match non terminé, sans score ou sans OL : null', () => {
    expect(cupResult(m({ status: 'IN_PLAY' }))).toBeNull();
    expect(cupResult(m({ homeScore: null, awayScore: null }))).toBeNull();
    expect(cupResult(m({ homeTeam: 'Nice', awayTeam: 'Lille' }))).toBeNull();
  });
});
