import type { LiveMatchMomentumActions } from '@/types/api';

/**
 * L274 : des actions qu'aucune équipe ne revendique manquent au graphe ; on le dit, avec leur part,
 * plutôt qu'une moitié vide qui ressemblerait à « aucune occasion » (invariants de carte 5 et 12).
 * `court` s'affiche dans l'en-tête du bloc (passe 3 : sous le graphe, une ligne de plus faisait passer la
 * rangée Statistiques | Momentum sous le pli de 1366 × 768, R16) ; `complet` en est le texte accessible.
 */
export function unattributedNote(
  actions: LiveMatchMomentumActions | undefined,
): { court: string; complet: string } | null {
  if (!actions || actions.unattributed <= 0) return null;
  const total = actions.home + actions.away + actions.unattributed;
  const pct = Math.round((actions.unattributed / total) * 100);
  const part = pct < 1 ? 'moins de 1 %' : `${pct} %`;
  const n = actions.unattributed;
  const s = n > 1 ? 's' : '';
  return {
    // Espaces insécables : « 38 % » et « sans équipe » ne se coupent pas.
    court: `${n}/${total} action${s} (${part.replace(/ /g, '\u00a0')}) sans\u00a0équipe`,
    complet: `${n} action${s} sur ${total} (${part}) sans équipe, absente${s} du graphe.`,
  };
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
