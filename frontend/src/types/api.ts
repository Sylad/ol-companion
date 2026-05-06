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
}

/**
 * Extended fixture coming from /api/season-matches (365scores-backed,
 * full season). Same wire shape as `Fixture` plus a `competitionCode`
 * discriminator so the UI can switch on a stable code instead of
 * parsing free-form competition names.
 */
export interface SeasonMatch extends Fixture {
  competitionCode: 'L1' | 'CDF' | 'UEL' | 'OTHER';
  competitionId: number;
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
}

export interface CupInfo {
  competitionId: number;
  name: string;
  currentStageFr: string;
  isEliminated: boolean;
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
  imageVersion?: number;
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
  description: string;
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

export interface LiveMatchStats extends LiveMatchSummary {
  teamStats: {
    home: Record<string, number>;
    away: Record<string, number>;
  };
  events: LiveMatchTimelineEvent[];
  topPerformers: LiveMatchTopPerformer[];
  shots: LiveMatchShot[];
  updatedAt: string;
}
