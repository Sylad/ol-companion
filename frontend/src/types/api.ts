export type FormOutcome = 'W' | 'D' | 'L';

export interface StandingEntry {
  position: number;
  team: string;
  teamId: number;
  played: number;
  won: number;
  draw: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  recentForm?: FormOutcome[];
  trend?: number;
}

export interface SeasonStandings {
  season: string;
  updatedAt: string;
  currentMatchday: number;
  table: StandingEntry[];
}

export interface HistoryEntry {
  season: string;
  finalPosition: number;
  points: number;
}

export interface OlSeasonRanking {
  matchday: number;
  position: number;
  points: number;
}

export interface WikiImageResult {
  imageUrl: string | null;
  pageTitle: string | null;
  pageUrl: string | null;
}

export type MatchStatus = 'SCHEDULED' | 'TIMED' | 'IN_PLAY' | 'FINISHED' | 'POSTPONED';

export interface Fixture {
  id: number;
  date: string;
  homeTeam: string;
  homeTeamId: number;
  awayTeam: string;
  awayTeamId: number;
  homeScore: number | null;
  awayScore: number | null;
  competition: string;
  status: MatchStatus;
  matchday: number | null;
  /**
   * `false` quand l'heure du coup d'envoi n'est pas fixée : la date porte alors
   * une heure à ne pas afficher (voir `lib/kickoff.ts`). Absent d'un backend
   * antérieur à L39.
   */
  timeConfirmed?: boolean;
}

/**
 * Extended fixture coming from /api/season-matches (365scores-backed,
 * full season, every competition — source of the Calendrier page). Same wire
 * shape as `Fixture` plus a `competitionCode` discriminator so the UI can
 * switch on a stable code instead of parsing free-form competition names.
 */
export interface SeasonMatch extends Fixture {
  competitionCode: CompetitionCode;
  competitionId: number;
  /**
   * Tour et manche d'un match sans journée (« 3e tour de qualification ·
   * aller », « Barrages · retour ») ; `null` sinon. Absent d'un backend
   * antérieur au champ.
   */
  round?: string | null;
  /**
   * Club qualifié aux tirs au but d'un match de coupe fini à égalité (le score
   * ne les compte pas) ; `null` sinon. Absent d'un backend antérieur à L135.
   */
  shootoutWinnerId?: number | null;
  /**
   * Cumul des deux manches, dans le sens domicile / extérieur de ce match,
   * sur une manche retour jouée dont l'aller est connu (L51) ; `null` sinon,
   * absent d'un backend antérieur au champ.
   */
  aggregateScore?: { home: number; away: number } | null;
}

export interface NewsItem {
  title: string;
  link: string;
  pubDate: string;
  source: string;
  description: string;
  image?: string;
  category?: string;
}

export interface CupMatch {
  id: number;
  date: string;
  homeTeam: string;
  homeTeamId: number;
  awayTeam: string;
  awayTeamId: number;
  homeScore: number | null;
  awayScore: number | null;
  status: 'SCHEDULED' | 'IN_PLAY' | 'FINISHED';
  stage: string;
  stageFr: string;
  /** Issue de la confrontation lue sur sa dernière manche : vrai si l'OL est qualifié, faux si l'adversaire l'est ; absent sinon (L140). */
  olQualified?: boolean;
}

export interface CupInfo {
  competitionId: number;
  name: string;
  currentStageFr: string;
  isEliminated: boolean;
  /** Phase de ligue jouée, classement final illisible : ni en lice ni éliminé prouvé. */
  awaitingDraw?: boolean;
  /** Qualifications de la Ligue des champions gagnées : l'OL est en phase de ligue, hors de cette page. */
  qualified?: boolean;
  matches: CupMatch[];
  bracket?: BracketInfo;
}

export interface BracketMatch {
  id: number;
  date: string;
  homeTeam: string; homeTeamId: number; homeLogo?: string;
  awayTeam: string; awayTeamId: number; awayLogo?: string;
  homeScore: number | null; awayScore: number | null;
  status: 'SCHEDULED' | 'IN_PLAY' | 'FINISHED';
  stageNum: number;
  stageFr: string;
  hasOL: boolean;
}

