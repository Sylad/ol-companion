import type {
  LiveMatchStats,
  LiveMatchSummary,
  LiveMatchTeamStats,
  LiveMatchTimelineEvent,
  LiveMatchTopPerformer,
  LiveMatchShot,
  LiveMatchSide,
  LiveMatchStatus,
} from './live-match.types';

const OL_365_ID = 465;

/**
 * Parses a 365scores stat value like "5", "12'", "4/8", "70%" into a number.
 * Returns 0 for unknown formats.
 */
export function parseStatValue(v: unknown): number {
  if (typeof v === 'number') return v;
  if (typeof v !== 'string') return 0;
  const s = v.trim();
  if (!s) return 0;
  if (s.includes('/')) {
    const [a] = s.split('/');
    const n = parseFloat(a);
    return Number.isFinite(n) ? n : 0;
  }
  if (s.endsWith('%')) {
    const n = parseFloat(s.slice(0, -1));
    return Number.isFinite(n) ? n : 0;
  }
  if (s.endsWith("'")) {
    const n = parseFloat(s.slice(0, -1));
    return Number.isFinite(n) ? n : 0;
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

function aggregateTeamStats(competitor: any): LiveMatchTeamStats {
  const totals: LiveMatchTeamStats = {};
  const members = competitor?.lineups?.members ?? [];
  for (const m of members) {
    if (m.status !== 1) continue; // starters only (status 1 = Starting)
    for (const s of (m.stats ?? []) as any[]) {
      const name = s.name as string | undefined;
      if (!name) continue;
      totals[name] = (totals[name] ?? 0) + parseStatValue(s.value);
    }
  }
  return totals;
}

function deriveStatus(statusGroup: number): LiveMatchStatus {
  if (statusGroup === 3) return 'live';
  if (statusGroup === 4) return 'ended';
  return 'upcoming';
}

function toSide(c: any): LiveMatchSide {
  return {
    id: c?.id ?? 0,
    name: c?.name ?? '',
    symbolicName: c?.symbolicName ?? '',
    imageVersion: c?.imageVersion ?? 0,
    score: typeof c?.score === 'number' ? c.score : null,
  };
}

function describeEvent(e: any): string {
  const eventType = e?.eventType ?? {};
  const type: string = eventType.name ?? '';
  const subType: string = eventType.subTypeName ?? '';
  return [type, subType].filter(Boolean).join(' — ') || 'Événement';
}

function eventTypeKey(e: any): string {
  const id: number = e?.eventType?.id ?? 0;
  const subId: number = e?.eventType?.subTypeId ?? 0;
  const name: string = String(e?.eventType?.name ?? '').toLowerCase();
  const subName: string = String(e?.eventType?.subTypeName ?? '').toLowerCase();
  const combined = `${name} ${subName}`;
  // map a couple of common 365scores ids to friendly keys; fallback to label heuristics.
  if (id === 1) {
    if (combined.includes('penalti') || subId === 3 || subId === 8) return 'penalty_goal';
    if (combined.includes('csc') || combined.includes('contre son camp') || subId === 4) return 'own_goal';
    return 'goal';
  }
  if (id === 2) {
    if (combined.includes('rouge')) return 'red_card';
    if (combined.includes('2e') || combined.includes('second')) return 'second_yellow_red';
    if (combined.includes('jaune')) return 'yellow_card';
    if (subId === 1) return 'yellow_card';
    if (subId === 2) return 'red_card';
    if (subId === 3) return 'second_yellow_red';
    return 'card';
  }
  if (id === 3) return 'substitution';
  if (id === 4) return 'var';
  if (id === 16) return 'penalty_missed';
  return `event_${id}_${subId}`;
}

function toTimelineEvents(g: any): LiveMatchTimelineEvent[] {
  const events: any[] = g?.events ?? [];
  return events.map((e) => ({
    competitorId: e?.competitorId ?? 0,
    gameTime: typeof e?.gameTime === 'number' ? e.gameTime : 0,
    gameTimeDisplay: e?.gameTimeDisplay ?? '',
    type: eventTypeKey(e),
    isMajor: !!e?.isMajor,
    playerId: typeof e?.playerId === 'number' ? e.playerId : null,
    extraPlayerId: Array.isArray(e?.extraPlayers) && e.extraPlayers.length > 0 ? e.extraPlayers[0] : null,
    description: describeEvent(e),
  })).sort((a, b) => a.gameTime - b.gameTime);
}

function shotOutcome(o: any): string {
  return o?.name ?? '';
}

function toShots(g: any): LiveMatchShot[] {
  const events: any[] = g?.chartEvents?.events ?? [];
  return events
    .filter((e) => typeof e?.competitorNum === 'number')
    .map((e) => {
      const competitorId = e.competitorNum === 1 ? g.homeCompetitor?.id : g.awayCompetitor?.id;
      return {
        competitorId: competitorId ?? 0,
        playerId: e.playerId ?? 0,
        time: e.time ?? '',
        xg: parseStatValue(e.xg),
        xgot: parseStatValue(e.xgot),
        bodyPart: e.bodyPart ?? '',
        outcome: shotOutcome(e.outcome),
        line: typeof e.line === 'number' ? e.line : 0,
        side: typeof e.side === 'number' ? e.side : 0,
      };
    });
}

function toTopPerformers(g: any): LiveMatchTopPerformer[] {
  const cats: any[] = g?.topPerformers?.categories ?? [];
  return cats.map((c) => {
    const homeP = c?.homePlayer;
    const awayP = c?.awayPlayer;
    const firstStat = (p: any) => p?.stats?.[0] ?? {};
    return {
      role: c?.name ?? '',
      homePlayer: homeP
        ? {
            id: homeP.athleteId ?? homeP.id ?? 0,
            name: homeP.name ?? '',
            statName: firstStat(homeP).name ?? '',
            statValue: String(firstStat(homeP).value ?? ''),
          }
        : null,
      awayPlayer: awayP
        ? {
            id: awayP.athleteId ?? awayP.id ?? 0,
            name: awayP.name ?? '',
            statName: firstStat(awayP).name ?? '',
            statValue: String(firstStat(awayP).value ?? ''),
          }
        : null,
    };
  });
}

export function summarize(rawGame: any): LiveMatchSummary {
  const home = rawGame.homeCompetitor;
  const away = rawGame.awayCompetitor;
  return {
    gameId: rawGame.id,
    matchupId: `${home.id}-${away.id}-${rawGame.id}`,
    competitionId: rawGame.competitionId,
    competitionName: rawGame.competitionDisplayName ?? '',
    status: deriveStatus(rawGame.statusGroup),
    statusGroup: rawGame.statusGroup,
    statusText: rawGame.statusText ?? '',
    gameTime: typeof rawGame.gameTime === 'number' ? rawGame.gameTime : 0,
    gameTimeDisplay: rawGame.gameTimeDisplay ?? '',
    startTime: rawGame.startTime,
    home: toSide(home),
    away: toSide(away),
  };
}

export function aggregate(raw365Response: any): LiveMatchStats {
  const game = raw365Response?.game;
  if (!game) throw new Error('Missing game in 365scores response');
  const summary = summarize(game);
  return {
    ...summary,
    teamStats: {
      home: aggregateTeamStats(game.homeCompetitor),
      away: aggregateTeamStats(game.awayCompetitor),
    },
    events: toTimelineEvents(game),
    topPerformers: toTopPerformers(game),
    shots: toShots(game),
    updatedAt: new Date().toISOString(),
  };
}

export const LIVE_MATCH_OL_ID = OL_365_ID;
