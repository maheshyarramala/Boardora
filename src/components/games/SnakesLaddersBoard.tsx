import { useEffect, useMemo, useState } from 'react';
import {
  LADDERS_MAP,
  SNAKES_MAP,
  type SnakesLaddersAction,
  type SnakesLaddersState,
} from '../../engines/snakesLadders/snakesLaddersEngine';
import { Dice3D } from '../tabletop/TactilePieces';

interface SnakesLaddersBoardProps {
  state: SnakesLaddersState;
  isHumanTurn: boolean;
  onAction: (action: SnakesLaddersAction) => void;
}

const CELL = 56;

const COLOR_HEX: Record<
  SnakesLaddersState['players'][number]['color'],
  string
> = {
  crimson: '#DC2626',
  emerald: '#16A34A',
  sapphire: '#2563EB',
  amber: '#D97706',
};

/** Converts square 1..100 into SVG center coordinates on a 10x10 serpentine grid */
function cellCenter(cell: number): { x: number; y: number } {
  if (cell <= 0) return { x: 18, y: 10 * CELL - 18 };
  const clamped = Math.min(100, Math.max(1, cell));
  const zeroBased = clamped - 1;
  const rowFromBottom = Math.floor(zeroBased / 10);
  const colInRow = zeroBased % 10;
  const col = rowFromBottom % 2 === 0 ? colInRow : 9 - colInRow;
  const row = 9 - rowFromBottom;
  return {
    x: col * CELL + CELL / 2,
    y: row * CELL + CELL / 2,
  };
}

