import type { LiveMatchMomentumActions } from '@/types/api';

/**
 * L274 : des actions qu'aucune équipe ne revendique manquent au graphe ; on le dit, avec leur part,
 * plutôt qu'une moitié vide qui ressemblerait à « aucune occasion » (invariants de carte 5 et 12).
 */
export function unattributedNote(actions: LiveMatchMomentumActions | undefined): string | null {
  if (!actions || actions.unattributed <= 0) return null;
  const total = actions.home + actions.away + actions.unattributed;
  const pct = Math.round((actions.unattributed / total) * 100);
  const part = pct < 1 ? 'moins de 1 %' : `${pct} %`;
  const n = actions.unattributed;
  return `${n} action${n > 1 ? 's' : ''} sur ${total} (${part}) sans équipe reconnue : absente${n > 1 ? 's' : ''} du graphe.`;
}
