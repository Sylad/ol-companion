import type { Scores365StandingsResponse } from '../standings/standings.schema';

/** Ligne du mini-classement affiché sur la page live (OL ± N). */
export interface LiveStandingRow {
  position: number;
  teamId: number;
  name: string;
  played: number;
  points: number;
  goalDifference: number;
  /** L'équipe joue en ce moment (365scores compte déjà le résultat provisoire). */
  isLive: boolean;
  isOl: boolean;
}

/**
 * Extrait la fenêtre du classement autour d'une équipe : `around` lignes de
 * chaque côté, décalée en bord de tableau pour garder 2·around + 1 lignes.
 * `forcePosition` sert aux tests (simuler OL en tête / en queue).
 */
export function extractStandingsAround(
  data: Scores365StandingsResponse,
  teamId: number,
  around: number,
  opts: { forcePosition?: number } = {},
): LiveStandingRow[] {
  const stage = data.standings?.find((s) => s.isCurrentStage) ?? data.standings?.[0];
  const rows = [...(stage?.rows ?? [])].sort((a, b) => a.position - b.position);
  if (rows.length === 0) return [];

  let idx = rows.findIndex((r) => r.competitor.id === teamId);
  if (idx < 0) return [];
  if (opts.forcePosition !== undefined) idx = Math.max(0, Math.min(rows.length - 1, opts.forcePosition - 1));

  const size = Math.min(rows.length, 2 * around + 1);
  let start = idx - around;
  start = Math.max(0, Math.min(start, rows.length - size));

  return rows.slice(start, start + size).map((r) => ({
    position: r.position,
    teamId: r.competitor.id,
    name: r.competitor.name ?? `#${r.competitor.id}`,
    played: r.gamePlayed ?? 0,
    points: r.points ?? 0,
    goalDifference: r.ratio ?? (r.for ?? 0) - (r.against ?? 0),
    isLive: r.liveGameId !== undefined,
    isOl: r.competitor.id === teamId,
  }));
}
