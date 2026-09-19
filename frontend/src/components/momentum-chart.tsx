import type { LiveMatchMomentumPoint } from '@/types/api';

/**
 * Momentum minute par minute (backend : play-by-play 365scores pondéré et
 * lissé). Composant généré en local (qwen3-coder) le 19/09/2026, relu.
 */

export function MomentumChart(props: { points: LiveMatchMomentumPoint[]; homeName: string; awayName: string; goalMinutes: { minute: number; home: boolean }[] }) {
  if (!props.points.length) return null;

  const HOME = 'hsl(var(--ol-red))';
  const AWAY = 'hsl(var(--ol-blue))';
  const W = 700;
  const H = 160;
  const MID = 80;
  const MAX_BAR = 76;

  const N = Math.max(90, props.points.length);
  const slot = W / N;
  const barWidth = Math.max(1, slot - 1);


  return (
    <section className="rounded-md bg-surface border border-border overflow-hidden">
      <header className="px-5 py-3 border-b border-border flex items-center justify-between">
        <div className="eyebrow">Momentum</div>
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
      <div className="p-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Momentum">
          <line x1={0} x2={W} y1={MID} y2={MID} stroke="hsl(var(--border))" />
          <line x1={45 * slot} x2={45 * slot} y1={0} y2={H} stroke="hsl(var(--border))" strokeDasharray="3 3" />
          {props.points.length > 90 && (
            <line x1={90 * slot} x2={90 * slot} y1={0} y2={H} stroke="hsl(var(--border))" strokeDasharray="3 3" />
          )}
          {props.points.map((p, i) => {
            const h = Math.abs(p.value) / 100 * MAX_BAR;
            const x = i * slot;
            if (p.value >= 0) {
              return (
                <rect
                  key={p.minute}
                  x={x}
                  y={MID - h}
                  width={barWidth}
                  height={h}
                  fill={HOME}
                  opacity={0.85}
                />
              );
            } else {
              return (
                <rect
                  key={p.minute}
                  x={x}
                  y={MID}
                  width={barWidth}
                  height={h}
                  fill={AWAY}
                  opacity={0.85}
                />
              );
            }
          })}
          {props.goalMinutes.map(g => {
            const point = props.points.find(p => p.minute === g.minute);
            if (!point) return null;
            const h = Math.abs(point.value) / 100 * MAX_BAR;
            const x = props.points.indexOf(point) * slot;
            const cy = point.value >= 0 ? MID - h : MID + h;
            return (
              <circle
                key={`goal-${g.minute}-${g.home}`}
                cx={x + barWidth / 2}
                cy={cy}
                r={4}
                fill={g.home ? HOME : AWAY}
                stroke="white"
                strokeWidth={1.5}
              />
            );
          })}
        </svg>
        <p className="text-[10px] text-fg-dim mt-2 leading-relaxed">
          Pression par minute, dérivée du play-by-play (tirs, corners, coups francs). Vers le haut : {props.homeName}, vers le bas : {props.awayName}.
        </p>
      </div>
    </section>
  );
}
