import { useId, useState } from 'react';

const FACE_ROTATIONS: Record<number, { x: number; y: number }> = {
  1: { x: 0, y: 0 },
  2: { x: -90, y: 0 },
  3: { x: 0, y: -90 },
  4: { x: 0, y: 90 },
  5: { x: 90, y: 0 },
  6: { x: 180, y: 0 },
};

const PIP_POSITIONS: Record<number, readonly [number, number][]> = {
  1: [[50, 50]],
  2: [[28, 28], [72, 72]],
  3: [[28, 28], [50, 50], [72, 72]],
  4: [[28, 28], [72, 28], [28, 72], [72, 72]],
  5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]],
  6: [[28, 24], [72, 24], [28, 50], [72, 50], [28, 76], [72, 76]],
};

function DiceFace({
  value,
  transform,
  variant,
}: {
  value: number;
  transform: string;
  variant: 'white' | 'ivory' | 'gold';
}) {
  const pips = PIP_POSITIONS[value] ?? PIP_POSITIONS[1];
  const bg =
    variant === 'gold'
      ? 'linear-gradient(145deg, #F6DF96 0%, #D6AD55 58%, #9B712D 100%)'
      : 'linear-gradient(145deg, #FFFFFF 0%, #F7F2E8 68%, #E4D7C1 100%)';
  const pipColor = '#08172F';

  return (
    <div
      style={{
        transform,
        background: bg,
        backfaceVisibility: 'hidden',
      }}
      className="absolute inset-0 rounded-xl border border-black/15 shadow-[inset_0_2px_4px_rgba(255,255,255,0.75),inset_0_-3px_6px_rgba(8,23,47,0.18)]"
    >
      <svg viewBox="0 0 100 100" className="w-full h-full">
        {pips.map(([cx, cy], idx) => (
          <circle
            key={idx}
            cx={cx}
            cy={cy}
            r={value === 1 ? 11.5 : 8.8}
            fill={pipColor}
          />
        ))}
      </svg>
    </div>
  );
}

/**
 * Realistic CSS 3D 6-sided white tabletop die with crisp black pips and soft contact shadow.
 */
