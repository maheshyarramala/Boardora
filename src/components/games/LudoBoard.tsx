import { useMemo } from 'react';
import {
  canPawnMove,
  getGlobalRingIndex,
  LUDO_SAFE_RING_INDICES,
  type LudoAction,
  type LudoColor,
  type LudoState,
} from '../../engines/ludo/ludoEngine';
import { useAppState } from '../../state/AppStateContext';
import { Dice3D } from '../tabletop/TactilePieces';

interface LudoBoardProps {
  state: LudoState;
  isHumanTurn: boolean;
  legalActions: LudoAction[];
  onAction: (action: LudoAction) => void;
}

/** 52-cell clockwise outer track on a 15x15 grid */
const OUTER_RING_COORDS: readonly [number, number][] = [
  // Red arm -> up
  [1, 6], [2, 6], [3, 6], [4, 6], [5, 6],
  [6, 5], [6, 4], [6, 3], [6, 2], [6, 1], [6, 0],
  [7, 0], [8, 0],
  // Green start (13) -> right
  [8, 1], [8, 2], [8, 3], [8, 4], [8, 5],
  [9, 6], [10, 6], [11, 6], [12, 6], [13, 6], [14, 6],
  [14, 7], [14, 8],
  // Yellow start (26) -> down
  [13, 8], [12, 8], [11, 8], [10, 8], [9, 8],
  [8, 9], [8, 10], [8, 11], [8, 12], [8, 13], [8, 14],
  [7, 14], [6, 14],
  // Blue start (39) -> left
  [6, 13], [6, 12], [6, 11], [6, 10], [6, 9],
  [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8],
  [0, 7], [0, 6],
];

const HOME_STRETCH_COORDS: Record<LudoColor, readonly [number, number][]> = {
  red: [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7]],
  green: [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5]],
  yellow: [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7]],
  blue: [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9]],
};

const BASE_SLOTS: Record<LudoColor, readonly [number, number][]> = {
  red: [[1.6, 1.6], [3.4, 1.6], [1.6, 3.4], [3.4, 3.4]],
  green: [[10.6, 1.6], [12.4, 1.6], [10.6, 3.4], [12.4, 3.4]],
  yellow: [[10.6, 10.6], [12.4, 10.6], [10.6, 12.4], [12.4, 12.4]],
  blue: [[1.6, 10.6], [3.4, 10.6], [1.6, 12.4], [3.4, 12.4]],
};

const CROWN_SLOTS: Record<LudoColor, [number, number]> = {
  red: [6.0, 7.0],
  green: [7.0, 6.0],
  yellow: [8.0, 7.0],
  blue: [7.0, 8.0],
};

const COLOR_HEX: Record<
  LudoColor,
  { fill: string; light: string; dark: string; symbol: string }
> = {
  red: { fill: '#DC2626', light: '#FCA5A5', dark: '#7F1D1D', symbol: '▲' },
  green: { fill: '#16A34A', light: '#86EFAC', dark: '#14532D', symbol: '■' },
  yellow: { fill: '#EAB308', light: '#FEF08A', dark: '#854D0E', symbol: '★' },
  blue: { fill: '#2563EB', light: '#93C5FD', dark: '#1E3A8A', symbol: '●' },
};

const CELL = 40;

function getPawnGridCoord(
  color: LudoColor,
  pawnIndex: number,
  progress: number
): [number, number] {
  if (progress === -1) {
    return BASE_SLOTS[color][pawnIndex];
  }
  if (progress === 56) {
    return CROWN_SLOTS[color];
  }
  if (progress >= 51) {
    return HOME_STRETCH_COORDS[color][progress - 51];
  }
  const ring = getGlobalRingIndex(color, progress)!;
  return OUTER_RING_COORDS[ring];
}

