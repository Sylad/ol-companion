import { useEffect, useState } from 'react';

export type EventBurstType = 'goal' | 'yellow' | 'red' | 'sub';

interface Props {
  type: EventBurstType;
  /** Optional override for the auto-dismiss timeout (ms). */
  durationMs?: number;
}

const DEFAULT_DURATION: Record<EventBurstType, number> = {
  goal: 1900,
  yellow: 1500,
  red: 1700,
  sub: 1300,
};

/**
 * Full-screen overlay celebrating live-match events: goal, yellow card, red card, substitution.
 *
 * The component is mounted with a `key` tied to the latest event id so React remounts on each
 * event and replays the animation. It auto-removes itself after `durationMs` so the page is
 * never blocked. `pointer-events:none` keeps the underlying card clickable.
 *
 * Respects `prefers-reduced-motion`: keyframe motion is replaced by a short fade.
 *
 * Palette OL: rouge + bleu uniquement, sauf pour la célébration du but qui ajoute des accents
 * cyan/blanc/or (sémantique universelle de fête, autorisée par ol_color_rule.md).
 */
export function MatchEventBurst({ type, durationMs }: Props) {
  const duration = durationMs ?? DEFAULT_DURATION[type];
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = window.setTimeout(() => setVisible(false), duration);
    return () => window.clearTimeout(t);
  }, [duration]);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[200] pointer-events-none flex items-center justify-center match-burst-root"
      data-burst={type}
      aria-hidden="true"
    >
      {type === 'goal' && <GoalBurst />}
      {type === 'yellow' && <CardBurst color="yellow" />}
      {type === 'red' && <CardBurst color="red" />}
      {type === 'sub' && <SubBurst />}
    </div>
  );
}

/* ----------------------------- GOAL ---------------------------- */

function GoalBurst() {
  // 18 confetti particles split between OL red and OL blue, plus a few cyan/white sparkles.
  const particles = Array.from({ length: 22 }, (_, i) => i);

  return (
    <>
      <div className="absolute inset-0 mb-goal-halo" />
      <div className="relative">
        <div className="mb-goal-shockwave" />
        <div className="mb-goal-shockwave mb-goal-shockwave-2" />
        <div
          className="font-display font-black tracking-tight text-white mb-goal-text"
          style={{
            fontSize: 'clamp(64px, 14vw, 144px)',
            textShadow:
              '0 0 24px hsl(0 80% 55% / 0.85), 0 0 48px hsl(224 80% 55% / 0.7), 0 6px 20px rgba(0,0,0,0.6)',
          }}
        >
          BUT&nbsp;!
        </div>
        <div className="absolute inset-0 pointer-events-none">
          {particles.map((i) => {
            const angle = (i / particles.length) * Math.PI * 2;
            // Each particle gets a unique color cycling through the OL palette + accents.
            const palette = [
              'hsl(0 80% 55%)',      // OL red
              'hsl(0 90% 65%)',      // OL red bright
              'hsl(224 80% 50%)',    // OL blue
              'hsl(226 70% 65%)',    // OL blue bright
              'hsl(190 90% 70%)',    // cyan accent (celebration)
              'hsl(0 0% 100%)',      // white spark
            ];
            const color = palette[i % palette.length];
            const distance = 220 + ((i * 13) % 90); // 220-310px spread
            const dx = Math.cos(angle) * distance;
            const dy = Math.sin(angle) * distance;
            const size = 6 + ((i * 7) % 8); // 6-13px
            const delay = (i % 5) * 0.04;

            return (
              <span
                key={i}
                className="mb-goal-particle"
                style={{
                  width: `${size}px`,
                  height: `${size}px`,
                  background: color,
                  boxShadow: `0 0 8px ${color}`,
                  // CSS custom props consumed by the keyframes
                  ['--dx' as string]: `${dx}px`,
                  ['--dy' as string]: `${dy}px`,
                  ['--rot' as string]: `${(i * 47) % 360}deg`,
                  animationDelay: `${delay}s`,
                }}
              />
            );
          })}
        </div>
      </div>
    </>
  );
}

/* ----------------------------- CARD ---------------------------- */

function CardBurst({ color }: { color: 'yellow' | 'red' }) {
  const fill = color === 'yellow' ? '#facc15' : '#dc2626';
  const stroke = color === 'yellow' ? '#a16207' : '#7f1d1d';
  const glow =
    color === 'yellow'
      ? '0 0 36px hsl(48 95% 55% / 0.7), 0 12px 36px rgba(0,0,0,0.55)'
      : '0 0 48px hsl(0 90% 55% / 0.75), 0 12px 36px rgba(0,0,0,0.6)';

  return (
    <>
      <div
        className="absolute inset-0 mb-card-halo"
        style={{
          background:
            color === 'yellow'
              ? 'radial-gradient(ellipse at center, hsl(48 95% 55% / 0.30) 0%, transparent 65%)'
              : 'radial-gradient(ellipse at center, hsl(0 85% 55% / 0.40) 0%, transparent 65%)',
        }}
      />
      <div
        className="mb-card-shake"
        // The wider shake on red simulates the camera jolt on a sending-off.
        style={{
          ['--shake' as string]: color === 'red' ? '14px' : '6px',
        }}
      >
        <svg
          width="160"
          height="220"
          viewBox="0 0 160 220"
          className="mb-card-svg"
          style={{ filter: `drop-shadow(${glow})` }}
        >
          <rect
            x="6"
            y="6"
            width="148"
            height="208"
            rx="8"
            fill={fill}
            stroke={stroke}
            strokeWidth="3"
          />
          {/* Subtle inner highlight */}
          <rect
            x="14"
            y="14"
            width="132"
            height="192"
            rx="5"
            fill="none"
            stroke="rgba(255,255,255,0.18)"
            strokeWidth="1"
          />
        </svg>
      </div>
    </>
  );
}

/* ------------------------- SUBSTITUTION ------------------------- */

function SubBurst() {
  return (
    <>
      <div className="absolute inset-0 mb-sub-halo" />
      <div className="relative flex items-center gap-6 mb-sub-wrapper">
        {/* Down arrow (player coming off) — OL red */}
        <svg
          width="120"
          height="160"
          viewBox="0 0 120 160"
          className="mb-sub-arrow mb-sub-arrow-down"
        >
          <defs>
            <linearGradient id="subRed" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(0 90% 65%)" />
              <stop offset="100%" stopColor="hsl(0 80% 45%)" />
            </linearGradient>
          </defs>
          <path
            d="M45 0 L75 0 L75 100 L105 100 L60 160 L15 100 L45 100 Z"
            fill="url(#subRed)"
            stroke="hsl(0 50% 30%)"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </svg>
        {/* Up arrow (player coming on) — OL blue */}
        <svg
          width="120"
          height="160"
          viewBox="0 0 120 160"
          className="mb-sub-arrow mb-sub-arrow-up"
        >
          <defs>
            <linearGradient id="subBlue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(226 75% 60%)" />
              <stop offset="100%" stopColor="hsl(224 70% 35%)" />
            </linearGradient>
          </defs>
          <path
            d="M60 0 L105 60 L75 60 L75 160 L45 160 L45 60 L15 60 Z"
            fill="url(#subBlue)"
            stroke="hsl(224 60% 25%)"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </>
  );
}