export function Dice3D({
  value = 5,
  size = 56,
  variant = 'white',
  interactive = false,
  onClick,
}: {
  value?: number;
  size?: number;
  variant?: 'white' | 'ivory' | 'gold';
  interactive?: boolean;
  onClick?: () => void;
}) {
  const [spinOffset, setSpinOffset] = useState(0);
  const clamped = Math.min(6, Math.max(1, value));
  const rot = FACE_ROTATIONS[clamped];
  const half = size / 2;

  const handleClick = () => {
    if (interactive) {
      setSpinOffset((prev) => prev + 360);
    }
    onClick?.();
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={!interactive && !onClick}
      aria-label={`3D Die showing ${clamped}`}
      style={{
        width: size,
        height: size,
        perspective: '520px',
      }}
      className={`relative inline-flex items-center justify-center shrink-0 ${
        interactive || onClick ? 'cursor-pointer' : 'cursor-default'
      }`}
    >
      <span
        aria-hidden="true"
        style={{
          width: size * 0.92,
          height: size * 0.25,
          bottom: -size * 0.14,
        }}
        className="absolute rounded-full bg-black/55 blur-[4px] pointer-events-none"
      />
      <div
        style={{
          width: size,
          height: size,
          transformStyle: 'preserve-3d',
          transform: `rotateX(${rot.x + spinOffset}deg) rotateY(${rot.y + spinOffset}deg)`,
          transition: 'transform 360ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        className="relative"
      >
        <DiceFace value={1} variant={variant} transform={`translateZ(${half}px)`} />
        <DiceFace value={6} variant={variant} transform={`rotateY(180deg) translateZ(${half}px)`} />
        <DiceFace value={3} variant={variant} transform={`rotateY(90deg) translateZ(${half}px)`} />
        <DiceFace value={4} variant={variant} transform={`rotateY(-90deg) translateZ(${half}px)`} />
        <DiceFace value={2} variant={variant} transform={`rotateX(90deg) translateZ(${half}px)`} />
        <DiceFace value={5} variant={variant} transform={`rotateX(-90deg) translateZ(${half}px)`} />
      </div>
    </button>
  );
}

/**
 * Glossy 3D-shaded Ludo pawn SVG in official Boardora player colors with specular highlight and grounded base shadow.
 */
export function LudoPawn3D({
  color,
  size = 40,
}: {
  color: 'crimson' | 'emerald' | 'sapphire' | 'amber' | 'gold';
  size?: number;
}) {
  const uid = useId().replace(/:/g, '');
  const palette = {
    crimson: { light: '#F89A9A', mid: '#D94343', dark: '#7D1E1E' },
    emerald: { light: '#87E0B5', mid: '#269C68', dark: '#104C31' },
    sapphire: { light: '#93BCFA', mid: '#2865C7', dark: '#13356E' },
    amber: { light: '#F6DF96', mid: '#D6AD55', dark: '#9B712D' },
    gold: { light: '#F6DF96', mid: '#D6AD55', dark: '#9B712D' },
  }[color];

  const gradId = `pawn-${color}-${uid}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      className="shrink-0 drop-shadow-[0_6px_8px_rgba(3,9,20,0.55)]"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id={gradId} cx="35%" cy="28%" r="70%">
          <stop offset="0%" stopColor={palette.light} />
          <stop offset="48%" stopColor={palette.mid} />
          <stop offset="100%" stopColor={palette.dark} />
        </radialGradient>
      </defs>
      <ellipse cx="24" cy="42" rx="14" ry="4" fill="#000000" fillOpacity="0.45" />
      <path
        d="M12 39C12 35.5 17.4 33 24 33C30.6 33 36 35.5 36 39C36 41.2 30.6 42.5 24 42.5C17.4 42.5 12 41.2 12 39Z"
        fill={`url(#${gradId})`}
        stroke="#08172F"
        strokeOpacity="0.35"
      />
      <path d="M16 36L20 20H28L32 36H16Z" fill={`url(#${gradId})`} />
      <ellipse cx="24" cy="20" rx="6.5" ry="2.5" fill={palette.light} fillOpacity="0.65" />
      <circle cx="24" cy="13" r="7.5" fill={`url(#${gradId})`} />
      <ellipse
        cx="21.5"
        cy="10.2"
        rx="2.8"
        ry="1.6"
        transform="rotate(-25 21.5 10.2)"
        fill="#FFFFFF"
        fillOpacity="0.74"
      />
    </svg>
  );
}

/**
 * Sculpted golden, walnut, or ivory 3D chess piece SVG with realistic bevels and shadow.
 */
export function ChessPiece3D({
  piece,
  tone = 'gold',
  size = 44,
}: {
  piece: 'king' | 'queen' | 'knight' | 'rook';
  tone?: 'gold' | 'walnut' | 'ivory';
  size?: number;
}) {
  const uid = useId().replace(/:/g, '');
  const fillGradId = `chess-${piece}-${tone}-${uid}`;
  const stops =
    tone === 'gold'
      ? { a: '#FFF0BC', b: '#D6AD55', c: '#9B712D', stroke: '#5B3E11' }
      : tone === 'walnut'
      ? { a: '#9E7056', b: '#5B3A29', c: '#2A1810', stroke: '#D6AD55' }
      : { a: '#FFFFFF', b: '#F4EBDD', c: '#C4B69E', stroke: '#462B1E' };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      className="shrink-0 drop-shadow-[0_6px_8px_rgba(3,9,20,0.58)]"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={fillGradId} x1="12" y1="6" x2="36" y2="44" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={stops.a} />
          <stop offset="55%" stopColor={stops.b} />
          <stop offset="100%" stopColor={stops.c} />
        </linearGradient>
      </defs>
      <ellipse cx="24" cy="43" rx="14" ry="3.2" fill="#000000" fillOpacity="0.45" />
      {piece === 'knight' && (
        <path
          d="M14 39H34V42.5H14V39ZM16.5 36.5C16.5 30.5 19 26 22 23.8C18.8 23.2 16.5 21.2 16.2 18.2C15.9 15 18.4 12.2 21.5 11.2L23 8L26.5 10.5C30 10.5 33.5 13 34.6 17C35.8 21.2 33.4 26.8 31.2 29.8C32.5 31.8 33.2 34.2 33.2 36.5H16.5Z"
          fill={`url(#${fillGradId})`}
          stroke={stops.stroke}
          strokeWidth="1.1"
        />
      )}
      {piece === 'king' && (
        <path
          d="M22.5 6H25.5V9.5H29V12.5H25.5V16C30 16.5 33 19.8 32 24.5L29 36H19L16 24.5C15 19.8 18 16.5 22.5 16V12.5H19V9.5H22.5V6ZM14 38.5H34V42.5H14V38.5Z"
          fill={`url(#${fillGradId})`}
          stroke={stops.stroke}
          strokeWidth="1.1"
        />
      )}
      {piece === 'queen' && (
        <path
          d="M12 15L17.5 25L24 12L30.5 25L36 15L32.5 36H15.5L12 15ZM14 38.5H34V42.5H14V38.5Z"
          fill={`url(#${fillGradId})`}
          stroke={stops.stroke}
          strokeWidth="1.1"
        />
      )}
      {piece === 'rook' && (
        <path
          d="M15 10H19V13.5H22V10H26V13.5H29V10H33V17.5L30.5 20V36H17.5V20L15 17.5V10ZM14 38.5H34V42.5H14V38.5Z"
          fill={`url(#${fillGradId})`}
          stroke={stops.stroke}
          strokeWidth="1.1"
        />
      )}
    </svg>
  );
}

/**
 * Subtle CSS 3D perspective container for tabletop board previews and arena surfaces.
 */
export function BoardPerspectiveStage({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div style={{ perspective: '1200px' }} className={`w-full ${className}`}>
      <div
        style={{
          transform: 'rotateX(6deg)',
          transformStyle: 'preserve-3d',
        }}
        className="rounded-2xl shadow-[0_24px_50px_-14px_rgba(3,9,20,0.78)] transition-transform duration-200 hover:[transform:rotateX(2deg)]"
      >
        {children}
      </div>
    </div>
  );
}
