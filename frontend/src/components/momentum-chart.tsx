import type { LiveMatchMomentumPoint } from '@/types/api';
import { teamColors, type MatchPalette } from '@/lib/match-palette';

/**
 * Momentum minute par minute (backend : play-by-play 365scores pondéré et
 * lissé). Composant généré en local (qwen3-coder) le 19/09/2026, relu.
 */

export function MomentumChart(props: {
  points: LiveMatchMomentumPoint[];
  homeName: string;
  awayName: string;
  goalMinutes: { minute: number; home: boolean }[];
  /** La couleur suit l'équipe suivie, pas le côté (L160 R5) : `homeIsOl` dit si c'est le domicile. */
  homeIsOl: boolean;
  /** `bleus` : France bleue, adversaire blanc (L167 R4). */
  palette?: MatchPalette;
}) {
  if (!props.points.length) return null;

  const palette = props.palette ?? 'ol';
  const HOME = teamColors(palette, props.homeIsOl).fill;
  const AWAY = teamColors(palette, !props.homeIsOl).fill;
  // Tracé 240 × 96 étiré en largeur (preserveAspectRatio=none) : la hauteur ne change pas (L186 R16).
  const W = 240;
  const H = 96;
  const MID = 48;
  const MAX_BAR = 45;

  const N = Math.max(90, props.points.length);
  const slot = W / N;
  const barWidth = Math.max(1, slot - 1);


  return (
    <section data-testid="elan" className="h-full rounded-md bg-surface border border-border overflow-hidden">
      <header className="px-5 py-2 border-b border-border flex items-center justify-between">
        <h2 className="eyebrow min-w-0">Momentum</h2>
        <div className="flex items-center gap-3 text-[10px] uppercase tracking-wider text-fg-dim">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: HOME }} />
            {props.homeName}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: AWAY }} />
            {props.awayName}
          </span>
        </div>
      </header>
      <div className="px-4 py-2">
        {/* Hauteur = min(96 px, ancien tracé : svg 700 × 160 sur la largeur de l'écran moins 74 px de marges). */}
        <div className="relative w-full h-[min(96px,calc((100vw_-_74px)*0.22857))]">
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full h-full" role="img" aria-label="Momentum">
            <line x1={0} x2={W} y1={MID} y2={MID} stroke="hsl(var(--border))" vectorEffect="non-scaling-stroke" />
            <line x1={45 * slot} x2={45 * slot} y1={0} y2={H} stroke="hsl(var(--border))" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
            {props.points.length > 90 && (
              <line x1={90 * slot} x2={90 * slot} y1={0} y2={H} stroke="hsl(var(--border))" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
            )}
            {props.points.map((p, i) => {
              const h = Math.abs(p.value) / 100 * MAX_BAR;
              const x = i * slot;
              return p.value >= 0
                ? <rect key={p.minute} x={x} y={MID - h} width={barWidth} height={h} fill={HOME} />
                : <rect key={p.minute} x={x} y={MID} width={barWidth} height={h} fill={AWAY} />;
            })}
          </svg>
          {/* Pastilles de but : couche à part, non déformée, positionnée en % du repère du tracé (au bout de leur barre). */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible" aria-hidden="true">
            {props.goalMinutes.map(g => {
              // Le point du Momentum le plus proche de la minute du but (exactement elle en données réelles : une valeur par minute).
              const point = props.points.reduce((best, p) => (Math.abs(p.minute - g.minute) < Math.abs(best.minute - g.minute) ? p : best));
              const h = Math.abs(point.value) / 100 * MAX_BAR;
              const x = props.points.indexOf(point) * slot;
              const cy = point.value >= 0 ? MID - h : MID + h;
              return (
                <circle
                  key={`goal-${g.minute}-${g.home}`}
                  cx={`${((x + barWidth / 2) / W) * 100}%`}
                  cy={`${(cy / H) * 100}%`}
                  r={4}
                  fill={g.home ? HOME : AWAY}
                  stroke="white"
                  strokeWidth={1.5}
                />
              );
            })}
          </svg>
        </div>
        <p className="text-[10px] text-fg-dim mt-1 leading-snug">
          Pression par minute, dérivée du play-by-play (tirs, corners, coups francs). Vers le haut : {props.homeName}, vers le bas : {props.awayName}.
        </p>
      </div>
    </section>
  );
}