export function SnakesLaddersBoard({
  state,
  isHumanTurn,
  onAction,
}: SnakesLaddersBoardProps) {
  // Smooth step-by-step hop animation for the latest move
  const [animatedPos, setAnimatedPos] = useState<number[]>(() =>
    state.players.map((p) => p.position)
  );

  useEffect(() => {
    const targetPositions = state.players.map((p) => p.position);
    if (state.lastPath.length <= 1) {
      setAnimatedPos(targetPositions);
      return;
    }

    // Determine which player just moved (on bonus roll it's currentPlayerIndex, else previous)
    const lastMoverIdx = state.players.findIndex(
      (p, idx) => p.position === state.lastPath[state.lastPath.length - 1] && animatedPos[idx] !== p.position
    );
    if (lastMoverIdx === -1) {
      setAnimatedPos(targetPositions);
      return;
    }

    let step = 0;
    const timer = window.setInterval(() => {
      step++;
      const cellVal = state.lastPath[Math.min(step, state.lastPath.length - 1)];
      setAnimatedPos((prev) =>
        prev.map((val, i) => (i === lastMoverIdx ? cellVal : val))
      );
      if (step >= state.lastPath.length - 1) {
        window.clearInterval(timer);
      }
    }, 125);

    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.moveCount]);

  const cells = useMemo(() => {
    const items: { num: number; row: number; col: number }[] = [];
    for (let row = 0; row < 10; row++) {
      const rowFromBottom = 9 - row;
      for (let col = 0; col < 10; col++) {
        const offset = rowFromBottom % 2 === 0 ? col : 9 - col;
        const num = rowFromBottom * 10 + offset + 1;
        items.push({ num, row, col });
      }
    }
    return items;
  }, []);

  const activePlayer = state.players[state.currentPlayerIndex];
  const canRoll = isHumanTurn && state.winnerIndex === null;

  return (
    <div className="arena-layout">
      <div className="arena-board-col">
        <div className="arena-square-board boardora-3d-board rounded-2xl bg-[#2A1D18] p-2 sm:p-3 border-2 border-[var(--cp-border-strong)] shadow-[0_24px_48px_-14px_rgba(0,0,0,0.75)]">
        <svg
          viewBox={`0 0 ${10 * CELL} ${10 * CELL}`}
          className="w-full h-auto block rounded-xl bg-[#0F1B33]"
          role="img"
          aria-label="Snakes and Ladders 100-square board"
        >
          {/* 100 Serpentine Squares */}
          {cells.map((c) => {
            const isAlt = (c.row + c.col) % 2 === 0;
            const isFinish = c.num === 100;
            return (
              <g key={c.num}>
                <rect
                  x={c.col * CELL}
                  y={c.row * CELL}
                  width={CELL}
                  height={CELL}
                  fill={isFinish ? '#D4AF37' : isAlt ? '#1B2E52' : '#13223E'}
                  stroke="#D4AF37"
                  strokeOpacity="0.18"
                />
                <text
                  x={c.col * CELL + 6}
                  y={c.row * CELL + 15}
                  fontSize="11"
                  fontWeight="600"
                  fontFamily="JetBrains Mono, monospace"
                  fill={isFinish ? '#081020' : '#CBD5E1'}
                >
                  {c.num}
                </text>
              </g>
            );
          })}

          {/* Gilded Wooden Ladders */}
          {Object.entries(LADDERS_MAP).map(([startStr, end]) => {
            const p1 = cellCenter(Number(startStr));
            const p2 = cellCenter(end);
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const len = Math.hypot(dx, dy) || 1;
            const nx = (-dy / len) * 7;
            const ny = (dx / len) * 7;
            const rungs = Math.max(4, Math.floor(len / 26));

            return (
              <g key={`ladder-${startStr}`} opacity="0.92">
                <line
                  x1={p1.x + nx}
                  y1={p1.y + ny}
                  x2={p2.x + nx}
                  y2={p2.y + ny}
                  stroke="#F2CF66"
                  strokeWidth="3.2"
                  strokeLinecap="round"
                />
                <line
                  x1={p1.x - nx}
                  y1={p1.y - ny}
                  x2={p2.x - nx}
                  y2={p2.y - ny}
                  stroke="#F2CF66"
                  strokeWidth="3.2"
                  strokeLinecap="round"
                />
                {Array.from({ length: rungs - 1 }, (_, i) => {
                  const t = (i + 1) / rungs;
                  const rx = p1.x + dx * t;
                  const ry = p1.y + dy * t;
                  return (
                    <line
                      key={i}
                      x1={rx + nx}
                      y1={ry + ny}
                      x2={rx - nx}
                      y2={ry - ny}
                      stroke="#D4AF37"
                      strokeWidth="2.4"
                    />
                  );
                })}
              </g>
            );
          })}

          {/* Curved Tabletop Serpents */}
          {Object.entries(SNAKES_MAP).map(([headStr, tail], idx) => {
            const p1 = cellCenter(Number(headStr));
            const p2 = cellCenter(tail);
            const mx = (p1.x + p2.x) / 2;
            const my = (p1.y + p2.y) / 2;
            const curve = idx % 2 === 0 ? 34 : -34;
            const pathD = `M ${p1.x} ${p1.y} Q ${mx + curve} ${my - 18} ${mx} ${my} T ${p2.x} ${p2.y}`;
            const bodyColor = idx % 2 === 0 ? '#10B981' : '#EF4444';

            return (
              <g key={`snake-${headStr}`} opacity="0.9">
                <path
                  d={pathD}
                  fill="none"
                  stroke="#081020"
                  strokeWidth="9"
                  strokeLinecap="round"
                />
                <path
                  d={pathD}
                  fill="none"
                  stroke={bodyColor}
                  strokeWidth="6"
                  strokeLinecap="round"
                />
                <circle cx={p1.x} cy={p1.y} r="7.5" fill={bodyColor} stroke="#081020" strokeWidth="1.5" />
                <circle cx={p1.x - 2.5} cy={p1.y - 2} r="1.4" fill="#FFFFFF" />
                <circle cx={p1.x + 2.5} cy={p1.y - 2} r="1.4" fill="#FFFFFF" />
              </g>
            );
          })}

          {/* Player Tokens */}
          {state.players.map((player, idx) => {
            const pos = animatedPos[idx] ?? player.position;
            const center = cellCenter(pos);
            const offset =
              state.players.length > 1
                ? {
                    x: (idx % 2 === 0 ? -1 : 1) * 9,
                    y: (idx < 2 ? -1 : 1) * 8,
                  }
                : { x: 0, y: 0 };

            return (
              <g
                key={player.seatIndex}
                transform={`translate(${center.x + offset.x} ${center.y + offset.y})`}
                style={{
                  transition: 'transform 120ms cubic-bezier(0.16, 1, 0.3, 1)',
                }}
              >
                <circle cy="3" r="10.5" fill="#000000" fillOpacity="0.45" />
                <circle
                  r="10.5"
                  fill={COLOR_HEX[player.color]}
                  stroke="#F5F2EB"
                  strokeWidth="2"
                />
                <text
                  y="3.5"
                  textAnchor="middle"
                  fontSize="9"
                  fontWeight="700"
                  fill="#FFFFFF"
                >
                  {idx + 1}
                </text>
              </g>
            );
          })}
        </svg>
        </div>
      </div>

      {/* Side Control Panel */}
      <aside className="arena-sidebar space-y-3">
        <div className="rounded-2xl bg-[var(--cp-bg-elevated)] border border-[var(--cp-border-strong)] p-3 sm:p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-[var(--cp-text-muted)]">ACTIVE TURN</div>
              <div className="font-display text-lg font-bold flex items-center gap-2 mt-0.5">
                <span
                  className="inline-block w-3.5 h-3.5 rounded-full border border-white/40"
                  style={{ backgroundColor: COLOR_HEX[activePlayer.color] }}
                />
                <span>{activePlayer.label}</span>
              </div>
            </div>
            <Dice3D
              value={state.lastRoll ?? 1}
              size={50}
              variant="ivory"
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
              ? `${activePlayer.label} rolling...`
              : state.winnerIndex !== null
              ? 'Match Finished'
              : 'Roll Dice'}
          </button>

          <p className="text-xs text-[var(--cp-text-muted)]">
            Finish rule: {state.finishRule === 'exact' ? 'Exact roll to 100' : 'Bounce back from 100'}
          </p>

          <div className="pt-3 border-t border-[var(--cp-border)] space-y-2">
            {state.players.map((p) => (
              <div
                key={p.seatIndex}
                className="flex items-center justify-between text-xs"
              >
                <span className="flex items-center gap-2 font-medium">
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: COLOR_HEX[p.color] }}
                  />
                  {p.label}
                </span>
                <span className="font-mono-tabular text-[var(--cp-text-muted)]">
                  Square {p.position} / 100
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl bg-[var(--cp-bg-elevated)] border border-[var(--cp-border)] p-4">
          <div className="text-xs font-semibold tracking-wider text-[var(--cp-gold)] mb-2">
            TABLE LOG
          </div>
          {state.history.length === 0 ? (
            <p className="text-xs text-[var(--cp-text-muted)]">
              Roll the die to enter square 1 and begin the climb.
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