export function LudoBoard({
  state,
  isHumanTurn,
  legalActions,
  onAction,
}: LudoBoardProps) {
  const { profile } = useAppState();
  const showSymbols = profile?.preferences.accessibility.colorblindSymbols ?? false;
  const activePlayer = state.players[state.currentPlayerIndex];

  const movablePawnIndices = useMemo(() => {
    const set = new Set<number>();
    for (const a of legalActions) {
      if (a.type === 'MOVE_PAWN') set.add(a.pawnIndex);
    }
    return set;
  }, [legalActions]);

  // Compute subtle stack offsets when multiple pawns occupy the same cell
  const pawnPositions = useMemo(() => {
    const coordGroups = new Map<string, string[]>();
    const rawCoords: {
      key: string;
      seatIdx: number;
      color: LudoColor;
      pawnIdx: 0 | 1 | 2 | 3;
      gx: number;
      gy: number;
      progress: number;
    }[] = [];

    state.players.forEach((player, seatIdx) => {
      player.pawns.forEach((prog, pIdx) => {
        const [gx, gy] = getPawnGridCoord(player.color, pIdx, prog);
        const key = `${seatIdx}-${pIdx}`;
        const bucket = `${gx.toFixed(1)},${gy.toFixed(1)}`;
        const arr = coordGroups.get(bucket) ?? [];
        arr.push(key);
        coordGroups.set(bucket, arr);
        rawCoords.push({
          key,
          seatIdx,
          color: player.color,
          pawnIdx: pIdx as 0 | 1 | 2 | 3,
          gx,
          gy,
          progress: prog,
        });
      });
    });

    return rawCoords.map((item) => {
      const bucket = `${item.gx.toFixed(1)},${item.gy.toFixed(1)}`;
      const group = coordGroups.get(bucket) ?? [item.key];
      const indexInGroup = group.indexOf(item.key);
      let ox = 0;
      let oy = 0;
      if (group.length > 1) {
        const angle = (indexInGroup / group.length) * Math.PI * 2;
        ox = Math.cos(angle) * 7;
        oy = Math.sin(angle) * 7;
      }
      return {
        ...item,
        cx: item.gx * CELL + CELL / 2 + ox,
        cy: item.gy * CELL + CELL / 2 + oy,
        stacked: group.length > 1,
      };
    });
  }, [state.players]);

  const canRoll =
    isHumanTurn && state.phase === 'ROLL' && state.winnerIndex === null;

  return (
    <div className="arena-layout">
      {/* 15x15 Inlaid Tabletop SVG Board */}
      <div className="arena-board-col">
        <div className="arena-square-board rounded-2xl bg-[#2A1D18] p-2 sm:p-3 border-2 border-[var(--cp-border-strong)] shadow-[0_24px_48px_-14px_rgba(0,0,0,0.75)]">
        <svg
          viewBox={`0 0 ${15 * CELL} ${15 * CELL}`}
          className="w-full h-auto block rounded-xl bg-[#F4EFE4]"
          role="img"
          aria-label="Ludo game board"
        >
          <defs>
            {(Object.keys(COLOR_HEX) as LudoColor[]).map((c) => (
              <radialGradient key={c} id={`ludo-pawn-${c}`} cx="35%" cy="30%" r="70%">
                <stop offset="0%" stopColor={COLOR_HEX[c].light} />
                <stop offset="55%" stopColor={COLOR_HEX[c].fill} />
                <stop offset="100%" stopColor={COLOR_HEX[c].dark} />
              </radialGradient>
            ))}
          </defs>

          {/* Outer Track Cells */}
          {OUTER_RING_COORDS.map(([col, row], idx) => {
            const isRedStart = idx === 0;
            const isGreenStart = idx === 13;
            const isYellowStart = idx === 26;
            const isBlueStart = idx === 39;
            const isSafe = LUDO_SAFE_RING_INDICES.has(idx);
            const fill = isRedStart
              ? '#FCA5A5'
              : isGreenStart
              ? '#86EFAC'
              : isYellowStart
              ? '#FDE047'
              : isBlueStart
              ? '#93C5FD'
              : '#FAF6ED';

            return (
              <g key={`track-${idx}`}>
                <rect
                  x={col * CELL}
                  y={row * CELL}
                  width={CELL}
                  height={CELL}
                  fill={fill}
                  stroke="#334155"
                  strokeOpacity="0.35"
                  strokeWidth="1"
                />
                {isSafe && (
                  <path
                    d="M20 8L23 16H31L25 21L27 29L20 24L13 29L15 21L9 16H17L20 8Z"
                    transform={`translate(${col * CELL} ${row * CELL})`}
                    fill="#9A7414"
                    fillOpacity="0.45"
                  />
                )}
              </g>
            );
          })}

          {/* Colored Home Stretches */}
          {(Object.keys(HOME_STRETCH_COORDS) as LudoColor[]).map((color) =>
            HOME_STRETCH_COORDS[color].map(([col, row], i) => (
              <rect
                key={`home-${color}-${i}`}
                x={col * CELL}
                y={row * CELL}
                width={CELL}
                height={CELL}
                fill={COLOR_HEX[color].light}
                stroke="#334155"
                strokeOpacity="0.35"
              />
            ))
          )}

          {/* 4 Corner Yards */}
          {(
            [
              { color: 'red' as const, x: 0, y: 0 },
              { color: 'green' as const, x: 9 * CELL, y: 0 },
              { color: 'yellow' as const, x: 9 * CELL, y: 9 * CELL },
              { color: 'blue' as const, x: 0, y: 9 * CELL },
            ] as const
          ).map((yard) => (
            <g key={yard.color}>
              <rect
                x={yard.x}
                y={yard.y}
                width={6 * CELL}
                height={6 * CELL}
                fill={COLOR_HEX[yard.color].fill}
                stroke="#1E293B"
                strokeWidth="1.5"
              />
              <rect
                x={yard.x + 0.8 * CELL}
                y={yard.y + 0.8 * CELL}
                width={4.4 * CELL}
                height={4.4 * CELL}
                rx={16}
                fill="#FAF6ED"
              />
              {BASE_SLOTS[yard.color].map(([sx, sy], idx) => (
                <circle
                  key={`slot-${yard.color}-${idx}`}
                  cx={sx * CELL + CELL / 2}
                  cy={sy * CELL + CELL / 2}
                  r={14}
                  fill={COLOR_HEX[yard.color].light}
                  fillOpacity="0.55"
                  stroke={COLOR_HEX[yard.color].dark}
                  strokeWidth="1.2"
                />
              ))}
            </g>
          ))}

          {/* Center Home Crown */}
          <g transform={`translate(${6 * CELL} ${6 * CELL})`}>
            <polygon points={`0,0 ${3 * CELL},0 ${1.5 * CELL},${1.5 * CELL}`} fill="#16A34A" />
            <polygon points={`${3 * CELL},0 ${3 * CELL},${3 * CELL} ${1.5 * CELL},${1.5 * CELL}`} fill="#EAB308" />
            <polygon points={`${3 * CELL},${3 * CELL} 0,${3 * CELL} ${1.5 * CELL},${1.5 * CELL}`} fill="#2563EB" />
            <polygon points={`0,${3 * CELL} 0,0 ${1.5 * CELL},${1.5 * CELL}`} fill="#DC2626" />
            <rect
              width={3 * CELL}
              height={3 * CELL}
              fill="none"
              stroke="#1E293B"
              strokeWidth="1.5"
            />
          </g>

          {/* Glossy Animated Pawns */}
          {pawnPositions.map((p) => {
            const isActiveSeat = p.seatIdx === state.currentPlayerIndex;
            const isSelectable =
              isHumanTurn &&
              state.phase === 'MOVE' &&
              isActiveSeat &&
              movablePawnIndices.has(p.pawnIdx) &&
              state.lastRoll !== null &&
              canPawnMove(p.progress, state.lastRoll);

            return (
              <g
                key={p.key}
                transform={`translate(${p.cx} ${p.cy})`}
                onClick={() => {
                  if (isSelectable) {
                    onAction({ type: 'MOVE_PAWN', pawnIndex: p.pawnIdx });
                  }
                }}
                style={{
                  transition: 'transform 180ms cubic-bezier(0.16, 1, 0.3, 1)',
                  cursor: isSelectable ? 'pointer' : 'default',
                }}
                role={isSelectable ? 'button' : undefined}
                aria-label={
                  isSelectable
                    ? `Move ${p.color} pawn ${p.pawnIdx + 1}`
                    : undefined
                }
              >
                {isSelectable && (
                  <circle
                    r={p.stacked ? 17 : 19}
                    fill="none"
                    stroke="#081020"
                    strokeWidth="3.5"
                    strokeDasharray="5 3"
                  />
                )}
                <circle cx="0" cy="4" r={p.stacked ? 11 : 13} fill="#000000" fillOpacity="0.35" />
                <circle
                  r={p.stacked ? 11 : 13.5}
                  fill={`url(#ludo-pawn-${p.color})`}
                  stroke={isSelectable ? '#F2CF66' : '#081020'}
                  strokeWidth={isSelectable ? 2.5 : 1.5}
                />
                <ellipse
                  cx="-3.5"
                  cy="-4.5"
                  rx="4"
                  ry="2.2"
                  transform="rotate(-25 -3.5 -4.5)"
                  fill="#FFFFFF"
                  fillOpacity="0.65"
                />
                {showSymbols && (
                  <text
                    y="3.5"
                    textAnchor="middle"
                    fontSize="10"
                    fontWeight="700"
                    fill="#FFFFFF"
                  >
                    {COLOR_HEX[p.color].symbol}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
        </div>
      </div>

      {/* Tabletop Control & Status Panel */}
      <aside className="arena-sidebar space-y-3">
        <div className="rounded-2xl bg-[var(--cp-bg-elevated)] border border-[var(--cp-border-strong)] p-3 sm:p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-[var(--cp-text-muted)]">ACTIVE TURN</div>
              <div className="font-display text-lg font-bold flex items-center gap-2 mt-0.5">
                <span
                  className="inline-block w-3.5 h-3.5 rounded-full border border-white/40"
                  style={{ backgroundColor: COLOR_HEX[activePlayer.color].fill }}
                />
                <span>{activePlayer.label}</span>
              </div>
            </div>
            <Dice3D
              value={state.lastRoll ?? 6}
              size={50}
              variant="gold"
              interactive={canRoll}
              onClick={canRoll ? () => onAction({ type: 'ROLL_DICE' }) : undefined}
            />
          </div>

          <button
            type="button"
            disabled={!canRoll}
            onClick={() => onAction({ type: 'ROLL_DICE' })}
            className={`min-h-[48px] w-full rounded-xl font-semibold text-sm transition-colors ${
              canRoll
                ? 'bg-[var(--cp-gold)] text-[#081020] hover:bg-[var(--cp-gold-bright)] cursor-pointer'
                : 'bg-[var(--cp-surface)] text-[var(--cp-text-muted)] cursor-not-allowed'
            }`}
          >
            {!isHumanTurn
              ? `${activePlayer.label} thinking...`
              : state.phase === 'ROLL'
              ? 'Roll Dice'
              : `Rolled ${state.lastRoll} — Select Highlighted Pawn`}
          </button>

          {/* Team Home Progress */}
          <div className="pt-3 border-t border-[var(--cp-border)] space-y-2">
            {state.players.map((player) => {
              const homeCount = player.pawns.filter((v) => v === 56).length;
              return (
                <div
                  key={player.seatIndex}
                  className="flex items-center justify-between text-xs"
                >
                  <span className="flex items-center gap-2 font-medium">
                    <span
                      className="inline-block w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: COLOR_HEX[player.color].fill }}
                    />
                    {player.label}
                  </span>
                  <span className="font-mono-tabular text-[var(--cp-text-muted)]">
                    {homeCount} / 4 Home
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Action Feed */}
        <div className="rounded-2xl bg-[var(--cp-bg-elevated)] border border-[var(--cp-border)] p-4">
          <div className="text-xs font-semibold tracking-wider text-[var(--cp-gold)] mb-2">
            TABLE LOG
          </div>
          {state.history.length === 0 ? (
            <p className="text-xs text-[var(--cp-text-muted)]">
              Roll a 6 to deploy your first pawn from base.
            </p>
          ) : (
            <ul className="space-y-1.5 text-xs text-[var(--cp-text-muted)] max-h-36 overflow-y-auto">
              {state.history.slice(0, 8).map((entry, idx) => (
                <li key={idx}>{entry}</li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </div>
  );
}
