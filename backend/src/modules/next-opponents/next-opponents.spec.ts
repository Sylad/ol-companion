import * as fs from 'fs';
import * as path from 'path';
import {
  footballDataToStandingsId,
  LINKED_STANDINGS_IDS,
  SCORES365_TO_FOOTBALL_DATA,
  standingsIdToFootballData,
} from '../../config/club-ids';
import { OL_TEAM_ID } from '../../config/constants';
import type { FdLeagueMatch } from '../match-impact/match-impact';
import { computeNextOpponents } from './next-opponents';

/**
 * L273 — prochain adversaire de chaque club. Calendrier réel des journées 12 et 13 (365scores,
 * relevé le 27-11-2026), remis au format de football-data par la table `club-ids.ts`.
 */
type Raw = {
  roundNum: number;
  startTime: string;
  homeCompetitor: { id: number; name: string };
  awayCompetitor: { id: number; name: string };
};
const real = JSON.parse(
  fs.readFileSync(
    path.resolve(
      __dirname,
      '../../../test/fixtures/365_fixtures_ligue1_j12_j13_L273.json',
    ),
    'utf-8',
  ),
) as { games: Raw[] };
const fdOf = (id365: number): number => SCORES365_TO_FOOTBALL_DATA[id365];
const fdReal: FdLeagueMatch[] = real.games.map((g, i) => ({
  id: i + 1,
  utcDate: new Date(g.startTime).toISOString(),
  status: 'TIMED',
  matchday: g.roundNum,
  homeTeam: { id: fdOf(g.homeCompetitor.id), name: g.homeCompetitor.name },
  awayTeam: { id: fdOf(g.awayCompetitor.id), name: g.awayCompetitor.name },
  score: { home: null, away: null },
}));
/** Les 18 lignes de `/api/standings` en prod le 18-11-2026 (`frontend/tests-navigateur/donnees/api-prod-2026-11-18.json`). */
const standings: { teamId: number; team: string }[] = [
  { teamId: 480, team: 'PSG' },
  { teamId: 478, team: 'Lille' },
  { teamId: 6075, team: 'Paris FC' },
  { teamId: 469, team: 'Olympique de Marseille' },
  { teamId: 523, team: 'Lyon' },
  { teamId: 470, team: 'OGC Nice' },
  { teamId: 471, team: 'Monaco' },
  { teamId: 477, team: 'Rennes' },
  { teamId: 534, team: 'Brest' },
  { teamId: 472, team: 'Lorient' },
  { teamId: 481, team: 'Lens' },
  { teamId: 482, team: 'Toulouse' },
  { teamId: 479, team: 'Strasbourg' },
  { teamId: 476, team: 'Auxerre' },
  { teamId: 468, team: 'Le Mans' },
  { teamId: 493, team: 'Angers' },
  { teamId: 488, team: 'Troyes' },
  { teamId: 485, team: 'Le Havre' },
];

const NOW = new Date('2026-11-27T16:00:00Z');
const byTeam = (r: ReturnType<typeof computeNextOpponents>) =>
  new Map(r.next.map((n) => [n.teamId, n]));

describe('club-ids (L273)', () => {
  it('relie les 18 clubs du classement réel à football-data, sans doublon', () => {
    for (const row of standings)
      expect(standingsIdToFootballData(row.teamId)).toBeDefined();
    const fd = standings.map((r) => standingsIdToFootballData(r.teamId));
    expect(new Set(fd).size).toBe(18);
    expect(LINKED_STANDINGS_IDS).toHaveLength(18);
  });

  it('aller-retour : football-data → classement rend le même club, OL sous 523', () => {
    for (const row of standings)
      expect(
        footballDataToStandingsId(standingsIdToFootballData(row.teamId)!),
      ).toBe(row.teamId);
    expect(footballDataToStandingsId(523)).toBe(OL_TEAM_ID);
  });
});

