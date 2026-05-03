import type { LiveMatchShot } from '@/types/api';
import { cn } from '@/lib/utils';

const W = 700;
const H = 450;
const HALF = W / 2;

interface Props {
  shots: LiveMatchShot[];
  homeId: number;
  homeName: string;
  awayName: string;
  homeSymbol: string;
  awaySymbol: string;
}

/**
 * Soccer shot map. Convention used:
 * - Half-pitch view: every shot is drawn on the attacking half (right of center).
 * - line: 0 = own goal, 100 = opponent goal → x = HALF + (line - 50) * (HALF / 50)
 * - side: 0..100 → y axis (left wing → right wing). 50 = center.
 * - Lyon shots in red, opponent in blue.
 * - Marker radius proportional to √xG. Outcome encoded in stroke style.
 */
export function ShotMap({ shots, homeId, homeName, awayName, homeSymbol, awaySymbol }: Props) {
  if (!shots.length) return null;

  return (
    <div className="rounded-md bg-surface border border-border overflow-hidden">
      <header className="px-5 py-3 border-b border-border flex items-center justify-between">
        <div className="eyebrow">Carte des tirs</div>
        <div className="flex items-center gap-3 text-[10px] uppercase tracking-wider text-fg-dim">
          <LegendDot color="ol-red" label={`${homeSymbol} ${homeName}`} />
          <LegendDot color="ol-blue" label={`${awaySymbol} ${awayName}`} />
        </div>
      </header>
      <div className="p-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Shot map">
          <Pitch />
          {shots.map((s) => {
            const isHome = s.competitorId === homeId;
            // Mirror so Lyon attacks right, opponent attacks left
            const lineMirrored = isHome ? s.line : 100 - s.line;
            const sideAdj = isHome ? s.side : 100 - s.side;
            const x = (lineMirrored / 100) * W;
            const y = (sideAdj / 100) * H;
            const r = Math.max(5, Math.sqrt(Math.max(s.xg, 0.005)) * 50);
            return (
              <ShotMarker
                key={`${s.playerId}-${s.time}-${s.line}-${s.side}`}
                x={x}
                y={y}
                r={r}
                isHome={isHome}
                outcome={s.outcome}
                shot={s}
              />
            );
          })}
        </svg>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4 text-[10px] uppercase tracking-wider text-fg-dim">
          <OutcomeLegend label="But" kind="goal" />
          <OutcomeLegend label="Cadré" kind="on-target" />
          <OutcomeLegend label="Bloqué" kind="blocked" />
          <OutcomeLegend label="Manqué" kind="off-target" />
        </div>
        <p className="text-[10px] text-fg-dim mt-2 leading-relaxed">
          Taille du marqueur = qualité du tir (xG). {homeName} attaque vers la droite, {awayName} vers la gauche.
        </p>
      </div>
    </div>
  );
}

function Pitch() {
  // Drawing values for an idiomatic football pitch
  const stroke = 'rgba(255,255,255,0.18)';
  const grass = 'rgba(20,32,28,0.5)';
  return (
    <g>
      {/* Grass */}
      <rect x={0} y={0} width={W} height={H} fill={grass} />
      {/* Touchlines */}
      <rect x={0.5} y={0.5} width={W - 1} height={H - 1} fill="none" stroke={stroke} strokeWidth={1} />
      {/* Halfway line */}
      <line x1={HALF} y1={0} x2={HALF} y2={H} stroke={stroke} strokeWidth={1} />
      {/* Center circle */}
      <circle cx={HALF} cy={H / 2} r={50} fill="none" stroke={stroke} strokeWidth={1} />
      <circle cx={HALF} cy={H / 2} r={2} fill={stroke} />
      {/* Penalty box left (x=0..132, y=center ±150) */}
      <rect x={0} y={H / 2 - 150} width={132} height={300} fill="none" stroke={stroke} strokeWidth={1} />
      {/* 6-yard box left */}
      <rect x={0} y={H / 2 - 60} width={50} height={120} fill="none" stroke={stroke} strokeWidth={1} />
      {/* Penalty spot left */}
      <circle cx={92} cy={H / 2} r={2} fill={stroke} />
      {/* Penalty box right */}
      <rect x={W - 132} y={H / 2 - 150} width={132} height={300} fill="none" stroke={stroke} strokeWidth={1} />
      {/* 6-yard box right */}
      <rect x={W - 50} y={H / 2 - 60} width={50} height={120} fill="none" stroke={stroke} strokeWidth={1} />
      {/* Penalty spot right */}
      <circle cx={W - 92} cy={H / 2} r={2} fill={stroke} />
    </g>
  );
}

