/** L273 — `GET /api/next-opponents` : prochain match de Ligue 1 programmé de chaque club (football-data.org). */
export interface NextOpponent {
  /** Club de la ligne, identifiant de `/api/standings` (365scores, OL sous 523). */
  teamId: number;
  /** Adversaire, mêmes identifiants ; `null` si football-data nomme un club non relié. */
  opponentId: number | null;
  /** Nom de l'adversaire chez football-data, repli quand `opponentId` est nul. */
  opponentName: string;
  venue: 'home' | 'away';
  utcDate: string;
  timeConfirmed: boolean;
  matchday: number | null;
}

export interface NextOpponents {
  updatedAt: string;
  /** Plus aucun match de Ligue 1 programmé : la saison est finie. */
  seasonOver: boolean;
  /** Clubs du classement reliés à football-data. */
  linkedTeamIds: number[];
  next: NextOpponent[];
  unlinked: string[];
}
