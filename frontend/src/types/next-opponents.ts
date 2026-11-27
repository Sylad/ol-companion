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
  /** Le match se joue (football-data le dit en cours) : la case le dit « en cours », pas « prochain ». */
  live: boolean;
}

export interface NextOpponents {
  updatedAt: string;
  /** Plus aucun match de Ligue 1 programmé ni en cours : la saison est finie. */
  seasonOver: boolean;
  /** Clubs du classement reliés à football-data. */
  linkedTeamIds: number[];
  next: NextOpponent[];
  unlinked: string[];
}
