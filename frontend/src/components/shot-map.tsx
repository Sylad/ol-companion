import type { LiveMatchShot } from '@/types/api';
import { clubLegendLabel, clubSymbol } from '@/lib/club-symbol';
import { teamColors, type MatchPalette, type TeamColors } from '@/lib/match-palette';
import { cn } from '@/lib/utils';

// Horizontal (landscape) pitch — uses full available width.
// 365scores stores shot coords this way:
//   side = % along the long axis (own goal at 0 → opponent goal at 100)
//   line = % along the short axis (touchline 0 → touchline 100, 50 = centre)
const W = 700;
const H = 450;
const HALF_X = W / 2;
const PEN_W = 110;
const PEN_H = 270;
const PEN_Y = (H - PEN_H) / 2;
const SIX_W = 40;
const SIX_H = 130;
const SIX_Y = (H - SIX_H) / 2;
const SPOT_DIST = 75;

interface Props {
  shots: LiveMatchShot[];
  homeId: number;
  /** La couleur suit l'équipe suivie, pas le côté (L160 R5) : `homeIsOl` dit si c'est le domicile. */
  homeIsOl: boolean;
  /** `bleus` : France bleue, adversaire blanc, sigle tiré du nom et non « OL » (L167 R4). */
  palette?: MatchPalette;
  homeName: string;
  awayName: string;
  homeSymbol: string;
  awaySymbol: string;
  /** id joueur → nom court (depuis les compos) pour le tooltip des tirs. */
  playerNames?: Record<number, string>;
}

export function ShotMap({ shots, homeId, homeIsOl, homeName, awayName, homeSymbol: homeSymbolRaw, awaySymbol: awaySymbolRaw, playerNames = {}, palette = 'ol' }: Props) {
  if (!shots.length) return null;
  // « OL » est le sigle fixe du seul club suivi de la palette OL.
  const homeIsClub = palette === 'ol' && homeIsOl;
  const awayIsClub = palette === 'ol' && !homeIsOl;
  const homeSymbol = clubSymbol(homeSymbolRaw, homeName, homeIsClub);
  const awaySymbol = clubSymbol(awaySymbolRaw, awayName, awayIsClub);

  return (
    <section data-testid="carte-tirs" className="rounded-md bg-surface border border-border overflow-hidden">
      <header className="px-5 py-3 border-b border-border flex items-center justify-between flex-wrap gap-2">
        <h2 className="eyebrow min-w-0">Carte des tirs</h2>
        <div className="flex items-center gap-3 text-[10px] uppercase tracking-wider text-fg-dim">
          <LegendDot colors={teamColors(palette, homeIsOl)} label={clubLegendLabel(homeSymbolRaw, homeName, homeIsClub)} />
          <LegendDot colors={teamColors(palette, !homeIsOl)} label={clubLegendLabel(awaySymbolRaw, awayName, awayIsClub)} />
        </div>
      </header>
      <div className="p-4">
        <div className="relative w-full">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Shot map">
            <Pitch />
            {shots.map((s) => {
              const isHome = s.competitorId === homeId;
              // Landscape pitch: long axis = horizontal (X), short axis = vertical (Y).
              // Home attacks RIGHT (target at right), away attacks LEFT (target at left).
              const x = isHome ? (s.side / 100) * W : (1 - s.side / 100) * W;
              const y = (s.line / 100) * H;
              const r = Math.min(9, 2 + Math.sqrt(Math.max(s.xg, 0.005)) * 9);
              return (
                <ShotMarker
                  key={`${s.playerId}-${s.time}-${s.line}-${s.side}`}
                  x={x}
                  y={y}
                  r={r}
                  colors={teamColors(palette, isHome === homeIsOl)}
                  outcome={s.outcome}
                  shot={s}
                  playerName={playerNames[s.playerId]}
                />
              );
            })}
          </svg>
        </div>
        {/* Sens d'attaque : une ligne sous le terrain, jamais posée dessus (les tirs se concentrent dans les surfaces). */}
        <div data-testid="sens-attaque" className="flex items-center justify-between gap-3 mt-2 text-[10px] uppercase tracking-wider font-bold">
          <span className={teamColors(palette, !homeIsOl).text}>← {awaySymbol} attaque</span>
          <span className={cn('text-right', teamColors(palette, homeIsOl).text)}>{homeSymbol} attaque →</span>
        </div>
        <div className="[display:grid] [grid-template-columns:repeat(2,minmax(0,1fr))] sm:[grid-template-columns:repeat(4,minmax(0,1fr))] gap-2 mt-4 text-[10px] uppercase tracking-wider text-fg-dim">
          <OutcomeLegend label="But" kind="goal" />
          <OutcomeLegend label="Cadré" kind="on-target" />
          <OutcomeLegend label="Bloqué" kind="blocked" />
          <OutcomeLegend label="Manqué" kind="off-target" />
        </div>
        <p className="text-[10px] text-fg-dim mt-2 leading-relaxed">
          Taille du marqueur = qualité du tir (xG). Le rond avec un halo = but.
        </p>
      </div>
    </section>
  );
}

