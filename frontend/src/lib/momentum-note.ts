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
  return `${n} action${n > 1 ? 's' : ''} sur ${total} (${part}) sans équipe, absente${n > 1 ? 's' : ''} du graphe.`;
}

/**
 * L274 : la phrase sous le graphe cite exactement ce que le calcul compte. La liste vient du backend
 * (`momentumBasis`, tirée de sa table des poids) ; sans elle (réponse plus ancienne), rien n'est énuméré.
 */
export function basisNote(basis: string[] | undefined): string {
  const kinds = (basis ?? []).filter((k) => k.trim().length > 0);
  if (!kinds.length) return 'Reconstruction à partir du fil du match, sans possession ni occasions franches.';
  // Espace insécable avant « ; » : jamais en début de ligne.
  return `Reconstruction : ${kinds.join(', ')}\u00a0; sans possession ni occasions franches.`;
}
