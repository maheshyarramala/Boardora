import { useId } from 'react';

export type BoardoraLogoVariant =
  | 'horizontal'
  | 'stacked'
  | 'compact'
  | 'monochrome'
  | 'light'
  | 'dark';

interface BoardoraLogoProps {
  variant?: BoardoraLogoVariant;
  showTagline?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * Official BOARDORA Royal Knight Emblem & Wordmark component.
 * Supports horizontal, stacked, compact emblem, monochrome, light-background, and dark-background variants.
 */
export function BoardoraLogo({
  variant = 'horizontal',
  showTagline = true,
  size = 'md',
  className = '',
}: BoardoraLogoProps) {
  const uid = useId().replace(/:/g, '');
  const isLight = variant === 'light';
  const isMono = variant === 'monochrome';
  const isDarkPlate = variant === 'dark';
  const isCompact = variant === 'compact';
  const isStacked = variant === 'stacked';

  const emblemSizes = {
    sm: 'w-9 h-9',
    md: 'w-11 h-11 sm:w-12 sm:h-12',
    lg: 'w-16 h-16 sm:w-20 sm:h-20',
  };

  const titleSizes = {
    sm: 'text-base sm:text-lg',
    md: 'text-xl sm:text-2xl',
    lg: 'text-3xl sm:text-4xl',
  };

  const goldGradId = `bd-gold-${uid}`;
  const navyGradId = `bd-navy-${uid}`;

  const wordmarkColor = isMono
    ? 'text-current'
    : isLight
    ? 'text-[#08172F]'
    : 'text-[#F4EBDD]';

  const taglineColor = isMono
    ? 'text-current opacity-80'
    : isLight
    ? 'text-[#9B712D]'
    : 'text-[#D6AD55]';

  const emblem = (
    <svg
      viewBox="0 0 128 128"
      className={`${emblemSizes[size]} shrink-0`}
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={navyGradId} x1="16" y1="10" x2="112" y2="118" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#10274D" />
          <stop offset="60%" stopColor="#08172F" />
          <stop offset="100%" stopColor="#040D1C" />
        </linearGradient>
        <linearGradient id={goldGradId} x1="28" y1="16" x2="100" y2="112" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#F6DF96" />
          <stop offset="48%" stopColor="#D6AD55" />
          <stop offset="100%" stopColor="#9B712D" />
        </linearGradient>
      </defs>

      <path
        d="M64 8L108 24V63C108 89.5 89 108.5 64 118C39 108.5 20 89.5 20 63V24L64 8Z"
        fill={isMono ? 'none' : `url(#${navyGradId})`}
        stroke={isMono ? 'currentColor' : `url(#${goldGradId})`}
        strokeWidth="4.2"
        strokeLinejoin="round"
      />
      {!isMono && (
        <path
          d="M64 15L101 28.5V62.5C101 84.5 85 101 64 109.5C43 101 27 84.5 27 62.5V28.5L64 15Z"
          stroke="#D6AD55"
          strokeOpacity="0.34"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
      )}

      {/* Three-Peak Royal Crown */}
      <path
        d="M47 35.5L44.5 25L55 30L64 22L73 30L83.5 25L81 35.5H47Z"
        fill={isMono ? 'currentColor' : `url(#${goldGradId})`}
      />
      <circle cx="44.5" cy="23.5" r="2.2" fill={isMono ? 'currentColor' : '#F6DF96'} />
      <circle cx="64" cy="20" r="2.6" fill={isMono ? 'currentColor' : '#F6DF96'} />
      <circle cx="83.5" cy="23.5" r="2.2" fill={isMono ? 'currentColor' : '#F6DF96'} />

      {/* Sculpted Noble Staunton Knight Pedestal & Silhouette */}
      <path
        d="M41 90.5H87V97H41V90.5Z"
        fill={isMono ? 'currentColor' : `url(#${goldGradId})`}
      />
      {!isMono && <path d="M44 85H84V88.5H44V85Z" fill="#9B712D" />}
      <path
        d="M46 83.5C46 73 51.5 66 57.5 61.5L50 61.5L42 58.5L41 53.5L52 44.5L54.5 38L59.5 42.5L64 38L66.5 41.5C76 43 84 51 85.5 63.5C86.5 72 83 78.5 81.5 83.5H46Z"
        fill={isMono ? 'currentColor' : isLight ? '#F4EBDD' : `url(#${goldGradId})`}
      />
      {!isMono && (
        <>
          <path
            d="M68 45.5C74.5 48.5 79 55 79.5 64.5"
            stroke="#08172F"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeOpacity="0.52"
          />
          <path d="M52.5 48.2L55.8 46.8L56.8 49L53.5 49.8Z" fill="#08172F" />
        </>
      )}
    </svg>
  );

  if (isCompact) {
    return (
      <div
        className={`inline-flex items-center select-none ${className}`}
        aria-label="BOARDORA"
      >
        {emblem}
      </div>
    );
  }

  return (
    <div
      className={`inline-flex ${
        isStacked ? 'flex-col items-center text-center gap-2.5' : 'items-center gap-3'
      } ${
        isDarkPlate
          ? 'px-4 py-2.5 rounded-2xl bg-[#08172F] border border-[#D6AD55]/35 shadow-lg'
          : ''
      } select-none ${className}`}
    >
      {emblem}
      <div className={`flex flex-col leading-none ${isStacked ? 'items-center' : ''}`}>
        <span
          className={`font-display font-bold tracking-[0.14em] whitespace-nowrap ${titleSizes[size]} ${wordmarkColor}`}
        >
          BOARDORA
        </span>
        {showTagline && (
          <span
            className={`text-[10px] sm:text-[11px] font-semibold tracking-[0.18em] mt-1 whitespace-nowrap ${taglineColor}`}
          >
            ONE WORLD. TEN GAMES. ENDLESS FUN.
          </span>
        )}
      </div>
    </div>
  );
}
