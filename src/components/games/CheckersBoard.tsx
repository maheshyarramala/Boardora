import { useMemo, useState } from 'react';
import { Flag, RotateCw, Undo2 } from 'lucide-react';
import {
  getLegalCheckersMoves,
  type CheckersAction,
  type CheckersState,
  type SquareCoord,
} from '../../engines/checkers/checkersEngine';

interface CheckersBoardProps {
  state: CheckersState;
  isHumanTurn: boolean;
  aiThinking: boolean;
  onAction: (action: CheckersAction) => void;
}

export function CheckersBoard({
  state,
  isHumanTurn,
  aiThinking,
  onAction,
}: CheckersBoardProps) {
  const [flipped, setFlipped] = useState(false);
  const [selected, setSelected] = useState<SquareCoord | null>(null);

  const legalMoves = useMemo(() => getLegalCheckersMoves(state), [state]);

  const activeSource = state.forcedPiece ?? selected;

  const targetMovesForSource = useMemo(() => {
    if (!activeSource || !isHumanTurn) return new Map<string, boolean>();
    const map = new Map<string, boolean>();
    for (const m of legalMoves) {
      if (m.from.r === activeSource.r && m.from.c === activeSource.c) {
        map.set(`${m.to.r},${m.to.c}`, Math.abs(m.to.r - m.from.r) === 2);
      }
    }
    return map;
  }, [activeSource, isHumanTurn, legalMoves]);

  const selectableSources = useMemo(() => {
    const set = new Set<string>();
    for (const m of legalMoves) {
      set.add(`${m.from.r},${m.from.c}`);
    }
    return set;
  }, [legalMoves]);

  const rows = flipped ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];
  const cols = flipped ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];

  const handleSquareClick = (r: number, c: number) => {
    if (!isHumanTurn || aiThinking) return;

    const key = `${r},${c}`;
    if (activeSource && targetMovesForSource.has(key)) {
      onAction({
        type: 'MOVE',
        from: activeSource,
        to: { r, c },
      });
      setSelected(null);
      return;
    }

    if (state.forcedPiece) return;

    const piece = state.board[r][c];
    if (piece && piece.color === state.turn && selectableSources.has(key)) {
      setSelected((prev) =>
        prev && prev.r === r && prev.c === c ? null : { r, c }
      );
    } else {
      setSelected(null);
    }
  };

  const canUndo =
    state.mode !== 'online' && !aiThinking && state.undoStack.length > 0;

  return (
    <div className="arena-layout">
      <div className="arena-board-col">
        <div className="arena-square-board-with-strips space-y-1.5">
          <div className="flex items-center justify-between text-xs px-1.5 text-[var(--cp-text-muted)] leading-tight">
            <span>
              {flipped ? 'Crimson' : 'Walnut'} · Captured:{' '}
              <strong className="font-mono-tabular text-[var(--cp-text)]">
                {flipped ? state.capturedByRed : state.capturedByBlack}
              </strong>
            </span>
            <span>
              {state.mandatoryCapture ? 'Mandatory Captures' : 'Casual Captures'}
            </span>
          </div>

          <div className="rounded-2xl bg-[#2B1914] p-2 sm:p-3 border-2 border-[var(--cp-border-strong)] shadow-[0_24px_48px_-14px_rgba(0,0,0,0.75)]">
          <div className="grid grid-cols-8 aspect-square w-full rounded-lg overflow-hidden border border-[#140B08]">
            {rows.map((r) =>
              cols.map((c) => {
                const isDark = (r + c) % 2 === 1;
                const piece = state.board[r][c];
                const key = `${r},${c}`;
                const isActive =
                  activeSource?.r === r && activeSource?.c === c;
                const isTarget = targetMovesForSource.has(key);
                const isJumpTarget = targetMovesForSource.get(key) === true;
                const canPick =
                  isHumanTurn && !state.forcedPiece && selectableSources.has(key);

                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleSquareClick(r, c)}
                    aria-label={`Row ${8 - r} Col ${String.fromCharCode(97 + c)}`}
                    className={`relative flex items-center justify-center aspect-square select-none transition-colors ${
                      isDark
                        ? isActive
                          ? 'bg-[#6F5328] cursor-pointer'
                          : isTarget
                          ? 'bg-[#3C5B44] cursor-pointer'
                          : canPick
                          ? 'bg-[#32221D] hover:bg-[#3F2B25] cursor-pointer'
                          : 'bg-[#2B1D19]'
                        : 'bg-[#E6D8BF]'
                    }`}
                  >
                    {piece && (
                      <div
                        className={`w-[74%] h-[74%] rounded-full flex items-center justify-center shadow-[0_5px_8px_rgba(0,0,0,0.55)] border-2 transition-transform ${
                          piece.color === 'r'
                            ? 'bg-gradient-to-br from-[#F87171] via-[#DC2626] to-[#7F1D1D] border-[#FECACA]/70'
                            : 'bg-gradient-to-br from-[#524139] via-[#2D211C] to-[#120C0A] border-[#D4AF37]/65'
                        } ${isActive ? 'scale-105 ring-2 ring-[#F2CF66]' : ''}`}
                      >
                        <div className="w-[70%] h-[70%] rounded-full border border-white/20 flex items-center justify-center">
                          {piece.king && (
                            <span className="text-[#F2CF66] text-xs sm:text-sm font-bold leading-none">
                              ♛
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {isTarget && (
                      <span
                        className={`w-3.5 h-3.5 rounded-full pointer-events-none ${
                          isJumpTarget
                            ? 'bg-[#F2CF66] ring-4 ring-[#F2CF66]/35'
                            : 'bg-[#F2CF66]/75'
                        }`}
                      />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

          <div className="flex items-center justify-between text-xs px-1.5 text-[var(--cp-text-muted)] leading-tight">
            <span>
              {flipped ? 'Walnut' : 'Crimson'} · Captured:{' '}
              <strong className="font-mono-tabular text-[var(--cp-text)]">
                {flipped ? state.capturedByBlack : state.capturedByRed}
              </strong>
            </span>
            {state.forcedPiece && (
              <span className="text-[var(--cp-gold)] font-medium">
                Multi-jump active — continue capturing
              </span>
            )}
          </div>
        </div>
      </div>

      <aside className="arena-sidebar space-y-3">
        <div className="rounded-2xl bg-[var(--cp-bg-elevated)] border border-[var(--cp-border-strong)] p-3 sm:p-4 space-y-3">
          <div>
            <div className="text-xs text-[var(--cp-text-muted)]">ACTIVE TURN</div>
            <div className="font-display text-lg font-bold mt-0.5">
              {aiThinking
                ? 'Walnut AI Calculating...'
                : `${state.turn === 'r' ? 'Crimson' : 'Walnut'} to Move`}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setFlipped((f) => !f)}
              className="min-h-[44px] px-3 py-2 rounded-xl bg-[var(--cp-surface)] hover:bg-[var(--cp-surface-muted)] text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <RotateCw className="w-3.5 h-3.5" />
              Flip
            </button>
            <button
              type="button"
              disabled={!canUndo}
              onClick={() => onAction({ type: 'UNDO' })}
              className="min-h-[44px] px-3 py-2 rounded-xl bg-[var(--cp-surface)] hover:bg-[var(--cp-surface-muted)] disabled:opacity-45 disabled:cursor-not-allowed text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Undo2 className="w-3.5 h-3.5" />
              Undo
            </button>
            <button
              type="button"
              onClick={() => onAction({ type: 'RESIGN', color: state.turn })}
              className="min-h-[44px] px-3 py-2 rounded-xl bg-[var(--cp-surface)] hover:bg-red-950/60 text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Flag className="w-3.5 h-3.5" />
              Resign
            </button>
          </div>
        </div>

        <div className="rounded-2xl bg-[var(--cp-bg-elevated)] border border-[var(--cp-border)] p-4">
          <div className="text-xs font-semibold tracking-wider text-[var(--cp-gold)] mb-2">
            MOVE HISTORY
          </div>
          {state.history.length === 0 ? (
            <p className="text-xs text-[var(--cp-text-muted)]">
              Crimson moves first. Select a highlighted piece to see legal moves.
            </p>
          ) : (
            <ul className="space-y-1 text-xs font-mono-tabular text-[var(--cp-text-muted)] max-h-48 overflow-y-auto">
              {state.history.slice(0, 16).map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </div>
  );
}
