import { useMemo, useState } from 'react';
import { Award, Undo2 } from 'lucide-react';
import {
  PEG_LAYOUT_META,
  computePegScore,
  getLegalPegJumps,
  type PegCoord,
  type PegLayoutId,
  type PegSolitaireAction,
  type PegSolitaireState,
} from '../../engines/pegSolitaire/pegSolitaireEngine';
import { useAppState } from '../../state/AppStateContext';
import { BoardPerspectiveStage } from '../tabletop/TactilePieces';

interface PegSolitaireBoardProps {
  state: PegSolitaireState;
  onAction: (action: PegSolitaireAction) => void;
}

export function PegSolitaireBoard({ state, onAction }: PegSolitaireBoardProps) {
  const { stats } = useAppState();
  const [selected, setSelected] = useState<PegCoord | null>(null);

  const legalJumps = useMemo(() => getLegalPegJumps(state.board), [state.board]);
  const validSources = useMemo(() => {
    const s = new Set<string>();
    for (const j of legalJumps) {
      s.add(`${j.from.r},${j.from.c}`);
    }
    return s;
  }, [legalJumps]);

  const destinationsForSelected = useMemo(() => {
    if (!selected) return new Map<string, PegCoord>();
    const map = new Map<string, PegCoord>();
    for (const j of legalJumps) {
      if (j.from.r === selected.r && j.from.c === selected.c) {
        map.set(`${j.to.r},${j.to.c}`, j.to);
      }
    }
    return map;
  }, [legalJumps, selected]);

  const currentScore = computePegScore(state);
  const bestRecordedScore = stats.byGame.peg_solitaire?.bestScore ?? null;
  const displayBest =
    bestRecordedScore === null
      ? currentScore
      : Math.max(bestRecordedScore, currentScore);

  const handleHoleTap = (r: number, c: number) => {
    const cell = state.board[r][c];
    if (cell === 'invalid') return;

    const targetDest = destinationsForSelected.get(`${r},${c}`);
    if (selected && targetDest) {
      onAction({
        type: 'JUMP',
        from: selected,
        to: targetDest,
      });
      setSelected(null);
      return;
    }

    if (cell === 'peg' && validSources.has(`${r},${c}`)) {
      if (selected && selected.r === r && selected.c === c) {
        setSelected(null);
      } else {
        setSelected({ r, c });
      }
      return;
    }

    setSelected(null);
  };

  return (
    <div className="arena-layout">
      <div className="arena-board-col">
        <BoardPerspectiveStage className="arena-square-board">
          <div className="boardora-3d-board rounded-2xl sm:rounded-3xl bg-gradient-to-b from-[#4f2e18] to-[#2e190b] p-2 sm:p-3.5 border-2 border-[#d4af37]/55 shadow-2xl">
            <svg
              viewBox="0 0 420 420"
              className="w-full h-auto block select-none"
              role="img"
              aria-label={`Peg Solitaire ${PEG_LAYOUT_META[state.layoutId].name} board`}
            >
              <defs>
                <radialGradient id="peg-board-wood" cx="50%" cy="45%" r="55%">
                  <stop offset="0%" stopColor="#6c3f21" />
                  <stop offset="70%" stopColor="#4c2b15" />
                  <stop offset="100%" stopColor="#351c0c" />
                </radialGradient>
                <radialGradient id="brass-peg-grad" cx="32%" cy="28%" r="70%">
                  <stop offset="0%" stopColor="#fff4c2" />
                  <stop offset="38%" stopColor="#eab308" />
                  <stop offset="85%" stopColor="#92400e" />
                  <stop offset="100%" stopColor="#451a03" />
                </radialGradient>
                <radialGradient id="hole-cavity" cx="45%" cy="55%" r="60%">
                  <stop offset="0%" stopColor="#1b0e06" />
                  <stop offset="80%" stopColor="#29160a" />
                  <stop offset="100%" stopColor="#7c4f2b" />
                </radialGradient>
              </defs>

              {/* Circular mahogany disc */}
              <circle
                cx="210"
                cy="210"
                r="202"
                fill="url(#peg-board-wood)"
                stroke="#d4af37"
                strokeWidth="3"
                strokeOpacity="0.65"
              />
              <circle
                cx="210"
                cy="210"
                r="191"
                fill="none"
                stroke="#d4af37"
                strokeWidth="1"
                strokeOpacity="0.3"
              />

              {state.board.map((row, r) =>
                row.map((cell, c) => {
                  if (cell === 'invalid') return null;
                  const cx = 60 + c * 50;
                  const cy = 60 + r * 50;
                  const key = `${r},${c}`;
                  const isCenter = r === 3 && c === 3;
                  const isSelected = selected?.r === r && selected?.c === c;
                  const isDest = destinationsForSelected.has(key);
                  const canJump = validSources.has(key);

                  return (
                    <g
                      key={key}
                      onClick={() => handleHoleTap(r, c)}
                      className={
                        cell === 'peg' || isDest ? 'cursor-pointer' : 'cursor-default'
                      }
                    >
                      {/* Socket ring */}
                      <circle
                        cx={cx}
                        cy={cy}
                        r={19}
                        fill="url(#hole-cavity)"
                        stroke={
                          isCenter
                            ? '#eab308'
                            : isDest
                            ? '#34d399'
                            : '#855836'
                        }
                        strokeWidth={isCenter || isDest ? 2 : 1.2}
                        strokeOpacity={isDest ? 0.95 : 0.7}
                      />

                      {/* Pulsing legal jump target indicator */}
                      {isDest && (
                        <>
                          <circle
                            cx={cx}
                            cy={cy}
                            r={13}
                            fill="#10b981"
                            fillOpacity="0.28"
                            stroke="#34d399"
                            strokeWidth="2"
                          />
                          <circle cx={cx} cy={cy} r={4.5} fill="#6ee7b7" />
                        </>
                      )}

                      {/* Brass peg */}
                      {cell === 'peg' && (
                        <g className="transition-transform duration-150">
                          {isSelected && (
                            <circle
                              cx={cx}
                              cy={cy}
                              r={21}
                              fill="none"
                              stroke="#fbbf24"
                              strokeWidth="3"
                            />
                          )}
                          {canJump && !isSelected && (
                            <circle
                              cx={cx}
                              cy={cy}
                              r={17.5}
                              fill="none"
                              stroke="#fde68a"
                              strokeWidth="1"
                              strokeOpacity="0.35"
                            />
                          )}
                          <circle
                            cx={cx + 1.5}
                            cy={cy + 2.5}
                            r={14.5}
                            fill="rgba(0,0,0,0.45)"
                          />
                          <circle
                            cx={cx}
                            cy={cy}
                            r={14.5}
                            fill="url(#brass-peg-grad)"
                            stroke="#78350f"
                            strokeWidth="1"
                          />
                          <circle
                            cx={cx - 4}
                            cy={cy - 4.5}
                            r={4}
                            fill="rgba(255,255,255,0.45)"
                          />
                        </g>
                      )}
                    </g>
                  );
                })
              )}
            </svg>
          </div>
        </BoardPerspectiveStage>
      </div>

      {/* Control & Scoring Panel */}
      <aside className="arena-sidebar space-y-3">
        <div className="rounded-2xl bg-[var(--cp-bg-elevated)] border border-[var(--cp-border)] p-3 sm:p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-xs font-semibold tracking-wider text-[var(--cp-gold)]">
                {PEG_LAYOUT_META[state.layoutId].name.toUpperCase()}
              </div>
              <p className="text-xs text-[var(--cp-text-muted)] mt-0.5">
                {selected
                  ? 'Tap a glowing emerald hole to complete your jump.'
                  : `${legalJumps.length} legal jump${legalJumps.length === 1 ? '' : 's'} available`}
              </p>
            </div>
            <button
              type="button"
              disabled={state.undoStack.length === 0}
              onClick={() => {
                setSelected(null);
                onAction({ type: 'UNDO' });
              }}
              className="min-h-[42px] px-3.5 py-2 rounded-xl bg-[var(--cp-surface)] border border-[var(--cp-border)] hover:border-[var(--cp-gold)] disabled:opacity-40 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
            >
              <Undo2 className="w-4 h-4" />
              Undo
            </button>
          </div>

          {/* Live Stats */}
          <div className="grid grid-cols-3 gap-2.5">
            <div className="rounded-xl bg-[var(--cp-surface)] border border-[var(--cp-border)] p-3 text-center">
              <div className="text-[11px] text-[var(--cp-text-muted)]">Pegs Left</div>
              <div className="mt-0.5 text-xl font-bold font-mono-tabular text-[var(--cp-text)]">
                {state.pegsRemaining}
              </div>
            </div>
            <div className="rounded-xl bg-[var(--cp-surface)] border border-[var(--cp-border)] p-3 text-center">
              <div className="text-[11px] text-[var(--cp-text-muted)]">Moves</div>
              <div className="mt-0.5 text-xl font-bold font-mono-tabular text-[var(--cp-text)]">
                {state.moveCount}
              </div>
            </div>
            <div className="rounded-xl bg-[var(--cp-surface)] border border-[var(--cp-border)] p-3 text-center">
              <div className="text-[11px] text-[var(--cp-text-muted)] flex items-center justify-center gap-1">
                <Award className="w-3 h-3 text-[var(--cp-gold)]" />
                Best
              </div>
              <div className="mt-0.5 text-xl font-bold font-mono-tabular text-[var(--cp-gold)]">
                {displayBest}
              </div>
            </div>
          </div>

          {/* Layout selector */}
          <div>
            <div className="text-xs font-semibold tracking-wider text-[var(--cp-text-muted)] mb-2">
              BOARD LAYOUT
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(['english', 'european', 'diamond'] as PegLayoutId[]).map((id) => {
                const active = state.layoutId === id;
                const meta = PEG_LAYOUT_META[id];
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      setSelected(null);
                      onAction({ type: 'RESET_LAYOUT', layoutId: id });
                    }}
                    className={`min-h-[44px] px-2.5 py-2 rounded-xl border text-center transition-colors cursor-pointer ${
                      active
                        ? 'bg-[var(--cp-gold)] text-[#081020] border-[var(--cp-gold)] font-semibold'
                        : 'bg-[var(--cp-surface)] border-[var(--cp-border)] text-[var(--cp-text-muted)] hover:text-[var(--cp-text)]'
                    }`}
                  >
                    <div className="text-xs font-semibold">{meta.name.split(' ')[0]}</div>
                    <div className="text-[10px] opacity-80 font-mono-tabular">
                      {meta.holes} holes
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl bg-[var(--cp-surface)] border border-[var(--cp-border)] p-3 flex items-center justify-between text-xs">
            <span className="text-[var(--cp-text-muted)]">Current Run Score</span>
            <span className="font-mono-tabular font-bold text-[var(--cp-gold)]">
              {currentScore} pts
            </span>
          </div>
        </div>

        {/* Jump History */}
        <div className="rounded-2xl bg-[var(--cp-bg-elevated)] border border-[var(--cp-border)] p-4">
          <div className="text-xs font-semibold tracking-wider text-[var(--cp-text-muted)] mb-2">
            JUMP LOG ({state.history.length})
          </div>
          {state.history.length === 0 ? (
            <p className="text-xs text-[var(--cp-text-muted)]">
              Tap any highlighted peg to jump orthogonally over a neighbor into an empty hole.
            </p>
          ) : (
            <div className="max-h-36 overflow-y-auto flex flex-wrap gap-1.5">
              {state.history.map((entry, idx) => (
                <span
                  key={`${entry}-${idx}`}
                  className="px-2 py-1 rounded-lg bg-[var(--cp-surface)] text-[11px] font-mono-tabular text-[var(--cp-text)]"
                >
                  {entry}
                </span>
              ))}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