function ShotMarker({
  x,
  y,
  r,
  isHome,
  outcome,
  shot,
}: {
  x: number;
  y: number;
  r: number;
  isHome: boolean;
  outcome: string;
  shot: LiveMatchShot;
}) {
  const fill = isHome ? 'hsl(var(--ol-red))' : 'hsl(var(--ol-blue))';
  const stroke = isHome ? 'hsl(var(--ol-red-bright))' : '#62a8e3';
  const isGoal = outcome === 'But';
  const isBlocked = outcome === 'Bloqué' || outcome === 'Blocked';
  const isMissed = outcome === 'Manqué' || outcome === 'Missed' || outcome === 'Hors cadre';

  const title = `${shot.time} · ${outcome} · xG ${shot.xg.toFixed(2)} · ${shot.bodyPart}`;

  if (isBlocked) {
    // Cross marker
    const half = Math.max(r, 6);
    return (
      <g aria-label={title}>
        <title>{title}</title>
        <line x1={x - half / 1.4} y1={y - half / 1.4} x2={x + half / 1.4} y2={y + half / 1.4} stroke={stroke} strokeWidth={2.5} strokeLinecap="round" />
        <line x1={x - half / 1.4} y1={y + half / 1.4} x2={x + half / 1.4} y2={y - half / 1.4} stroke={stroke} strokeWidth={2.5} strokeLinecap="round" />
      </g>
    );
  }
  if (isMissed) {
    // Hollow circle
    return (
      <g aria-label={title}>
        <title>{title}</title>
        <circle cx={x} cy={y} r={r} fill="none" stroke={stroke} strokeWidth={2} />
      </g>
    );
  }
  if (isGoal) {
    // Filled with halo
    return (
      <g aria-label={title}>
        <title>{title}</title>
        <circle cx={x} cy={y} r={r + 4} fill="none" stroke="white" strokeWidth={1.5} opacity={0.6} />
        <circle cx={x} cy={y} r={r} fill={fill} stroke="white" strokeWidth={2} />
      </g>
    );
  }
  // Default: on-target / saved
  return (
    <g aria-label={title}>
      <title>{title}</title>
      <circle cx={x} cy={y} r={r} fill={fill} fillOpacity={0.85} stroke={stroke} strokeWidth={1.5} />
    </g>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn('inline-block w-2.5 h-2.5 rounded-full', color === 'ol-red' ? 'bg-ol-red' : 'bg-ol-blue')} />
      <span>{label}</span>
    </span>
  );
}

function OutcomeLegend({ label, kind }: { label: string; kind: 'goal' | 'on-target' | 'blocked' | 'off-target' }) {
  const size = 14;
  return (
    <span className="inline-flex items-center gap-1.5">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {kind === 'goal' && (
          <>
            <circle cx={size / 2} cy={size / 2} r={size / 2 - 1} fill="hsl(var(--ol-red))" stroke="white" strokeWidth={1.5} />
          </>
        )}
        {kind === 'on-target' && (
          <circle cx={size / 2} cy={size / 2} r={size / 2 - 1} fill="hsl(var(--ol-red))" fillOpacity={0.85} stroke="hsl(var(--ol-red-bright))" strokeWidth={1.5} />
        )}
        {kind === 'blocked' && (
          <>
            <line x1={3} y1={3} x2={size - 3} y2={size - 3} stroke="hsl(var(--ol-red-bright))" strokeWidth={2} />
            <line x1={3} y1={size - 3} x2={size - 3} y2={3} stroke="hsl(var(--ol-red-bright))" strokeWidth={2} />
          </>
        )}
        {kind === 'off-target' && (
          <circle cx={size / 2} cy={size / 2} r={size / 2 - 2} fill="none" stroke="hsl(var(--ol-red-bright))" strokeWidth={1.5} />
        )}
      </svg>
      <span>{label}</span>
    </span>
  );
}
