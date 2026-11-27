/**
 * Momentum (pression) minute par minute, dérivé du play-by-play 365scores.
 *
 * 365scores n'expose le momentum que via un widget SportRadar dont le flux est
 * verrouillé, et Sofascore répond 403 côté serveur. On le reconstruit donc à
 * partir des commentaires typés (Opta) du feed `pbpgenerator.365scores.com` :
 * chaque action offensive pèse pour l'équipe qui l'a produite, on cumule par
 * minute, on lisse (EMA) et on normalise à ±100. Positif = domicile.
 *
 * Approximation assumée : ce n'est pas le « dangerous attacks » de SportRadar,
 * ni le momentum de Sofascore (qui mêle possession et grandes occasions) ; le
 * flux 365scores n'a ni possession par période ni occasions franches. L'écran
 * le dit sous le graphe (L274).
 *
 * Attribution (L274) : le commentaire écrit le nom de l'équipe à sa façon
 * (« Lillestrøm ») quand le détail du match en donne un autre (« Lillestrom ») ;
 * les noms sont comparés sans accents ni signes (`normaliseTeamName`), contre
 * le nom et le nom long du club. Une action qu'on n'attribue pas est comptée
 * (`countMomentumActions`) et l'écran en donne la part, au lieu d'une moitié
 * de graphe vide qui ressemblerait à « aucune occasion ».
 */

import type { LiveMatchStats } from './live-match.types';

export interface PlayByPlayMessage {
  type: number;
  minute: number;
  period: number;
  comment: string;
  competitorNum?: number;
}

export interface MomentumPoint {
  minute: number;
  /** −100 (pression extérieur) … +100 (pression domicile). */
  value: number;
}

export interface TeamNames {
  homeName: string;
  awayName: string;
  /** Autres noms du club chez 365scores (nom long : « Olympique Lyonnais », « LOSC Lille »). */
  homeAliases?: string[];
  awayAliases?: string[];
}

/** Actions pesées (`MOMENTUM_BASIS`) par équipe, et celles qu'on n'a pas su attribuer. */
export interface MomentumActions {
  home: number;
  away: number;
  unattributed: number;
}

/** Types 365scores/Opta observés (Anderlecht-Lyon 16/09/2026, Lyon-Rennes 19/09/2026). */
const TYPE = {
  ATTEMPT_BLOCKED: 2,
  ATTEMPT_SAVED: 3,
  CORNER: 9,
  FREE_KICK_LOST: 11,
  FREE_KICK_WON: 12,
  GOAL: 14,
  MISS: 20,
  OFFSIDE: 21,
} as const;

const EMA_ALPHA = 0.45;
const MIN_NORMALISATION_DENOMINATOR = 6;

export function parsePlayByPlay(raw: unknown): PlayByPlayMessage[] {
  if (!raw || typeof raw !== 'object') return [];
  const messages = (raw as { Messages?: unknown }).Messages;
  if (!Array.isArray(messages)) return [];
  const out: PlayByPlayMessage[] = [];
  for (const m of messages) {
    if (!m || typeof m !== 'object') continue;
    const r = m as Record<string, unknown>;
    const type = typeof r.Type === 'number' ? r.Type : NaN;
    const minute = parseMinute(r.Timeline);
    if (!Number.isFinite(type) || minute === null) continue;
    out.push({
      type,
      minute,
      period: typeof r.Period === 'string' ? parseInt(r.Period, 10) || 1 : 1,
      comment: typeof r.Comment === 'string' ? r.Comment : '',
      competitorNum:
        typeof r.CompetitorNum === 'number' ? r.CompetitorNum : undefined,
    });
  }
  return out;
}

/** "18" → 18, "45+2" → 45 (le temps additionnel reste sur la minute de base). */
function parseMinute(v: unknown): number | null {
  if (typeof v !== 'string') return null;
  const m = /^(\d+)/.exec(v.trim());
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function attributeTeam(
  msg: { competitorNum?: number; comment: string },
  teams: TeamNames,
): 'home' | 'away' | null {
  if (msg.competitorNum === 1) return 'home';
  if (msg.competitorNum === 2) return 'away';
  const c = msg.comment;
  const byParen = /\(([^)]+)\)/.exec(c)?.[1];
  const byComma = /^[^,.]+,\s*([^.]+)\./.exec(c)?.[1];
  const home = [teams.homeName, ...(teams.homeAliases ?? [])];
  const away = [teams.awayName, ...(teams.awayAliases ?? [])];
  for (const candidate of [byParen, byComma]) {
    if (!candidate) continue;
    const side = matchSide(candidate, home, away);
    if (side) return side;
  }
  return null;
}

/**
 * Nom comparable : sans accents ni lettres liées (ø → o, æ → ae, ß → ss…),
 * en minuscules, ponctuation et espaces réduits à un espace.
 */
export function normaliseTeamName(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[øǿ]/g, 'o')
    .replace(/æ/g, 'ae')
    .replace(/œ/g, 'oe')
    .replace(/ß/g, 'ss')
    .replace(/[đð]/g, 'd')
    .replace(/ł/g, 'l')
    .replace(/ı/g, 'i')
    .replace(/þ/g, 'th')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Le côté dont un nom correspond au candidat : égalité des noms normalisés
 * d'abord, sinon un nom contenu mot pour mot dans l'autre (« Lille » / « LOSC
 * Lille ») — seulement si un seul côté correspond, jamais un pari.
 */
