/**
 * L266 — sens des chiffres du bloc « Joueurs en vue » (`game.topPerformers` de 365scores).
 *
 * 365scores ne dit ni l'unité ni la période d'un chiffre : il donne `{ type, name, value }`,
 * avec un `name` parfois anglais (« Tackles »), et les `type` n'ont PAS le même sens avant
 * et après le coup d'envoi :
 *
 * - **match à venir** : chiffres de la saison du joueur dans la compétition du match
 *   (types de la fiche joueur : 1 buts, 2 passes décisives, 3 cartons, 5 apparitions, 38 tacles).
 *   Les totaux (1, 2, 5) sont ceux du classement des joueurs de Ligue 1
 *   (`/web/stats/?competitions=35`, relevé du 20-11 : Nuamah 4 buts, Tolisso 3 passes) ;
 *   le type 38 y est le tableau « Tacles Gagnés », en MOYENNE PAR MATCH (de 2,7 à 1,3 pour
 *   les 20 premiers). Lille – Lyon : Niakhate « Tackles 0.1 » pour 8 apparitions = 0,1 tacle
 *   gagné par match, pas 0,1 tacle (fixtures `365_game_lille_lyon_upcoming_L266.json`,
 *   `365_stats_ligue1_joueurs_L266.json`).
 * - **match en cours ou terminé** : chiffres de CE match (27 buts, 26 passes décisives,
 *   30 minutes jouées — 26 à la 26e minute —, 76 buts attendus, 4 tirs cadrés,
 *   41 interceptions, 40 dégagements, 20 tacles).
 *
 * Un type absent de ces tables n'a pas de sens établi : il n'est pas affiché.
 */

export type TopPerformerPeriod = 'saison' | 'match';

interface StatMeaning {
  label: string;
  /** Moyenne par match : toujours une décimale (« 1,0 », pas « 1 » qu'on lirait comme un total). */
  perMatch?: boolean;
}

const SEASON_STATS: Record<number, StatMeaning> = {
  1: { label: 'Buts' },
  2: { label: 'Passes décisives' },
  3: { label: 'Cartons jaunes : rouges' },
  5: { label: 'Matchs joués' },
  38: { label: 'Tacles gagnés par match', perMatch: true },
};

const MATCH_STATS: Record<number, StatMeaning> = {
  4: { label: 'Tirs cadrés' },
  20: { label: 'Tacles' },
  26: { label: 'Passes décisives' },
  27: { label: 'Buts' },
  30: { label: 'Minutes jouées' },
  40: { label: 'Dégagements' },
  41: { label: 'Interceptions' },
  76: { label: 'Buts attendus (xG)' },
};

export interface RawPerformerStat {
  type?: number;
  name?: string;
  value?: string | number;
}

/**
 * Premier chiffre au sens établi d'un joueur (l'ordre de 365scores met le chiffre phare
 * en tête), libellé explicite en français ; `null` si aucun ne l'est.
 */
export function performerStat(
  stats: RawPerformerStat[] | undefined,
  period: TopPerformerPeriod,
): { statName: string; statValue: string } | null {
  const table = period === 'saison' ? SEASON_STATS : MATCH_STATS;
  for (const s of stats ?? []) {
    if (typeof s.type !== 'number') continue;
    const meaning = table[s.type];
    if (!meaning || s.value === undefined || s.value === null || String(s.value).trim() === '') continue;
    const raw = String(s.value).trim();
    if (meaning.perMatch) {
      const n = Number(raw);
      if (!Number.isFinite(n)) continue;
      return { statName: meaning.label, statValue: n.toFixed(1) };
    }
    return { statName: meaning.label, statValue: raw };
  }
  return null;
}