export interface BracketStage {
  stageNum: number;
  stageFr: string;
  matches: BracketMatch[];
}

export interface BracketInfo {
  competitionId: number;
  fromStageNum: number;
  stages: BracketStage[];
}

export interface LineupPlayer {
  id: number;
  athleteId: number;
  name: string;
  shortName: string;
  jerseyNumber: number | null;
  position: string;
  positionShort: string;
  yardLine: number;
  yardSide: number;
  ranking: number | null;
  isStarting: boolean;
  status?: number;
  imageVersion?: number;
}

/** `GET /api/players/squad` : un joueur de l'effectif de l'OL (L210). */
export interface SquadPlayer {
  athleteId: number;
  name: string;
  /** Poste anglais (« Goalkeeper »…), à passer par `positionLabelFr`. */
  position: string;
  jerseyNumber: number | null;
}

export interface LineupResponse {
  gameId: number;
  date: string;
  competition: string;
  matchday: number | null;
  opponent: string;
  opponentId: number;
  isHome: boolean;
  homeScore: number | null;
  awayScore: number | null;
  formation: string;
  starters: LineupPlayer[];
  bench: LineupPlayer[];
  injured: LineupPlayer[];
}

export interface YoutubeChannel {
  id: string;
  name: string;
  handle: string;
  url: string;
  description: string;
  type: 'official' | 'media' | 'creator';
  priority: boolean;
}

/** football-data.org team id (canonical id used across the frontend). */
export const OL_TEAM_ID = 523;

/** 365scores team id (used by /api/standings, /api/cups, /api/live-match payloads). */
export const OL_365SCORES_ID = 465;

export type LiveMatchStatus = 'upcoming' | 'live' | 'ended';

export interface LiveMatchSide {
  id: number;
  name: string;
  symbolicName: string;
  imageVersion: number;
  score: number | null;
}

export interface LiveMatchSummary {
  gameId: number;
  matchupId: string;
  competitionId: number;
  competitionName: string;
  status: LiveMatchStatus;
  statusGroup: number;
  statusText: string;
  gameTime: number;
  gameTimeDisplay: string;
  startTime: string;
  /** Absent d'un backend antérieur au champ : l'heure est alors affichée. */
  timeConfirmed?: boolean;
  home: LiveMatchSide;
  away: LiveMatchSide;
}

export interface LiveMatchTimelineEvent {
  competitorId: number;
  gameTime: number;
  gameTimeDisplay: string;
  type: string;
  isMajor: boolean;
  playerId: number | null;
  extraPlayerId: number | null;
  playerName: string | null;
  playerShortName: string | null;
  extraPlayerName: string | null;
  extraPlayerShortName?: string | null;
  description: string;
  /** True if synthesized client/server-side (e.g. 2nd-yellow → red derivation). */
  derived?: boolean;
}

export interface LiveMatchTopPerformer {
  role: string;
  homePlayer: { id: number; name: string; statValue: string; statName: string } | null;
  awayPlayer: { id: number; name: string; statValue: string; statName: string } | null;
}

export interface LiveMatchShot {
  competitorId: number;
  playerId: number;
  time: string;
  xg: number;
  xgot: number;
  bodyPart: string;
  outcome: string;
  line: number;
  side: number;
}

export interface LiveMatchMomentumPoint {
  minute: number;
  /** −100 (pression extérieur) … +100 (pression domicile). */
  value: number;
}

export interface LiveMatchLineupPlayer {
  /** Identifiant de membre 365scores, propre au match : pas l'`athleteId` de la route /player. */
  id: number;
  /** Identifiant du joueur (celui de /api/players et de la route /player), absent si 365scores ne le donne pas (L209). */
  athleteId?: number;
  name: string;
  shortName: string;
  jerseyNumber: number | null;
  positionShort: string;
  yardLine: number;
  yardSide: number;
  ranking: number | null;
}

export interface LiveMatchLineup {
  formation: string;
  probable?: boolean;
  starters: LiveMatchLineupPlayer[];
  bench: LiveMatchLineupPlayer[];
}

