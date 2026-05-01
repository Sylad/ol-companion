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

export const OL_TEAM_ID = 523;
