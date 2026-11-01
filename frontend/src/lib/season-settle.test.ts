import { describe, expect, it } from 'vitest';
import type { LiveMatchSummary, SeasonMatch } from '@/types/api';
import { IN_PLAY_MAX_MS, settleInPlay } from './season-settle';

// L240 — Lyon-Angers (01-11, coup d'envoi 16:15 UTC) : le flux direct disait « fini » à 19:27 UTC
// pendant que la liste de la saison (cache 30 min) servait encore le match en IN_PLAY (2-0).

const KICKOFF = '2026-11-01T16:15:00Z';
const at = (min: number) => new Date(new Date(KICKOFF).getTime() + min * 60_000);

function match(partial: Partial<SeasonMatch> = {}): SeasonMatch {
  return {
    id: 4735223,
    date: KICKOFF,
    homeTeam: 'Olympique Lyonnais',
    homeTeamId: 523,
    awayTeam: 'Angers',
    awayTeamId: 99,
    homeScore: 2,
    awayScore: 0,
    competition: 'Ligue 1',
    status: 'IN_PLAY',
    matchday: 11,
    timeConfirmed: true,
    competitionCode: 'L1',
    competitionId: 35,
    ...partial,
  };
}

function direct(partial: Partial<LiveMatchSummary> = {}): LiveMatchSummary {
  return {
    gameId: 4735223,
    matchupId: '465-99-35',
    competitionId: 35,
    competitionName: 'France, Ligue 1',
    status: 'ended',
    statusGroup: 4,
    statusText: 'Fin du match',
    gameTime: 90,
    gameTimeDisplay: "90'",
    startTime: KICKOFF,
    home: { id: 465, name: 'Lyon', symbolicName: 'LYO', imageVersion: 1, score: 3 },
    away: { id: 99, name: 'Angers', symbolicName: 'ANG', imageVersion: 1, score: 0 },
    ...partial,
  };
}

describe('settleInPlay (L240)', () => {
  it('R1 — le direct dit fini : le match IN_PLAY de la liste devient FINISHED, avec le score du direct', () => {
    const [m] = settleInPlay([match()], direct(), at(190 - 60));
    expect(m.status).toBe('FINISHED');
    expect(m.homeScore).toBe(3);
    expect(m.awayScore).toBe(0);
  });

  it('R2 — le direct dit toujours « live » pour ce match : il reste IN_PLAY, même passé 3 h', () => {
    const [m] = settleInPlay([match()], direct({ status: 'live', statusGroup: 3 }), at(200));
    expect(m.status).toBe('IN_PLAY');
  });

  it('R3 — pas de direct (null, absent) et match IN_PLAY récent : inchangé', () => {
    expect(settleInPlay([match()], null, at(60))[0].status).toBe('IN_PLAY');
    expect(settleInPlay([match()], undefined, at(60))[0].status).toBe('IN_PLAY');
  });

  it('R4 — IN_PLAY depuis plus de 3 h sans direct qui le dise en cours : plus présenté comme en direct (FINISHED)', () => {
    const [m] = settleInPlay([match()], null, at(IN_PLAY_MAX_MS / 60_000 + 1));
    expect(m.status).toBe('FINISHED');
    expect(m.homeScore).toBe(2);
  });

  it('R4 — pile à 3 h, le match reste en direct (borne)', () => {
    expect(settleInPlay([match()], null, at(IN_PLAY_MAX_MS / 60_000))[0].status).toBe('IN_PLAY');
  });

  it('R5 — un direct fini d’un AUTRE match ne touche pas le match IN_PLAY de la liste', () => {
    const [m] = settleInPlay([match()], direct({ gameId: 1 }), at(60));
    expect(m.status).toBe('IN_PLAY');
  });

  it('R6 — les matchs non IN_PLAY ne changent pas, et l’entrée n’est pas mutée', () => {
    const prevu = match({ id: 2, status: 'SCHEDULED', homeScore: null, awayScore: null, date: '2026-11-08T16:15:00Z' });
    const liste = [prevu, match()];
    const out = settleInPlay(liste, direct(), at(120));
    expect(out[0]).toBe(prevu);
    expect(liste[1].status).toBe('IN_PLAY');
    expect(out[1].status).toBe('FINISHED');
  });

  it('R7 — direct fini sans score connu : on garde le score de la liste', () => {
    const d = direct({
      home: { id: 465, name: 'Lyon', symbolicName: 'LYO', imageVersion: 1, score: null as unknown as number },
      away: { id: 99, name: 'Angers', symbolicName: 'ANG', imageVersion: 1, score: null as unknown as number },
    });
    const [m] = settleInPlay([match()], d, at(120));
    expect(m.homeScore).toBe(2);
    expect(m.awayScore).toBe(0);
  });
});
