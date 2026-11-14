import { useMemo, useState } from 'react';
import { Flag, Sparkles, Undo2 } from 'lucide-react';
import {
  MORRIS_MILLS,
  countPiecesOnBoard,
  getCapturableTargets,
  getLegalMorrisActions,
  getPlayerPhase,
  type MorrisAction,
  type NineMensMorrisState,
} from '../../engines/nineMensMorris/nineMensMorrisEngine';
import { BoardPerspectiveStage } from '../tabletop/TactilePieces';

interface NineMensMorrisBoardProps {
  state: NineMensMorrisState;
  isHumanTurn: boolean;
  aiThinking?: boolean;
  onAction: (action: MorrisAction) => void;
}

const NODE_COORDS: readonly { x: number; y: number }[] = [
  // Outer square (0..7)
  { x: 42, y: 42 },
  { x: 210, y: 42 },
  { x: 378, y: 42 },
  { x: 378, y: 210 },
  { x: 378, y: 378 },
  { x: 210, y: 378 },
  { x: 42, y: 378 },
  { x: 42, y: 210 },
  // Middle square (8..15)
  { x: 98, y: 98 },
  { x: 210, y: 98 },
  { x: 322, y: 98 },
  { x: 322, y: 210 },
  { x: 322, y: 322 },
  { x: 210, y: 322 },
  { x: 98, y: 322 },
  { x: 98, y: 210 },
  // Inner square (16..23)
  { x: 154, y: 154 },
  { x: 210, y: 154 },
  { x: 266, y: 154 },
  { x: 266, y: 210 },
  { x: 266, y: 266 },
  { x: 210, y: 266 },
  { x: 154, y: 266 },
  { x: 154, y: 210 },
];