export interface LiveStandingRow {
  position: number;
  teamId: number;
  name: string;
  played: number;
  points: number;
  goalDifference: number;
  isLive: boolean;
  isOl: boolean;
}

export interface LiveMatchStats extends LiveMatchSummary {
  teamStats: {
    home: Record<string, number>;
    away: Record<string, number>;
  };
  events: LiveMatchTimelineEvent[];
  topPerformers: LiveMatchTopPerformer[];
  shots: LiveMatchShot[];
  momentum?: LiveMatchMomentumPoint[];
  lineups?: { home: LiveMatchLineup; away: LiveMatchLineup };
  standings?: LiveStandingRow[];
  updatedAt: string;
}

/* ------------------------------------------------------------------ */
/* Team-level season-cumulative stats — backed by                     */
/* /api/season-matches/team-stats. Derived from season-matches-cache  */
/* so reads cost ~0 and refresh tracks the cron there.                */
/* ------------------------------------------------------------------ */

/**
 * Les compétitions suivies par /api/season-matches (liste tenue côté backend,
 * `TRACKED_COMPETITIONS`). `UCL` = Ligue des champions, qualifications comprises.
 */
export type CompetitionCode = 'L1' | 'CDF' | 'UEL' | 'UCL';

export interface PerCompetitionTeamStats {
  competitionCode: CompetitionCode;
  played: number;
  won: number;
  draw: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  cleanSheets: number;
  points: number;
}

export interface TeamSeasonChartPoint {
  matchIndex: number;
  date: string;
  goalDifference: number;
  points: number | null;
  competitionCode: CompetitionCode;
  result: 'W' | 'D' | 'L';
}

export interface TeamSeasonStats {
  played: number;
  won: number;
  draw: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  goalsForPerMatch: number;
  goalsAgainstPerMatch: number;
  cleanSheets: number;
  cleanSheetRate: number;
  winRate: number;
  perCompetition: PerCompetitionTeamStats[];
  chart: TeamSeasonChartPoint[];
}

/* ------------------------------------------------------------------ */
/* Per-player season-cumulative stats — backed by /api/players/...    */
/* The backend replays the live-match aggregator across every match   */
/* in season-matches-cache so the data sits in one canonical bucket.  */
/* ------------------------------------------------------------------ */

export interface PlayerByMatch {
  gameId: number;
  date: string;
  opponent: string;
  isHome: boolean;
  olScore: number | null;
  opponentScore: number | null;
  result: 'W' | 'D' | 'L' | null;
  competitionCode: CompetitionCode;
  minutes: number;
  goals: number;
  assists: number;
  shots: number;
  shotsOnTarget: number;
  yellowCards: number;
  redCards: number;
  rating: number | null;
  isStarter: boolean;
}

export interface PlayerSeasonStats {
  athleteId: number;
  memberId: number;
  name: string;
  shortName: string;
  jerseyNumber: number | null;
  position: string;
  positionShort: string;
  imageVersion: number | null;
  matchesPlayed: number;
  matchesStarted: number;
  minutesPlayed: number;
  goals: number;
  assists: number;
  goalContributions: number;
  shots: number;
  shotsOnTarget: number;
  shotAccuracy: number;
  yellowCards: number;
  redCards: number;
  averageRating: number | null;
  byMatch: PlayerByMatch[];
}

/** GET /api/france — l'équipe de France A lue sur 365scores (L113). */
export interface FranceTeam {
  id: number;
  name: string;
}

export interface FranceResult {
  id: number;
  date: string;
  home: FranceTeam;
  away: FranceTeam;
  homeScore: number;
  awayScore: number;
  franceIsHome: boolean;
  competition: string;
}

export interface FranceNextMatch {
  id: number;
  date: string;
  timeConfirmed: boolean;
  home: FranceTeam;
  away: FranceTeam;
  competition: string;
}

export interface FrancePlayer {
  id: number;
  name: string;
  /** Poste tel que rendu par 365scores : Goalkeeper, Defender, Midfielder, Attacker. */
  position: string;
  /** Absent quand 365scores ne le donne pas. */
  age: number | null;
}

export interface FranceOverview {
  nextMatch: FranceNextMatch | null;
  results: FranceResult[];
  squad: FrancePlayer[];
}
