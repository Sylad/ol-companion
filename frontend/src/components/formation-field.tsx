import type { LineupPlayer } from '@/types/api';

const LINE_TO_Y: Record<number, number> = {
  1: 88,
  2: 70,
  3: 52,
  4: 36,
  5: 22,
  6: 10,
};

interface FormationFieldProps {
  starters: LineupPlayer[];
  formation: string;
}

export function FormationField({ starters, formation }: FormationFieldProps) {
  return (
    <div className="relative aspect-[3/4] sm:aspect-[4/5] rounded-md overflow-hidden border border-border-strong shadow-2xl">
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, hsl(155 28% 12%) 0%, hsl(155 22% 7%) 50%, hsl(155 28% 12%) 100%)',
        }}
      />
      <PitchLines />

      {starters.map((p) => (
        <PlayerOnField key={p.id} player={p} />
      ))}

      <div className="absolute top-3 right-3 z-10 bg-ol-red px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-sm border border-ol-red-bright/60 shadow-lg">
        {formation}
      </div>
    </div>
  );
}

function PitchLines() {
  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <g stroke="rgba(255,255,255,0.12)" strokeWidth="0.3" fill="none" vectorEffect="non-scaling-stroke">
        <rect x="2" y="2" width="96" height="96" />
        <line x1="2" y1="50" x2="98" y2="50" />
        <circle cx="50" cy="50" r="9" />
        <circle cx="50" cy="50" r="0.5" fill="rgba(255,255,255,0.3)" />
        <rect x="20" y="2" width="60" height="14" />
        <rect x="35" y="2" width="30" height="6" />
        <rect x="20" y="84" width="60" height="14" />
        <rect x="35" y="92" width="30" height="6" />
        <path d="M 50 16 A 9 9 0 0 0 41 7" />
        <path d="M 50 16 A 9 9 0 0 1 59 7" />
        <path d="M 50 84 A 9 9 0 0 1 41 93" />
        <path d="M 50 84 A 9 9 0 0 0 59 93" />
      </g>
    </svg>
  );
}

function PlayerOnField({ player }: { player: LineupPlayer }) {
  const x = clamp(player.yardSide, 4, 96);
  const y = LINE_TO_Y[player.yardLine] ?? 50;
  return (
    <div
      className="absolute z-10"
      style={{
        left: `${x}%`,
        top: `${y}%`,
        transform: 'translate(-50%, -50%)',
      }}
    >
      <div className="flex flex-col items-center gap-1.5 group">
        <div className="relative w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-gradient-to-br from-ol-blue-bright to-ol-blue border-2 border-white/90 shadow-[0_2px_8px_rgba(0,0,0,0.5),inset_0_1px_2px_rgba(255,255,255,0.3)] flex items-center justify-center transition-transform group-hover:scale-110">
          <span className="font-mono tabular-nums text-white font-bold text-xs sm:text-sm">
            {player.jerseyNumber ?? '?'}
          </span>
        </div>
        <span
          className="px-1.5 py-0.5 rounded-sm text-[10px] sm:text-[11px] font-semibold text-white whitespace-nowrap leading-none"
          style={{
            backgroundColor: 'rgba(8, 9, 13, 0.78)',
            backdropFilter: 'blur(2px)',
            textShadow: '0 1px 2px rgba(0,0,0,0.9)',
          }}
        >
          {player.shortName}
        </span>
        {player.ranking !== null && player.ranking > 0 && (
          <span
            className="absolute -top-1.5 -right-1.5 z-20 inline-flex items-center justify-center w-[18px] h-[18px] rounded-full text-[9px] font-bold leading-none border-2 border-bg"
            style={{
              backgroundColor: ratingColor(player.ranking),
              color: '#fff',
            }}
            title={`Note ${player.ranking}`}
          >
            {player.ranking.toFixed(1)}
          </span>
        )}
      </div>
    </div>
  );
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function ratingColor(rating: number): string {
  if (rating >= 8) return '#16a34a';
  if (rating >= 7) return '#65a30d';
  if (rating >= 6) return '#ca8a04';
  if (rating >= 5) return '#ea580c';
  return '#dc2626';
}
