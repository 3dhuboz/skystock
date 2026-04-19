interface LogoProps {
  size?: number;
  className?: string;
  /**
   * "mark" = icon only (square). "wordmark" = icon + SkyStock FPV text. Defaults to "mark".
   */
  variant?: 'mark' | 'wordmark';
  /** Override the gradient with a single solid colour (e.g. for monochrome contexts). */
  mono?: string;
  /** Add an outer glow — good for dark-background hero areas. */
  glow?: boolean;
}

/**
 * SkyStock FPV mark — three outward chevrons inside a 360° orbit ring, tilted for motion.
 * Reads as: "one clip, every angle" (sphere + radiating viewing angles + drone core).
 */
export function Logo({ size = 40, className = '', variant = 'mark', mono, glow = false }: LogoProps) {
  const gradId = `skystock-gradient-${mono ? 'mono' : 'color'}`;
  const glowFilterId = 'skystock-glow';
  const stroke = mono || `url(#${gradId})`;
  const fill = mono || `url(#${gradId})`;

  const markSize = size;
  const svg = (
    <svg
      viewBox="0 0 64 64"
      width={markSize}
      height={markSize}
      xmlns="http://www.w3.org/2000/svg"
      className={variant === 'mark' ? className : ''}
      aria-label="SkyStock FPV"
    >
      <defs>
        {!mono && (
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#7dd3fc" />
            <stop offset="40%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#f97316" />
          </linearGradient>
        )}
        {glow && (
          <filter id={glowFilterId} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        )}
      </defs>

      <g
        transform="rotate(-18 32 32)"
        filter={glow ? `url(#${glowFilterId})` : undefined}
      >
        {/* Orbit ring (360° sphere) */}
        <circle
          cx="32"
          cy="32"
          r="27"
          fill="none"
          stroke={stroke}
          strokeWidth="2.5"
          opacity={mono ? 0.7 : 0.55}
        />

        {/* Three outward chevrons — rotating angles around the sphere */}
        <g fill={fill}>
          <path d="M 32 5 L 40 17 L 32 14 L 24 17 Z" />
          <path d="M 32 5 L 40 17 L 32 14 L 24 17 Z" transform="rotate(120 32 32)" />
          <path d="M 32 5 L 40 17 L 32 14 L 24 17 Z" transform="rotate(240 32 32)" />
        </g>

        {/* Core */}
        <circle cx="32" cy="32" r="4" fill={fill} />
      </g>
    </svg>
  );

  if (variant === 'mark') return svg;

  // Wordmark: icon + "SkyStock" + "FPV"
  return (
    <div className={`inline-flex items-center gap-3 ${className}`}>
      {svg}
      <div className="leading-none">
        <div className="font-display font-bold text-white tracking-tight" style={{ fontSize: size * 0.55 }}>
          SkyStock
        </div>
        <div
          className="font-display font-semibold uppercase"
          style={{
            fontSize: size * 0.22,
            letterSpacing: '0.22em',
            color: '#fb923c',
            marginTop: size * 0.05,
          }}
        >
          FPV · Avata 360
        </div>
      </div>
    </div>
  );
}

export default Logo;
