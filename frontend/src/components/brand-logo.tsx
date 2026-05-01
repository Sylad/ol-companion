interface BrandLogoProps {
  size?: number;
  className?: string;
}

export function BrandLogo({ size = 48, className }: BrandLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="OL Companion"
    >
      <defs>
        <clipPath id="ol-circle">
          <circle cx="50" cy="50" r="44" />
        </clipPath>
        <linearGradient id="ol-gold" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f0d276" />
          <stop offset="50%" stopColor="#c9a24a" />
          <stop offset="100%" stopColor="#80652b" />
        </linearGradient>
        <linearGradient id="ol-gold-text" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#f7dd8a" />
          <stop offset="100%" stopColor="#c9a24a" />
        </linearGradient>
        <filter id="ol-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.5" />
        </filter>
      </defs>

      {/* Outer gold ring with subtle glow */}
      <circle cx="50" cy="50" r="48" fill="none" stroke="url(#ol-gold)" strokeWidth="0.8" opacity="0.45" />

      {/* Diagonal red/blue background, clipped to circle */}
      <g clipPath="url(#ol-circle)">
        <rect width="100" height="100" fill="#dc2626" />
        <path d="M 100 0 L 0 100 L 100 100 Z" fill="#1e3a8a" />
        {/* white diagonal stroke for separation */}
        <path d="M 100 0 L 0 100" stroke="#ffffff" strokeWidth="1.5" opacity="0.85" />
      </g>

      {/* Main gold border */}
      <circle cx="50" cy="50" r="44" fill="none" stroke="url(#ol-gold)" strokeWidth="3" />

      {/* "OL" letters — white fill with gold stroke */}
      <text
        x="50"
        y="63"
        fontFamily="'Manrope', system-ui, sans-serif"
        fontSize="36"
        fontWeight="800"
        fill="#ffffff"
        stroke="url(#ol-gold-text)"
        strokeWidth="1.2"
        textAnchor="middle"
        letterSpacing="-1"
      >
        OL
      </text>
    </svg>
  );
}