describe('computeNextOpponents (L273)', () => {
  it('calendrier réel : chaque club a son match de la J12, avec le bon adversaire et le bon côté', () => {
    const r = computeNextOpponents(fdReal, NOW);
    expect(r.seasonOver).toBe(false);
    expect(r.unlinked).toEqual([]);
    expect(r.next).toHaveLength(18);
    const t = byTeam(r);
    // Lyon – Monaco (29-11, 20:45) : Lyon reçoit, Monaco se déplace.
    expect(t.get(OL_TEAM_ID)).toMatchObject({
      opponentId: 471,
      venue: 'home',
      matchday: 12,
      utcDate: '2026-11-29T19:45:00.000Z',
    });
    expect(t.get(471)).toMatchObject({
      opponentId: OL_TEAM_ID,
      venue: 'away',
      matchday: 12,
    });
    // Brest – Paris FC (ce soir) et Auxerre – Marseille.
    expect(t.get(534)).toMatchObject({
      opponentId: 6075,
      venue: 'home',
      matchday: 12,
    });
    expect(t.get(469)).toMatchObject({
      opponentId: 476,
      venue: 'away',
      matchday: 12,
    });
    for (const n of r.next) expect(n.matchday).toBe(12);
  });

  it('un match joué, reporté ou commencé depuis plus de 2 h n’est pas « prochain » : on passe au suivant', () => {
    const played = fdReal.map((m) =>
      m.matchday === 12 && (m.homeTeam.id === 523 || m.awayTeam.id === 523)
        ? { ...m, status: 'FINISHED', score: { home: 1, away: 0 } }
        : m.matchday === 12 && m.homeTeam.id === 512
          ? { ...m, status: 'POSTPONED' }
          : m,
    );
    const t = byTeam(computeNextOpponents(played, NOW));
    expect(t.get(OL_TEAM_ID)).toMatchObject({
      opponentId: 488,
      venue: 'away',
      matchday: 13,
    }); // Troyes – Lyon
    expect(t.get(534)).toMatchObject({
      opponentId: 477,
      venue: 'away',
      matchday: 13,
    }); // Rennes – Brest
    const late = byTeam(
      computeNextOpponents(fdReal, new Date('2026-11-27T22:30:00Z')),
    );
    expect(late.get(534)).toMatchObject({ matchday: 13 }); // Brest – Paris FC, coup d'envoi 19:45Z, passé de 2 h 45
  });
});

describe('computeNextOpponents — heure, fin de saison, club non relié (L273)', () => {
  it('heure non fixée par football-data (SCHEDULED à minuit UTC) → timeConfirmed faux', () => {
    const tbd = fdReal.map((m) =>
      m.homeTeam.id === 523
        ? { ...m, status: 'SCHEDULED', utcDate: '2026-11-29T00:00:00Z' }
        : m,
    );
    expect(
      byTeam(computeNextOpponents(tbd, NOW)).get(OL_TEAM_ID),
    ).toMatchObject({ timeConfirmed: false });
    expect(
      byTeam(computeNextOpponents(fdReal, NOW)).get(OL_TEAM_ID),
    ).toMatchObject({ timeConfirmed: true });
  });

  it('plus aucun match programmé : saison finie, aucune ligne', () => {
    const over = fdReal.map((m) => ({
      ...m,
      status: 'FINISHED',
      score: { home: 0, away: 0 },
    }));
    expect(computeNextOpponents(over, NOW)).toMatchObject({
      seasonOver: true,
      next: [],
    });
  });

  it('club inconnu de la table : adversaire sans identifiant (nom de football-data), club signalé', () => {
    const promoted = fdReal.map((m) =>
      m.homeTeam.id === 523
        ? { ...m, awayTeam: { id: 99999, name: 'Promu FC' } }
        : m,
    );
    const r = computeNextOpponents(promoted, NOW);
    expect(byTeam(r).get(OL_TEAM_ID)).toMatchObject({
      opponentId: null,
      opponentName: 'Promu FC',
    });
    expect(r.unlinked).toEqual(['Promu FC']);
  });
});
