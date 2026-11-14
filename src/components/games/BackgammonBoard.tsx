import { useEffect, useMemo, useState } from 'react';
import { Flag, Undo2 } from 'lucide-react';
import {
  getLegalBackgammonMoves,
  getPipCount,
  type BackgammonAction,
  type BackgammonMoveAction,
  type BackgammonPointSource,
  type BackgammonPointTarget,
  type BackgammonState,
} from '../../engines/backgammon/backgammonEngine';
import { BoardPerspectiveStage, Dice3D } from '../tabletop/TactilePieces';

interface BackgammonBoardProps {
  state: BackgammonState;
  isHumanTurn: boolean;
  aiThinking?: boolean;
  onAction: (action: BackgammonAction) => void;
}

const TOP_POINTS = [12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23] as const;
const BOTTOM_POINTS = [11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0] as const;

function getPointCenterX(pointIdx: number): number {
  const posInRow =
    pointIdx >= 12 ? pointIdx - 12 : 11 - pointIdx; // 0..11 left to right
  const base = 18;
  const colW = 36;
  const barGap = posInRow >= 6 ? 38 : 0;
  return base + posInRow * colW + barGap + colW / 2;
}

export function BackgammonBoard({
  state,
  isHumanTurn,
  aiThinking = false,
  onAction,
}: BackgammonBoardProps) {
  const [selectedSource, setSelectedSource] =
    useState<BackgammonPointSource | null>(null);
  const [rollingAnim, setRollingAnim] = useState(false);

  const legalMoves = useMemo(
    () => (isHumanTurn ? getLegalBackgammonMoves(state) : []),
    [isHumanTurn, state]
  );

  // Auto-select bar when checkers must re-enter from bar
  useEffect(() => {
    if (isHumanTurn && state.phase === 'move' && state.bar[state.turn] > 0) {
      setSelectedSource('bar');
    } else {
      setSelectedSource(null);
    }
  }, [isHumanTurn, state.phase, state.turn, state.bar, state.moveCount]);

  const legalSources = useMemo(() => {
    const s = new Set<BackgammonPointSource>();
    for (const m of legalMoves) s.add(m.from);
    return s;
  }, [legalMoves]);

  const movesFromSelected = useMemo(() => {
    if (selectedSource === null) return new Map<BackgammonPointTarget, BackgammonMoveAction>();
    const map = new Map<BackgammonPointTarget, BackgammonMoveAction>();
    for (const m of legalMoves) {
      if (m.from === selectedSource && !map.has(m.to)) {
        map.set(m.to, m);
      }
    }
    return map;
  }, [legalMoves, selectedSource]);

  const handleRoll = () => {
    if (!isHumanTurn || state.phase !== 'roll' || rollingAnim || aiThinking) return;
    setRollingAnim(true);
    window.setTimeout(() => {
      setRollingAnim(false);
      onAction({ type: 'ROLL' });
    }, 240);
  };

  const handlePointTap = (pointIdx: number) => {
    if (!isHumanTurn || state.phase !== 'move' || aiThinking) return;

    const targetMove = movesFromSelected.get(pointIdx);
    if (targetMove) {
      onAction(targetMove);
      return;
    }

    if (legalSources.has(pointIdx)) {
      setSelectedSource(selectedSource === pointIdx ? null : pointIdx);
      return;
    }

    if (state.bar[state.turn] === 0) {
      setSelectedSource(null);
    }
  };

  const handleOffTrayTap = () => {
    if (!isHumanTurn || state.phase !== 'move' || aiThinking) return;
    const offMove = movesFromSelected.get('off');
    if (offMove) {
      onAction(offMove);
    }
  };

  const whitePips = getPipCount(state.points, state.bar, 'w');
  const blackPips = getPipCount(state.points, state.bar, 'b');

  const renderTriangle = (pointIdx: number, isTop: boolean) => {
    const cx = getPointCenterX(pointIdx);
    const xLeft = cx - 18;
    const xRight = cx + 18;
    const yBase = isTop ? 16 : 364;
    const yTip = isTop ? 158 : 222;
    const isLightTri = pointIdx % 2 === 0;
    const countSigned = state.points[pointIdx];
    const absCount = Math.abs(countSigned);
    const color = countSigned > 0 ? 'w' : countSigned < 0 ? 'b' : null;
    const isSource = legalSources.has(pointIdx);
    const isSelected = selectedSource === pointIdx;
    const destMove = movesFromSelected.get(pointIdx);

    // Draw up to 5 stacked checkers clearly, with count badge if > 5
    const visibleCheckers = Math.min(absCount, 5);
    const interactive =
      isHumanTurn && state.phase === 'move' && !aiThinking && (isSource || !!destMove);

    return (
      <g
        key={pointIdx}
        onClick={() => handlePointTap(pointIdx)}
        className={interactive ? 'cursor-pointer' : 'cursor-default'}
      >
        <polygon
          points={`${xLeft},${yBase} ${xRight},${yBase} ${cx},${yTip}`}
          fill={isLightTri ? '#d8c39e' : '#7f1d1d'}
          fillOpacity={0.92}
          stroke={
            destMove
              ? '#34d399'
              : isSelected
              ? '#fbbf24'
              : 'rgba(15,23,42,0.4)'
          }
          strokeWidth={destMove || isSelected ? 2.2 : 0.8}
        />

        {/* Hit box */}
        <rect
          x={xLeft}
          y={isTop ? 12 : 196}
          width={36}
          height={168}
          fill="transparent"
        />

        {/* Point index micro-label */}
        <text
          x={cx}
          y={isTop ? 12 : 375}
          textAnchor="middle"
          fontSize="8.5"
          fill="#d4af37"
          opacity="0.7"
          fontFamily="monospace"
        >
          {pointIdx + 1}
        </text>

        {/* Stacked checkers */}
        {color &&
          Array.from({ length: visibleCheckers }, (_, i) => {
            const cy = isTop ? 31 + i * 25 : 349 - i * 25;
            const isTopChecker = i === visibleCheckers - 1;
            return (
              <g key={i}>
                <circle
                  cx={cx + 1}
                  cy={cy + 1.5}
                  r={12.5}
                  fill="rgba(0,0,0,0.42)"
                />
                <circle
                  cx={cx}
                  cy={cy}
                  r={12.5}
                  fill={color === 'w' ? 'url(#bg-ivory)' : 'url(#bg-crimson)'}
                  stroke={
                    isSelected && isTopChecker
                      ? '#fbbf24'
                      : isSource && isTopChecker
                      ? '#fde68a'
                      : color === 'w'
                      ? '#b45309'
                      : '#7f1d1d'
                  }
                  strokeWidth={isSelected && isTopChecker ? 2.6 : 1.4}
                />
                <circle
                  cx={cx}
                  cy={cy}
                  r={7}
                  fill="none"
                  stroke={color === 'w' ? '#d97706' : '#fca5a5'}
                  strokeWidth="0.8"
                  strokeOpacity="0.45"
                />
                {absCount > 5 && isTopChecker && (
                  <text
                    x={cx}
                    y={cy + 3.5}
                    textAnchor="middle"
                    fontSize="10"
                    fontWeight="bold"
                    fill={color === 'w' ? '#1e293b' : '#ffffff'}
                  >
                    {absCount}
                  </text>
                )}
              </g>
            );
          })}

        {/* Legal Destination Marker */}
        {destMove && (
          <g>
            <circle
              cx={cx}
              cy={isTop ? 31 + visibleCheckers * 22 : 349 - visibleCheckers * 22}
              r={10.5}
              fill="rgba(16,185,129,0.28)"
              stroke="#34d399"
              strokeWidth="2"
            />
            <text
              x={cx}
              y={(isTop ? 31 + visibleCheckers * 22 : 349 - visibleCheckers * 22) + 3.5}
              textAnchor="middle"
              fontSize="9.5"
              fontWeight="bold"
              fill="#ecfdf5"
            >
              {destMove.die}
            </text>
          </g>
        )}
      </g>
    );
  };

  const barCx = 18 + 6 * 36 + 19; // Center of walnut bar = 253
  const canBearOffWhite =
    state.turn === 'w' && movesFromSelected.has('off');
  const canBearOffBlack =
    state.turn === 'b' && movesFromSelected.has('off');

  return (
    <div className="arena-layout">
      <div className="arena-board-col">
        <BoardPerspectiveStage className="arena-wide-board">
          <div className="boardora-3d-board rounded-2xl bg-[#3c2313] p-2 sm:p-3 border-2 border-[#d4af37]/60 shadow-2xl">
            <svg
              viewBox="0 0 546 380"
              className="w-full h-auto block select-none"
              role="img"
              aria-label="Backgammon board"
            >
              <defs>
                <linearGradient id="bg-felt" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#0f3f33" />
                  <stop offset="50%" stopColor="#0a2e25" />
                  <stop offset="100%" stopColor="#08231c" />
                </linearGradient>
                <radialGradient id="bg-ivory" cx="35%" cy="30%" r="70%">
                  <stop offset="0%" stopColor="#fffbeb" />
                  <stop offset="60%" stopColor="#f3e5ab" />
                  <stop offset="100%" stopColor="#b45309" />
                </radialGradient>
                <radialGradient id="bg-crimson" cx="35%" cy="30%" r="70%">
                  <stop offset="0%" stopColor="#fca5a5" />
                  <stop offset="45%" stopColor="#dc2626" />
                  <stop offset="100%" stopColor="#450a0a" />
                </radialGradient>
              </defs>

              {/* Outer Walnut Frame */}
              <rect
                x="2"
                y="2"
                width="542"
                height="376"
                rx="12"
                fill="#4a2b16"
                stroke="#d4af37"
                strokeWidth="2"
                strokeOpacity="0.6"
              />

              {/* Left & Right Felt Halves */}
              <rect x="16" y="16" width="220" height="348" rx="4" fill="url(#bg-felt)" />
              <rect x="270" y="16" width="220" height="348" rx="4" fill="url(#bg-felt)" />

              {/* Central Bar */}
              <rect
                x="236"
                y="16"
                width="34"
                height="348"
                fill="#351d0e"
                stroke="#d4af37"
                strokeOpacity="0.35"
                strokeWidth="1"
              />
              <text
                x={barCx}
                y="194"
                textAnchor="middle"
                fontSize="8.5"
                letterSpacing="1.5"
                fill="#d4af37"
                opacity="0.7"
              >
                BAR
              </text>

              {/* All 24 Triangles */}
              {TOP_POINTS.map((idx) => renderTriangle(idx, true))}
              {BOTTOM_POINTS.map((idx) => renderTriangle(idx, false))}

              {/* Bar Checkers */}
              {state.bar.w > 0 && (
                <g
                  onClick={() => {
                    if (isHumanTurn && state.turn === 'w' && state.phase === 'move') {
                      setSelectedSource('bar');
                    }
                  }}
                  className={
                    isHumanTurn && state.turn === 'w' ? 'cursor-pointer' : 'cursor-default'
                  }
                >
                  <circle
                    cx={barCx}
                    cy={138}
                    r={13}
                    fill="url(#bg-ivory)"
                    stroke={selectedSource === 'bar' && state.turn === 'w' ? '#fbbf24' : '#b45309'}
                    strokeWidth={selectedSource === 'bar' && state.turn === 'w' ? 3 : 1.5}
                  />
                  {state.bar.w > 1 && (
                    <text
                      x={barCx}
                      y={142}
                      textAnchor="middle"
                      fontSize="10"
                      fontWeight="bold"
                      fill="#1e293b"
                    >
                      {state.bar.w}
                    </text>
                  )}
                </g>
              )}

              {state.bar.b > 0 && (
                <g
                  onClick={() => {
                    if (isHumanTurn && state.turn === 'b' && state.phase === 'move') {
                      setSelectedSource('bar');
                    }
                  }}
                  className={
                    isHumanTurn && state.turn === 'b' ? 'cursor-pointer' : 'cursor-default'
                  }
                >
                  <circle
                    cx={barCx}
                    cy={242}
                    r={13}
                    fill="url(#bg-crimson)"
                    stroke={selectedSource === 'bar' && state.turn === 'b' ? '#fbbf24' : '#7f1d1d'}
                    strokeWidth={selectedSource === 'bar' && state.turn === 'b' ? 3 : 1.5}
                  />
                  {state.bar.b > 1 && (
                    <text
                      x={barCx}
                      y={246}
                      textAnchor="middle"
                      fontSize="10"
                      fontWeight="bold"
                      fill="#ffffff"
                    >
                      {state.bar.b}
                    </text>
                  )}
                </g>
              )}

              {/* Right Bearing-Off Trays */}
              {/* Crimson Off (top right) */}
              <g
                onClick={() => canBearOffBlack && handleOffTrayTap()}
                className={canBearOffBlack ? 'cursor-pointer' : 'cursor-default'}
              >
                <rect
                  x="498"
                  y="16"
                  width="36"
                  height="164"
                  rx="6"
                  fill="#1f1108"
                  stroke={canBearOffBlack ? '#34d399' : '#d4af37'}
                  strokeWidth={canBearOffBlack ? 2.5 : 1}
                  strokeOpacity={canBearOffBlack ? 0.95 : 0.4}
                />
                <text
                  x="516"
                  y="32"
                  textAnchor="middle"
                  fontSize="8"
                  fill={canBearOffBlack ? '#6ee7b7' : '#d4af37'}
                >
                  OFF
                </text>
                {Array.from({ length: state.off.b }, (_, i) => (
                  <rect
                    key={i}
                    x="504"
                    y={40 + i * 8}
                    width="24"
                    height="6"
                    rx="2"
                    fill="#dc2626"
                    stroke="#450a0a"
                    strokeWidth="0.6"
                  />
                ))}
              </g>

              {/* Ivory Off (bottom right) */}
              <g
                onClick={() => canBearOffWhite && handleOffTrayTap()}
                className={canBearOffWhite ? 'cursor-pointer' : 'cursor-default'}
              >
                <rect
                  x="498"
                  y="200"
                  width="36"
                  height="164"
                  rx="6"
                  fill="#1f1108"
                  stroke={canBearOffWhite ? '#34d399' : '#d4af37'}
                  strokeWidth={canBearOffWhite ? 2.5 : 1}
                  strokeOpacity={canBearOffWhite ? 0.95 : 0.4}
                />
                <text
                  x="516"
                  y="354"
                  textAnchor="middle"
                  fontSize="8"
                  fill={canBearOffWhite ? '#6ee7b7' : '#d4af37'}
                >
                  OFF
                </text>
                {Array.from({ length: state.off.w }, (_, i) => (
                  <rect
                    key={i}
                    x="504"
                    y={334 - i * 8}
                    width="24"
                    height="6"
                    rx="2"
                    fill="#f3e5ab"
                    stroke="#92400e"
                    strokeWidth="0.6"
                  />
                ))}
              </g>
            </svg>
          </div>
        </BoardPerspectiveStage>
      </div>

      {/* Dice, Pip Counts & History Panel */}
      <aside className="arena-sidebar space-y-3">
        <div className="rounded-2xl bg-[var(--cp-bg-elevated)] border border-[var(--cp-border)] p-3 sm:p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <span
                className={`w-3.5 h-3.5 rounded-full border ${
                  state.turn === 'w'
                    ? 'bg-[#f3e5ab] border-[#d4af37]'
                    : 'bg-red-600 border-red-300'
                }`}
              />
              <div>
                <div className="font-display font-bold text-base">
                  {state.turn === 'w' ? 'Ivory' : 'Crimson'}
                  {aiThinking ? ' (Thinking...)' : ''}
                </div>
                <div className="text-xs text-[var(--cp-text-muted)]">
                  {state.phase === 'roll'
                    ? 'Roll twin dice to start your turn.'
                    : state.bar[state.turn] > 0
                    ? 'Re-enter checker from the Bar first.'
                    : 'Tap a highlighted checker, then a glowing triangle.'}
                </div>
              </div>
            </div>
          </div>

          {/* Twin 3D Dice */}
          <div className="rounded-xl bg-[var(--cp-surface)] border border-[var(--cp-border)] p-4 flex items-center justify-between gap-4">
            <div
              className={`flex items-center gap-3 transition-transform duration-200 ${
                rollingAnim ? 'scale-105 opacity-85' : ''
              }`}
            >
              <Dice3D
                value={state.lastDice?.[0] ?? 5}
                size={46}
                variant={state.turn === 'w' ? 'ivory' : 'gold'}
                interactive={isHumanTurn && state.phase === 'roll'}
                onClick={handleRoll}
              />
              <Dice3D
                value={state.lastDice?.[1] ?? 3}
                size={46}
                variant={state.turn === 'w' ? 'ivory' : 'gold'}
                interactive={isHumanTurn && state.phase === 'roll'}
                onClick={handleRoll}
              />
            </div>

            {state.phase === 'roll' && isHumanTurn ? (
              <button
                type="button"
                disabled={rollingAnim || aiThinking}
                onClick={handleRoll}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-[var(--cp-gold)] text-[#081020] font-semibold text-sm hover:brightness-105 cursor-pointer disabled:opacity-50"
              >
                {rollingAnim ? 'Rolling...' : 'Roll Dice'}
              </button>
            ) : (
              <div className="text-right">
                <div className="text-[10px] uppercase tracking-wider text-[var(--cp-text-muted)]">
                  Remaining
                </div>
                <div className="mt-1 flex items-center justify-end gap-1">
                  {state.remainingDice.length === 0 ? (
                    <span className="text-xs font-mono-tabular text-[var(--cp-text-muted)]">
                      —
                    </span>
                  ) : (
                    state.remainingDice.map((d, idx) => (
                      <span
                        key={`${d}-${idx}`}
                        className="w-6 h-6 rounded-md bg-[var(--cp-gold)]/20 border border-[var(--cp-gold)]/60 text-xs font-bold font-mono-tabular text-[var(--cp-gold)] inline-flex items-center justify-center"
                      >
                        {d}
                      </span>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Pip Counts & Borne Off */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-xl bg-[var(--cp-surface)] border border-[var(--cp-border)] p-3">
              <div className="font-semibold text-[#f3e5ab]">Ivory (24 → 1)</div>
              <div className="mt-1 font-mono-tabular text-[var(--cp-text-muted)]">
                Pips: {whitePips} · Off: {state.off.w}/15
              </div>
            </div>
            <div className="rounded-xl bg-[var(--cp-surface)] border border-[var(--cp-border)] p-3">
              <div className="font-semibold text-red-300">Crimson (1 → 24)</div>
              <div className="mt-1 font-mono-tabular text-[var(--cp-text-muted)]">
                Pips: {blackPips} · Off: {state.off.b}/15
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2">
            {state.mode !== 'online' && (
              <button
                type="button"
                disabled={
                  !isHumanTurn ||
                  state.phase !== 'move' ||
                  state.turnUndoStack.length === 0 ||
                  aiThinking
                }
                onClick={() => onAction({ type: 'UNDO' })}
                className="min-h-[40px] px-3.5 rounded-xl bg-[var(--cp-surface)] border border-[var(--cp-border)] hover:border-[var(--cp-gold)] disabled:opacity-40 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
              >
                <Undo2 className="w-3.5 h-3.5" />
                Undo Step
              </button>
            )}
            <button
              type="button"
              disabled={aiThinking}
              onClick={() => onAction({ type: 'RESIGN', color: state.turn })}
              className="min-h-[40px] px-3.5 rounded-xl bg-[var(--cp-surface)] border border-[var(--cp-border)] hover:border-red-400/60 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Flag className="w-3.5 h-3.5" />
              Resign
            </button>
          </div>
        </div>

        {/* History */}
        <div className="rounded-2xl bg-[var(--cp-bg-elevated)] border border-[var(--cp-border)] p-4">
          <div className="text-xs font-semibold tracking-wider text-[var(--cp-text-muted)] mb-2">
            MATCH HISTORY ({state.history.length})
          </div>
          {state.history.length === 0 ? (
            <p className="text-xs text-[var(--cp-text-muted)]">
              Roll twin dice to begin advancing checkers home.
            </p>
          ) : (
            <ul className="max-h-40 overflow-y-auto space-y-1 text-xs font-mono-tabular text-[var(--cp-text-muted)]">
              {state.history.map((entry, idx) => (
                <li key={`${entry}-${idx}`}>{entry}</li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </div>
  );
}
