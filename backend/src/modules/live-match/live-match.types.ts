export type LiveMatchStatus = 'upcoming' | 'live' | 'ended';

export interface LiveMatchSide {
  id: number;          // 365scores competitorId
  name: string;
  symbolicName: string; // ex. 'OL', 'REN'
  imageVersion: number;
  score: number | null;
}

export interface LiveMatchTimelineEvent {
  competitorId: number;
  gameTime: number;          // minute (e.g. 6.0)
  gameTimeDisplay: string;   // "6'", "45+2'"
  type: string;              // 'goal', 'yellow_card', 'red_card', 'substitution', 'penalty_missed', ...
  isMajor: boolean;
  playerId: number | null;
  extraPlayerId: number | null;  // assist player or sub-in
  description: string;            // human-readable label
}

export interface LiveMatchTopPerformer {
  role: string;              // 'Attaquant', 'Milieu de Terrain', 'Défenseur'
  homePlayer: { id: number; name: string; statValue: string; statName: string } | null;
  awayPlayer: { id: number; name: string; statValue: string; statName: string } | null;
}

export interface LiveMatchTeamStats {
  /** Lookup table: French stat name → number value (already aggregated across starters). */
  [statName: string]: number;
}

export interface LiveMatchShot {
  competitorId: number;
  playerId: number;
  time: string;          // "6'"
  xg: number;
  xgot: number;
  bodyPart: string;
  outcome: string;       // 'But', 'Bloqué', 'Cadré', 'Manqué'
  line: number;          // 0-100 field length
  side: number;          // 0-100 field width
}

export interface LiveMatchSummary {
  gameId: number;
  matchupId: string;            // "homeId-awayId-gameId"
  competitionId: number;
  competitionName: string;
  status: LiveMatchStatus;
  statusGroup: number;          // raw from 365scores: 1=upcoming, 3=live, 4=ended
  statusText: string;            // "Première mi-temps", "Mi-temps", "Fin", "Programmé"
  gameTime: number;              // minute
  gameTimeDisplay: string;       // "21'", ""
  startTime: string;             // ISO
  home: LiveMatchSide;
  away: LiveMatchSide;
}

export interface LiveMatchStats extends LiveMatchSummary {
  teamStats: { home: LiveMatchTeamStats; away: LiveMatchTeamStats };
  events: LiveMatchTimelineEvent[];
  topPerformers: LiveMatchTopPerformer[];
  shots: LiveMatchShot[];
  updatedAt: string;             // ISO when payload was assembled
}

export interface LiveMatchChangedPayload {
  gameId: number;
  matchupId: string;
}
