import type { Scores365GameDetailed } from '../../config/scores365-game.schema';
import type { LiveMatchLineup } from './live-match.types';

/** Numéros de maillot (> 0) des joueurs d'un match, par identifiant 365scores. */
export function jerseysOfGame(game: Pick<Scores365GameDetailed, 'members'>): Map<number, number> {
  const out = new Map<number, number>();
  for (const m of game.members ?? []) {
    if (m.id !== undefined && typeof m.jerseyNumber === 'number' && m.jerseyNumber > 0) out.set(m.id, m.jerseyNumber);
  }
  return out;
}

/** Complète, sur place, les joueurs sans numéro (365scores envoie 0 avant le match) avec ceux d'un match précédent. */
export function fillMissingJerseys(lineup: LiveMatchLineup, known: ReadonlyMap<number, number>): void {
  for (const p of [...lineup.starters, ...lineup.bench]) {
    if (p.jerseyNumber === null) p.jerseyNumber = known.get(p.id) ?? null;
  }
}
