// L7/t4 — onglet et tri de la page Joueurs dans l'URL : /players?onglet=stats&tri=buts.
// Les valeurs par défaut (composition, bp) ne s'écrivent pas : l'URL reste propre.

export const ONGLETS = ['composition', 'effectif', 'stats'] as const;
export type Onglet = (typeof ONGLETS)[number];

export const TRIS = ['bp', 'buts', 'passes', 'minutes', 'matchs', 'tirs', 'note'] as const;
export type Tri = (typeof TRIS)[number];

export interface PlayersSearch {
  onglet?: Onglet;
  tri?: Tri;
}

export function validatePlayersSearch(search: Record<string, unknown>): PlayersSearch {
  const onglet = ONGLETS.find((o) => o === search.onglet);
  const tri = TRIS.find((t) => t === search.tri);
  return {
    onglet: onglet === 'composition' ? undefined : onglet,
    tri: tri === 'bp' ? undefined : tri,
  };
}
