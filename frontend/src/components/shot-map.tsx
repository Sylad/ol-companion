import type { LiveMatchShot } from '@/types/api';
import { clubLegendLabel, clubSymbol } from '@/lib/club-symbol';
import { teamColors, type MatchPalette, type TeamColors } from '@/lib/match-palette';
import { cn } from '@/lib/utils';
import { decimalFr } from '@/lib/stat-fr';

// Terrain à la verticale (L186 R17), viewBox 450 × 700 : buts en haut et en bas, le club à domicile attaque vers le haut.
// 365scores donne les tirs sur un terrain horizontal :
//   side = % le long de l'axe long (son but à 0 → but adverse à 100)
//   line = % le long de l'axe court (touche à 0 → touche à 100, 50 = axe)
// Rotation d'un quart de tour de l'ancienne carte 700 × 450 : (x, y) → (y, 700 − x).
const W = 450;
const H = 700;
const PEN_W = 270;
const PEN_H = 110;
const PEN_X = (W - PEN_W) / 2;
const SIX_W = 130;
const SIX_H = 40;
const SIX_X = (W - SIX_W) / 2;
const SPOT_DIST = 75;
/** Les marqueurs sont 60 % plus grands qu'avant L186 (rayons, croix, halo, traits) : le terrain est rendu à 224 px au lieu de 520 px. */
const K = 1.6;
const LINE = 2;

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
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-[224px] mx-auto h-auto block" role="img" aria-label="Carte des tirs">
            <Pitch />
            {shots.map((s) => {
              const isHome = s.competitorId === homeId;
              // Ancienne carte : le club à domicile attaquait à droite (x), le visiteur à gauche ; y = axe court.
              const oldX = isHome ? (s.side / 100) * 700 : (1 - s.side / 100) * 700;
              const x = (s.line / 100) * W;
              const y = H - oldX;
              const r = Math.max(5.28, Math.min(9 * K, (2 + Math.sqrt(Math.max(s.xg, 0.005)) * 9) * K));
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
          <span className={teamColors(palette, !homeIsOl).text}>↓ {awaySymbol} attaque</span>
          <span className={cn('text-right', teamColors(palette, homeIsOl).text)}>{homeSymbol} attaque ↑</span>
        </div>
        <div className="[display:grid] [grid-template-columns:repeat(2,minmax(0,1fr))] gap-2 mt-4 text-[10px] uppercase tracking-wider text-fg-dim">
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
    <>
      <rect x={0} y={0} width={W} height={H} fill={grass} />
      <rect x={1} y={1} width={W - 2} height={H - 2} fill="none" stroke={stroke} strokeWidth={LINE} />
      <line x1={0} y1={H / 2} x2={W} y2={H / 2} stroke={stroke} strokeWidth={LINE} />
      <circle cx={W / 2} cy={H / 2} r={50} fill="none" stroke={stroke} strokeWidth={LINE} />
      <circle cx={W / 2} cy={H / 2} r={2} fill={stroke} />
      {/* But du haut (défendu par le visiteur) */}
      <rect x={PEN_X} y={0} width={PEN_W} height={PEN_H} fill="none" stroke={stroke} strokeWidth={LINE} />
      <rect x={SIX_X} y={0} width={SIX_W} height={SIX_H} fill="none" stroke={stroke} strokeWidth={LINE} />
      <circle cx={W / 2} cy={SPOT_DIST} r={2} fill={stroke} />
      {/* But du bas (défendu par le club à domicile) */}
      <rect x={PEN_X} y={H - PEN_H} width={PEN_W} height={PEN_H} fill="none" stroke={stroke} strokeWidth={LINE} />
      <rect x={SIX_X} y={H - SIX_H} width={SIX_W} height={SIX_H} fill="none" stroke={stroke} strokeWidth={LINE} />
      <circle cx={W / 2} cy={H - SPOT_DIST} r={2} fill={stroke} />
    </>
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
    `xG ${decimalFr(shot.xg, 2)}${shot.xgot > 0 ? ` · xGOT ${decimalFr(shot.xgot, 2)}` : ''}`,
    shot.bodyPart,
  ].filter(Boolean).join(' · ');

  if (isBlocked) {
    const half = Math.max(r, 3 * K);
    return (
      <g aria-label={title}>
        <title>{title}</title>
        <circle cx={x} cy={y} r={Math.max(half, 6 * K)} fill="transparent" />
        <line x1={x - half / 1.4} y1={y - half / 1.4} x2={x + half / 1.4} y2={y + half / 1.4} stroke={stroke} strokeWidth={1.75 * K} strokeLinecap="round" />
        <line x1={x - half / 1.4} y1={y + half / 1.4} x2={x + half / 1.4} y2={y - half / 1.4} stroke={stroke} strokeWidth={1.75 * K} strokeLinecap="round" />
      </g>
    );
  }
  if (isMissed) {
    return (
      <g aria-label={title}>
        <title>{title}</title>
        <circle cx={x} cy={y} r={Math.max(r, 6 * K)} fill="transparent" />
        <circle cx={x} cy={y} r={r} fill="none" stroke={stroke} strokeWidth={2 * K} />
      </g>
    );
  }
  if (isGoal) {
    return (
      <g aria-label={title}>
        <title>{title}</title>
        <circle cx={x} cy={y} r={r + 2 * K} fill="none" stroke="white" strokeWidth={1 * K} opacity={0.6} />
        <circle cx={x} cy={y} r={r} fill={fill} stroke="white" strokeWidth={1.25 * K} />
      </g>
    );
  }
  return (
    <g aria-label={title}>
      <title>{title}</title>
      <circle cx={x} cy={y} r={r} fill={fill} stroke={stroke} strokeWidth={1.5 * K} />
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