function Pitch() {
  const stroke = 'rgba(255,255,255,0.18)';
  const grass = 'hsl(var(--surface-2) / 0.5)';
  return (
    <g>
      {/* Grass */}
      <rect x={0} y={0} width={W} height={H} fill={grass} />
      {/* Touchlines */}
      <rect x={0.5} y={0.5} width={W - 1} height={H - 1} fill="none" stroke={stroke} strokeWidth={1} />
      {/* Halfway line + center circle */}
      <line x1={HALF_X} y1={0} x2={HALF_X} y2={H} stroke={stroke} strokeWidth={1} />
      <circle cx={HALF_X} cy={H / 2} r={50} fill="none" stroke={stroke} strokeWidth={1} />
      <circle cx={HALF_X} cy={H / 2} r={2} fill={stroke} />
      {/* Left penalty box (away team's target = home defending) */}
      <rect x={0} y={PEN_Y} width={PEN_W} height={PEN_H} fill="none" stroke={stroke} strokeWidth={1} />
      <rect x={0} y={SIX_Y} width={SIX_W} height={SIX_H} fill="none" stroke={stroke} strokeWidth={1} />
      <circle cx={SPOT_DIST} cy={H / 2} r={2} fill={stroke} />
      {/* Right penalty box (home team's target = away defending) */}
      <rect x={W - PEN_W} y={PEN_Y} width={PEN_W} height={PEN_H} fill="none" stroke={stroke} strokeWidth={1} />
      <rect x={W - SIX_W} y={SIX_Y} width={SIX_W} height={SIX_H} fill="none" stroke={stroke} strokeWidth={1} />
      <circle cx={W - SPOT_DIST} cy={H / 2} r={2} fill={stroke} />
    </g>
  );
}

function ShotMarker({
  x,
  y,
  r,
  colors,
  outcome,
  shot,
  playerName,
}: {
  x: number;
  y: number;
  r: number;
  colors: TeamColors;
  outcome: string;
  shot: LiveMatchShot;
  playerName?: string;
}) {
  const fill = colors.fill;
  const stroke = fill;
  const isGoal = outcome === 'But';
  const isBlocked = outcome === 'Bloqué' || outcome === 'Blocked';
  const isMissed = outcome === 'Manqué' || outcome === 'Missed' || outcome === 'Hors cadre';

  const title = [
    shot.time,
    playerName,
    outcome,
    `xG ${shot.xg.toFixed(2)}${shot.xgot > 0 ? ` · xGOT ${shot.xgot.toFixed(2)}` : ''}`,
    shot.bodyPart,
  ].filter(Boolean).join(' · ');

  if (isBlocked) {
    const half = Math.max(r, 3);
    return (
      <g aria-label={title}>
        <title>{title}</title>
        <circle cx={x} cy={y} r={Math.max(half, 6)} fill="transparent" />
        <line x1={x - half / 1.4} y1={y - half / 1.4} x2={x + half / 1.4} y2={y + half / 1.4} stroke={stroke} strokeWidth={1.75} strokeLinecap="round" />
        <line x1={x - half / 1.4} y1={y + half / 1.4} x2={x + half / 1.4} y2={y - half / 1.4} stroke={stroke} strokeWidth={1.75} strokeLinecap="round" />
      </g>
    );
  }
  if (isMissed) {
    return (
      <g aria-label={title}>
        <title>{title}</title>
        <circle cx={x} cy={y} r={Math.max(r, 6)} fill="transparent" />
        <circle cx={x} cy={y} r={r} fill="none" stroke={stroke} strokeWidth={2} />
      </g>
    );
  }
  if (isGoal) {
    return (
      <g aria-label={title}>
        <title>{title}</title>
        <circle cx={x} cy={y} r={r + 2} fill="none" stroke="white" strokeWidth={1} opacity={0.6} />
        <circle cx={x} cy={y} r={r} fill={fill} stroke="white" strokeWidth={1.25} />
      </g>
    );
  }
  return (
    <g aria-label={title}>
      <title>{title}</title>
      <circle cx={x} cy={y} r={r} fill={fill} stroke={stroke} strokeWidth={1.5} />
    </g>
  );
}

function LegendDot({ colors, label }: { colors: TeamColors; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn('inline-block w-2.5 h-2.5 rounded-full', colors.bg)} />
      <span>{label}</span>
    </span>
  );
}

/** La légende des issues ne porte aucun club : gris neutre. */
function OutcomeLegend({ label, kind }: { label: string; kind: 'goal' | 'on-target' | 'blocked' | 'off-target' }) {
  const size = 14;
  const ink = 'hsl(var(--fg-muted))';
  return (
    <span className="inline-flex items-center gap-1.5">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {kind === 'goal' && <circle cx={size / 2} cy={size / 2} r={size / 2 - 1} fill={ink} stroke="white" strokeWidth={1.5} />}
        {kind === 'on-target' && <circle cx={size / 2} cy={size / 2} r={size / 2 - 1} fill={ink} />}
        {kind === 'blocked' && (
          <>
            <line x1={3} y1={3} x2={size - 3} y2={size - 3} stroke={ink} strokeWidth={2} />
            <line x1={3} y1={size - 3} x2={size - 3} y2={3} stroke={ink} strokeWidth={2} />
          </>
        )}
        {kind === 'off-target' && <circle cx={size / 2} cy={size / 2} r={size / 2 - 2} fill="none" stroke={ink} strokeWidth={1.5} />}
      </svg>
      <span>{label}</span>
    </span>
  );
}
