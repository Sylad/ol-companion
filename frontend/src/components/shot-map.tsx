import type { LiveMatchShot } from '@/types/api';
import { cn } from '@/lib/utils';

// Vertical pitch (portrait). 365scores stores shot coords this way:
//   side = % along the long axis (own goal at 0 → opponent goal at 100)
//   line = % along the short axis (touchline 0 → touchline 100, 50 = centre)
const W = 450;
const H = 700;
const HALF_Y = H / 2;
const PEN_W = 270;
const PEN_H = 110;
const PEN_X = (W - PEN_W) / 2;
const SIX_W = 130;
const SIX_H = 40;
const SIX_X = (W - SIX_W) / 2;
const SPOT_DIST = 75;

interface Props {
  shots: LiveMatchShot[];
  homeId: number;
  homeName: string;
  awayName: string;
  homeSymbol: string;
  awaySymbol: string;
}

export function ShotMap({ shots, homeId, homeName, awayName, homeSymbol, awaySymbol }: Props) {
  if (!shots.length) return null;

  return (
    <div className="rounded-md bg-surface border border-border overflow-hidden">
      <header className="px-5 py-3 border-b border-border flex items-center justify-between flex-wrap gap-2">
        <div className="eyebrow">Carte des tirs</div>
        <div className="flex items-center gap-3 text-[10px] uppercase tracking-wider text-fg-dim">
          <LegendDot color="ol-red" label={`${homeSymbol} ${homeName}`} />
          <LegendDot color="ol-blue" label={`${awaySymbol} ${awayName}`} />
        </div>
      </header>
      <div className="p-4 flex flex-col items-center">
        <div className="relative w-full max-w-[420px]">
          {/* Direction labels */}
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 text-[9px] uppercase tracking-wider text-ol-red-bright font-bold pointer-events-none">
            ↑ {homeSymbol} attaque
          </div>
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[9px] uppercase tracking-wider text-ol-blue font-bold pointer-events-none">
            {awaySymbol} attaque ↓
          </div>
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Shot map">
            <Pitch />
            {shots.map((s) => {
              const isHome = s.competitorId === homeId;
              // Vertical pitch: long axis = vertical (Y), short axis = horizontal (X).
              // Home attacks UP (target at top, y→0), away attacks DOWN (target at bottom).
              const x = (s.line / 100) * W;
              const y = isHome ? (1 - s.side / 100) * H : (s.side / 100) * H;
              const r = Math.min(9, 2 + Math.sqrt(Math.max(s.xg, 0.005)) * 9);
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
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4 text-[10px] uppercase tracking-wider text-fg-dim w-full max-w-[420px]">
          <OutcomeLegend label="But" kind="goal" />
          <OutcomeLegend label="Cadré" kind="on-target" />
          <OutcomeLegend label="Bloqué" kind="blocked" />
          <OutcomeLegend label="Manqué" kind="off-target" />
        </div>
        <p className="text-[10px] text-fg-dim mt-2 leading-relaxed text-center max-w-[420px]">
          Taille du marqueur = qualité du tir (xG). Le rond avec un halo = but.
        </p>
      </div>
    </div>
  );
}

function Pitch() {
  const stroke = 'rgba(255,255,255,0.18)';
  const grass = 'rgba(20,32,28,0.5)';
  return (
    <g>
      {/* Grass */}
      <rect x={0} y={0} width={W} height={H} fill={grass} />
      {/* Touchlines */}
      <rect x={0.5} y={0.5} width={W - 1} height={H - 1} fill="none" stroke={stroke} strokeWidth={1} />
      {/* Halfway line */}
      <line x1={0} y1={HALF_Y} x2={W} y2={HALF_Y} stroke={stroke} strokeWidth={1} />
      {/* Center circle + spot */}
      <circle cx={W / 2} cy={HALF_Y} r={50} fill="none" stroke={stroke} strokeWidth={1} />
      <circle cx={W / 2} cy={HALF_Y} r={2} fill={stroke} />
      {/* Top penalty box */}
      <rect x={PEN_X} y={0} width={PEN_W} height={PEN_H} fill="none" stroke={stroke} strokeWidth={1} />
      <rect x={SIX_X} y={0} width={SIX_W} height={SIX_H} fill="none" stroke={stroke} strokeWidth={1} />
      <circle cx={W / 2} cy={SPOT_DIST} r={2} fill={stroke} />
      {/* Bottom penalty box */}
      <rect x={PEN_X} y={H - PEN_H} width={PEN_W} height={PEN_H} fill="none" stroke={stroke} strokeWidth={1} />
      <rect x={SIX_X} y={H - SIX_H} width={SIX_W} height={SIX_H} fill="none" stroke={stroke} strokeWidth={1} />
      <circle cx={W / 2} cy={H - SPOT_DIST} r={2} fill={stroke} />
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
    const half = Math.max(r, 3);
    return (
      <g aria-label={title}>
        <title>{title}</title>
        <line x1={x - half / 1.4} y1={y - half / 1.4} x2={x + half / 1.4} y2={y + half / 1.4} stroke={stroke} strokeWidth={1.75} strokeLinecap="round" />
        <line x1={x - half / 1.4} y1={y + half / 1.4} x2={x + half / 1.4} y2={y - half / 1.4} stroke={stroke} strokeWidth={1.75} strokeLinecap="round" />
      </g>
    );
  }
  if (isMissed) {
    return (
      <g aria-label={title}>
        <title>{title}</title>
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
          <circle cx={size / 2} cy={size / 2} r={size / 2 - 1} fill="hsl(var(--ol-red))" stroke="white" strokeWidth={1.5} />
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