export function NineMensMorrisBoard({
  state,
  isHumanTurn,
  aiThinking = false,
  onAction,
}: NineMensMorrisBoardProps) {
  const [selectedNode, setSelectedNode] = useState<number | null>(null);

  const currentPhase = getPlayerPhase(state, state.turn);
  const legalActions = useMemo(
    () => (isHumanTurn ? getLegalMorrisActions(state) : []),
    [isHumanTurn, state]
  );

  const capturableSet = useMemo(() => {
    if (!state.pendingCapture || !isHumanTurn) return new Set<number>();
    return new Set(getCapturableTargets(state.board, state.turn));
  }, [state.pendingCapture, state.board, state.turn, isHumanTurn]);

  const legalPlaceSet = useMemo(() => {
    const s = new Set<number>();
    for (const a of legalActions) {
      if (a.type === 'PLACE') s.add(a.to);
    }
    return s;
  }, [legalActions]);

  const legalMoveSources = useMemo(() => {
    const s = new Set<number>();
    for (const a of legalActions) {
      if (a.type === 'MOVE') s.add(a.from);
    }
    return s;
  }, [legalActions]);

  const destinationsForSelected = useMemo(() => {
    if (selectedNode === null) return new Set<number>();
    const s = new Set<number>();
    for (const a of legalActions) {
      if (a.type === 'MOVE' && a.from === selectedNode) {
        s.add(a.to);
      }
    }
    return s;
  }, [legalActions, selectedNode]);

  const activeMills = useMemo(() => {
    return MORRIS_MILLS.filter(([a, b, c]) => {
      const col = state.board[a];
      return col !== null && state.board[b] === col && state.board[c] === col;
    });
  }, [state.board]);

  const handleNodeTap = (nodeIdx: number) => {
    if (!isHumanTurn || aiThinking) return;

    if (state.pendingCapture) {
      if (capturableSet.has(nodeIdx)) {
        setSelectedNode(null);
        onAction({ type: 'CAPTURE', target: nodeIdx });
      }
      return;
    }

    if (currentPhase === 'placement') {
      if (legalPlaceSet.has(nodeIdx)) {
        setSelectedNode(null);
        onAction({ type: 'PLACE', to: nodeIdx });
      }
      return;
    }

    if (selectedNode !== null && destinationsForSelected.has(nodeIdx)) {
      onAction({ type: 'MOVE', from: selectedNode, to: nodeIdx });
      setSelectedNode(null);
      return;
    }

    if (legalMoveSources.has(nodeIdx)) {
      setSelectedNode(selectedNode === nodeIdx ? null : nodeIdx);
      return;
    }

    setSelectedNode(null);
  };

  const whiteOnBoard = countPiecesOnBoard(state.board, 'w');
  const blackOnBoard = countPiecesOnBoard(state.board, 'b');

  const phaseTitle = state.pendingCapture
    ? 'Mill Formed — Select Opponent Piece'
    : currentPhase === 'placement'
    ? 'Placement Phase'
    : currentPhase === 'flying'
    ? 'Flying Phase (3 Pieces)'
    : 'Movement Phase';

  return (
    <div className="arena-layout">
      <div className="arena-board-col">
        <BoardPerspectiveStage className="arena-square-board">
          <div className="rounded-2xl sm:rounded-3xl bg-[#3c2313] p-2 sm:p-3 border-2 border-[#d4af37]/55 shadow-2xl">
            <svg
              viewBox="0 0 420 420"
              className="w-full h-auto block select-none"
              role="img"
              aria-label="Nine Men's Morris board"
            >
              <defs>
                <linearGradient id="cedar-bg" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#6c4225" />
                  <stop offset="55%" stopColor="#523018" />
                  <stop offset="100%" stopColor="#3b200f" />
                </linearGradient>
                <radialGradient id="morris-ivory" cx="32%" cy="28%" r="70%">
                  <stop offset="0%" stopColor="#fffbeb" />
                  <stop offset="55%" stopColor="#f3e5ab" />
                  <stop offset="100%" stopColor="#a16207" />
                </radialGradient>
                <radialGradient id="morris-obsidian" cx="32%" cy="28%" r="70%">
                  <stop offset="0%" stopColor="#64748b" />
                  <stop offset="55%" stopColor="#1e293b" />
                  <stop offset="100%" stopColor="#020617" />
                </radialGradient>
              </defs>

              <rect
                x="6"
                y="6"
                width="408"
                height="408"
                rx="20"
                fill="url(#cedar-bg)"
                stroke="#d4af37"
                strokeWidth="2.5"
                strokeOpacity="0.55"
              />

              {/* Three Concentric Squares */}
              <rect
                x="42"
                y="42"
                width="336"
                height="336"
                fill="none"
                stroke="#e2c799"
                strokeWidth="3.5"
                strokeOpacity="0.85"
              />
              <rect
                x="98"
                y="98"
                width="224"
                height="224"
                fill="none"
                stroke="#e2c799"
                strokeWidth="3.5"
                strokeOpacity="0.85"
              />
              <rect
                x="154"
                y="154"
                width="112"
                height="112"
                fill="none"
                stroke="#e2c799"
                strokeWidth="3.5"
                strokeOpacity="0.85"
              />

              {/* 4 Radial Midpoint Spokes */}
              <line x1="210" y1="42" x2="210" y2="154" stroke="#e2c799" strokeWidth="3.5" strokeOpacity="0.85" />
              <line x1="378" y1="210" x2="266" y2="210" stroke="#e2c799" strokeWidth="3.5" strokeOpacity="0.85" />
              <line x1="210" y1="378" x2="210" y2="266" stroke="#e2c799" strokeWidth="3.5" strokeOpacity="0.85" />
              <line x1="42" y1="210" x2="154" y2="210" stroke="#e2c799" strokeWidth="3.5" strokeOpacity="0.85" />

              {/* Center emblem */}
              <circle cx="210" cy="210" r="18" fill="none" stroke="#d4af37" strokeWidth="1.5" strokeOpacity="0.45" />
              <circle cx="210" cy="210" r="4" fill="#d4af37" fillOpacity="0.6" />

              {/* Active Mill Glow Bars */}
              {activeMills.map(([a, , c]) => {
                const p1 = NODE_COORDS[a];
                const p2 = NODE_COORDS[c];
                const millColor = state.board[a] === 'w' ? '#fbbf24' : '#38bdf8';
                return (
                  <line
                    key={`mill-${a}-${c}`}
                    x1={p1.x}
                    y1={p1.y}
                    x2={p2.x}
                    y2={p2.y}
                    stroke={millColor}
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeOpacity="0.42"
                  />
                );
              })}

              {/* 24 Intersections & Pieces */}
              {NODE_COORDS.map((pos, idx) => {
                const piece = state.board[idx];
                const isSelected = selectedNode === idx;
                const isDest = destinationsForSelected.has(idx);
                const isPlaceable =
                  !state.pendingCapture &&
                  currentPhase === 'placement' &&
                  legalPlaceSet.has(idx);
                const isCapturable = capturableSet.has(idx);
                const isMovable =
                  !state.pendingCapture &&
                  currentPhase !== 'placement' &&
                  legalMoveSources.has(idx);

                const interactive =
                  isHumanTurn &&
                  !aiThinking &&
                  (isPlaceable || isDest || isCapturable || isMovable);

                return (
                  <g
                    key={idx}
                    onClick={() => handleNodeTap(idx)}
                    className={interactive ? 'cursor-pointer' : 'cursor-default'}
                  >
                    {/* Generous invisible hit area for mobile touch */}
                    <circle cx={pos.x} cy={pos.y} r={22} fill="transparent" />

                    {/* Intersection peg socket */}
                    <circle
                      cx={pos.x}
                      cy={pos.y}
                      r={7}
                      fill="#2b170b"
                      stroke="#e2c799"
                      strokeWidth="1.8"
                    />

                    {/* Legal Destination / Placement Indicator */}
                    {(isDest || (isPlaceable && selectedNode === null)) && (
                      <circle
                        cx={pos.x}
                        cy={pos.y}
                        r={isDest ? 13 : 9}
                        fill={isDest ? 'rgba(16,185,129,0.28)' : 'rgba(212,175,55,0.22)'}
                        stroke={isDest ? '#34d399' : '#d4af37'}
                        strokeWidth={isDest ? 2.2 : 1.2}
                        strokeOpacity={isDest ? 0.95 : 0.65}
                      />
                    )}

                    {/* Piece Disc */}
                    {piece && (
                      <g>
                        {isSelected && (
                          <circle
                            cx={pos.x}
                            cy={pos.y}
                            r={21}
                            fill="none"
                            stroke="#fbbf24"
                            strokeWidth="3"
                          />
                        )}
                        {isCapturable && (
                          <circle
                            cx={pos.x}
                            cy={pos.y}
                            r={22}
                            fill="rgba(239,68,68,0.22)"
                            stroke="#f87171"
                            strokeWidth="2.8"
                            strokeDasharray="4 3"
                          />
                        )}
                        <circle
                          cx={pos.x + 1.5}
                          cy={pos.y + 2.5}
                          r={16.5}
                          fill="rgba(0,0,0,0.48)"
                        />
                        <circle
                          cx={pos.x}
                          cy={pos.y}
                          r={16.5}
                          fill={
                            piece === 'w'
                              ? 'url(#morris-ivory)'
                              : 'url(#morris-obsidian)'
                          }
                          stroke={piece === 'w' ? '#d4af37' : '#94a3b8'}
                          strokeWidth="1.8"
                        />
                        <circle
                          cx={pos.x}
                          cy={pos.y}
                          r={9.5}
                          fill="none"
                          stroke={piece === 'w' ? '#a16207' : '#475569'}
                          strokeWidth="1"
                          strokeOpacity="0.6"
                        />
                      </g>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>
        </BoardPerspectiveStage>
      </div>

      {/* Turn, Reserves & Controls */}
      <aside className="arena-sidebar space-y-3">
        <div className="rounded-2xl bg-[var(--cp-bg-elevated)] border border-[var(--cp-border)] p-3 sm:p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <span
                  className={`w-3.5 h-3.5 rounded-full border shrink-0 ${
                    state.turn === 'w'
                      ? 'bg-[#f3e5ab] border-[#d4af37]'
                      : 'bg-slate-800 border-slate-400'
                  }`}
                />
                <span className="font-display font-bold text-base">
                  {state.turn === 'w' ? 'Ivory Gold' : 'Obsidian'}
                  {aiThinking ? ' (Thinking...)' : ''}
                </span>
              </div>
              <p className="text-xs text-[var(--cp-gold)] font-medium mt-1 flex items-center gap-1">
                {state.pendingCapture && <Sparkles className="w-3.5 h-3.5" />}
                {phaseTitle}
              </p>
            </div>

            <div className="flex items-center gap-2">
              {state.mode !== 'online' && (
                <button
                  type="button"
                  disabled={state.undoStack.length === 0 || aiThinking}
                  onClick={() => {
                    setSelectedNode(null);
                    onAction({ type: 'UNDO' });
                  }}
                  className="min-h-[40px] px-3 rounded-xl bg-[var(--cp-surface)] border border-[var(--cp-border)] hover:border-[var(--cp-gold)] disabled:opacity-40 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer disabled:cursor-not-allowed"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                  Undo
                </button>
              )}
              <button
                type="button"
                disabled={aiThinking}
                onClick={() => onAction({ type: 'RESIGN', color: state.turn })}
                className="min-h-[40px] px-3 rounded-xl bg-[var(--cp-surface)] border border-[var(--cp-border)] hover:border-red-400/60 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
              >
                <Flag className="w-3.5 h-3.5" />
                Resign
              </button>
            </div>
          </div>

          {/* Player Piece Counters */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-[var(--cp-surface)] border border-[var(--cp-border)] p-3 space-y-1.5">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-[#f3e5ab]">Ivory Gold</span>
                <span className="font-mono-tabular text-[var(--cp-text-muted)]">
                  {whiteOnBoard + state.inHand.w} total
                </span>
              </div>
              <div className="text-[11px] text-[var(--cp-text-muted)] font-mono-tabular">
                In Hand: {state.inHand.w} · On Board: {whiteOnBoard}
              </div>
              {state.inHand.w === 0 && whiteOnBoard === 3 && (
                <div className="text-[11px] font-semibold text-emerald-300">
                  Flying Active
                </div>
              )}
            </div>

            <div className="rounded-xl bg-[var(--cp-surface)] border border-[var(--cp-border)] p-3 space-y-1.5">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-slate-300">Obsidian</span>
                <span className="font-mono-tabular text-[var(--cp-text-muted)]">
                  {blackOnBoard + state.inHand.b} total
                </span>
              </div>
              <div className="text-[11px] text-[var(--cp-text-muted)] font-mono-tabular">
                In Hand: {state.inHand.b} · On Board: {blackOnBoard}
              </div>
              {state.inHand.b === 0 && blackOnBoard === 3 && (
                <div className="text-[11px] font-semibold text-emerald-300">
                  Flying Active
                </div>
              )}
            </div>
          </div>

          <div className="text-xs text-[var(--cp-text-muted)]">
            {state.pendingCapture
              ? 'Tap any opponent piece outlined in dashed crimson to remove it.'
              : currentPhase === 'placement'
              ? 'Tap any empty intersection to place one of your 9 pieces.'
              : currentPhase === 'flying'
              ? 'Down to 3 pieces! Tap any of your pieces, then fly to any empty intersection.'
              : 'Tap one of your pieces, then tap an adjacent empty point along a line.'}
          </div>
        </div>

        {/* Move History */}
        <div className="rounded-2xl bg-[var(--cp-bg-elevated)] border border-[var(--cp-border)] p-4">
          <div className="text-xs font-semibold tracking-wider text-[var(--cp-text-muted)] mb-2">
            MORRIS LOG ({state.history.length})
          </div>
          {state.history.length === 0 ? (
            <p className="text-xs text-[var(--cp-text-muted)]">
              Form 3-in-a-row mills to capture rival pieces.
            </p>
          ) : (
            <div className="max-h-40 overflow-y-auto flex flex-wrap gap-1.5">
              {state.history.map((item, idx) => (
                <span
                  key={`${item}-${idx}`}
                  className="px-2 py-1 rounded-lg bg-[var(--cp-surface)] text-[11px] font-mono-tabular text-[var(--cp-text)]"
                >
                  {item}
                </span>
              ))}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