function matchSide(
  candidate: string,
  home: string[],
  away: string[],
): 'home' | 'away' | null {
  const c = normaliseTeamName(candidate);
  if (!c) return null;
  const names = (list: string[]) =>
    list.map(normaliseTeamName).filter((n) => n.length > 0);
  const h = names(home);
  const a = names(away);
  const exactHome = h.includes(c);
  const exactAway = a.includes(c);
  if (exactHome !== exactAway) return exactHome ? 'home' : 'away';
  if (exactHome && exactAway) return null;
  const words = (x: string) => ` ${x} `;
  const contains = (n: string) =>
    words(n).includes(words(c)) || words(c).includes(words(n));
  const looseHome = h.some(contains);
  const looseAway = a.some(contains);
  if (looseHome !== looseAway) return looseHome ? 'home' : 'away';
  return null;
}

/**
 * Coup franc obtenu près du but adverse (camp adverse, aile) : pèse plus qu'un coup franc dans son camp.
 * Le flux 365scores est en anglais depuis l'automne 2026 (« in the attacking half », « on the right wing »,
 * contre « in the defensive half ») ; l'ancien était en français (« moitié de terrain adverse », « aile »).
 */
const DANGEROUS_FREE_KICK = /attacking half|\bwing\b|adverse|aile|surface/i;

/**
 * Ce que le momentum compte, et combien chaque action pèse pour l'équipe qui l'a produite.
 * Source unique des poids ET de la phrase sous le graphe (`MOMENTUM_BASIS`, L274) : une sorte
 * d'action ajoutée ici apparaît d'elle-même dans la légende.
 */
const MOMENTUM_WEIGHTS: Record<
  number,
  { kind: string; weight: (comment: string) => number }
> = {
  [TYPE.GOAL]: { kind: 'tirs', weight: () => 6 },
  [TYPE.ATTEMPT_SAVED]: { kind: 'tirs', weight: () => 3 },
  [TYPE.ATTEMPT_BLOCKED]: { kind: 'tirs', weight: () => 2 },
  [TYPE.MISS]: { kind: 'tirs', weight: () => 2 },
  [TYPE.CORNER]: { kind: 'corners', weight: () => 1.5 },
  [TYPE.FREE_KICK_WON]: {
    kind: 'coups francs obtenus',
    weight: (c) => (DANGEROUS_FREE_KICK.test(c) ? 1 : 0.3),
  },
  [TYPE.OFFSIDE]: { kind: 'hors-jeu', weight: () => 0.5 },
};

/** Sortes d'actions que le momentum compte, dans l'ordre de la table des poids : la phrase sous le graphe. */
export const MOMENTUM_BASIS: readonly string[] = [
  ...new Set(Object.values(MOMENTUM_WEIGHTS).map((w) => w.kind)),
];

/** Poids offensif d'un message pour l'équipe qui l'a produit (0 : non compté). */
export function scoreMessage(msg: { type: number; comment: string }): number {
  return MOMENTUM_WEIGHTS[msg.type]?.weight(msg.comment) ?? 0;
}

/** Compte les actions pesées de chaque équipe et celles qu'aucune équipe ne revendique. */
export function countMomentumActions(
  messages: PlayByPlayMessage[],
  teams: TeamNames,
): MomentumActions {
  const out: MomentumActions = { home: 0, away: 0, unattributed: 0 };
  for (const m of messages) {
    if (scoreMessage(m) === 0) continue;
    const team = attributeTeam(m, teams);
    if (team) out[team]++;
    else out.unattributed++;
  }
  return out;
}

export function computeMomentum(
  messages: PlayByPlayMessage[],
  teams: TeamNames,
  currentMinute: number,
): MomentumPoint[] {
  const lastMinute = Math.max(1, Math.min(120, Math.floor(currentMinute)));
  const rawByMinute = new Array<number>(lastMinute + 1).fill(0);

  for (const m of messages) {
    const w = scoreMessage(m);
    if (w === 0) continue;
    const team = attributeTeam(m, teams);
    if (!team) continue;
    const minute = Math.min(lastMinute, Math.max(1, m.minute));
    rawByMinute[minute] += team === 'home' ? w : -w;
  }

  const smoothed: number[] = [];
  let ema = 0;
  for (let minute = 1; minute <= lastMinute; minute++) {
    ema = EMA_ALPHA * rawByMinute[minute] + (1 - EMA_ALPHA) * ema;
    smoothed.push(ema);
  }

  const peak = Math.max(
    MIN_NORMALISATION_DENOMINATOR,
    ...smoothed.map((v) => Math.abs(v)),
  );
  return smoothed.map((v, i) => ({
    minute: i + 1,
    value: Math.round((v / peak) * 100),
  }));
}

/** Autres noms d'un club chez 365scores (nom long), pour lire le play-by-play (L274). */
export function competitorAliases(
  c: { longName?: string | null; shortName?: string | null } | undefined,
): string[] {
  return [c?.longName, c?.shortName].filter(
    (n): n is string => typeof n === 'string' && n.trim().length > 0,
  );
}

/**
 * Momentum frais, sinon celui de la dernière réponse (L274 : avec ses comptes d'actions).
 * Hors de getStats pour ne pas en alourdir la complexité.
 */
export function applyMomentum(
  payload: Pick<LiveMatchStats, 'momentum' | 'momentumActions' | 'momentumBasis'>,
  fresh: { points: MomentumPoint[]; actions: MomentumActions } | undefined,
  previous: Pick<LiveMatchStats, 'momentum' | 'momentumActions'> | undefined,
): void {
  if (fresh) {
    payload.momentum = fresh.points;
    payload.momentumActions = fresh.actions;
    payload.momentumBasis = [...MOMENTUM_BASIS];
    return;
  }
  if (!previous?.momentum) return;
  payload.momentum = previous.momentum;
  payload.momentumBasis = [...MOMENTUM_BASIS];
  if (previous.momentumActions)
    payload.momentumActions = previous.momentumActions;
}
